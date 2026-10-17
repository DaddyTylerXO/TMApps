using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Postbox;

class StartupTests {
    static int checks;
    static void Check(bool value, string message) { if (!value) throw new Exception(message); checks++; }
    static System.Collections.Generic.IEnumerable<DependencyObject> Nodes(DependencyObject root) { yield return root; foreach (var child in LogicalTreeHelper.GetChildren(root).OfType<DependencyObject>()) foreach (var next in Nodes(child)) yield return next; }
    static void Pump(Task task) { if (!task.IsCompleted) { var frame = new DispatcherFrame(); task.ContinueWith(t => Application.Current.Dispatcher.BeginInvoke(new Action(() => frame.Continue = false))); Dispatcher.PushFrame(frame); } task.GetAwaiter().GetResult(); }
    [STAThread] static void Main(string[] args) {
        SynchronizationContext.SetSynchronizationContext(new DispatcherSynchronizationContext(Dispatcher.CurrentDispatcher));
        if (args.Contains("--full-startup")) { FullStartup(args); return; }
        var app = new App { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        int cancelled = 0; var host = new StartupSplashHost(() => Interlocked.Increment(ref cancelled));
        Check(host.Ready.Wait(8000), "Loading screen did not render");
        var splash = (Window)typeof(StartupSplashHost).GetField("splash", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(host);
        Check(splash.Dispatcher != app.Dispatcher && app.MainWindow == null, "Loading screen took over the mailbox dispatcher/main window");
        int ticks = 0; DispatcherTimer pulse = null;
        splash.Dispatcher.Invoke(new Action(delegate { pulse = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(25) }; pulse.Tick += delegate { Interlocked.Increment(ref ticks); }; pulse.Start(); }));
        host.SetStage("Loading a large test profile…");
        Thread.Sleep(650); // Deliberately block the main UI as profile/cache construction can do.
        Check(Volatile.Read(ref ticks) >= 5, "Loading screen stopped responding while the main thread was busy");
        Check((bool)splash.Dispatcher.Invoke(new Func<bool>(() => splash.IsVisible)), "Loading screen disappeared while loading");
        splash.Dispatcher.Invoke(new Action(() => pulse.Stop())); host.Close(); Check(host.Stopped.Wait(5000) && cancelled == 0, "Normal handoff cancelled startup or leaked the splash thread");
        var cancelHost = new StartupSplashHost(() => Interlocked.Increment(ref cancelled)); Check(cancelHost.Ready.Wait(8000), "Cancellation splash did not render");
        var cancelWindow = (Window)typeof(StartupSplashHost).GetField("splash", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(cancelHost);
        cancelWindow.Dispatcher.Invoke(new Action(() => cancelWindow.Close())); Check(cancelHost.Stopped.Wait(5000) && cancelled == 1, "Closing the loading screen did not cancel once");
        var show = typeof(App).GetMethod("ShowStartupTarget", BindingFlags.Instance | BindingFlags.NonPublic);
        var target = new Window { Width = 240, Height = 160, Content = new TextBlock { Text = "Synthetic handoff" } }; bool rendered = false; target.ContentRendered += delegate { rendered = true; };
        var handoff = (Task<bool>)show.Invoke(app, new object[] { target, true, CancellationToken.None }); Pump(handoff); Check(handoff.Result && rendered, "Handoff completed before the target rendered"); target.Close();
        var minimized = new Window { Width = 240, Height = 160 }; minimized.Loaded += delegate { minimized.Hide(); };
        var hidden = (Task<bool>)show.Invoke(app, new object[] { minimized, false, CancellationToken.None }); Pump(hidden); Check(hidden.Result && !minimized.IsVisible, "Start-minimized handoff waited for an invisible frame"); minimized.Close();
        app.Shutdown(); Console.WriteLine("Passed " + checks + " responsive loading-screen, cancellation, frame-handoff and minimized-window checks.");
    }
    static void FullStartup(string[] args) {
        var app = new App { ShutdownMode = ShutdownMode.OnExplicitShutdown }; bool startMinimized = args.Contains("--start-minimized-test"), welcomeMode = args.Contains("--welcome-startup-test"), welcomeRendered = false;
        string directory = args[Array.IndexOf(args, "--data-dir") + 1]; Directory.CreateDirectory(directory); new SettingsStore(Path.Combine(directory, "settings.json")).Save(new Preferences { SetupCompleted = !welcomeMode, StartMinimized = startMinimized });
        bool attached = false, mailboxRendered = false, completed = false; var deadline = DateTime.UtcNow.AddSeconds(15); var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(40) };
        timer.Tick += delegate {
            if (welcomeMode) { var welcome = app.Windows.Cast<Window>().FirstOrDefault(w => w.Title == "Welcome to TMA-Mail"); if (welcome != null && welcome.IsVisible) { if (!welcomeRendered) { welcomeRendered = true; } else { var skip = Nodes(welcome).OfType<Button>().Single(b => Convert.ToString(b.Content) == "Explore for now"); skip.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); welcomeMode = false; } } }
            var window = app.Windows.Cast<Window>().FirstOrDefault(w => w.Title == "TMA-Mail");
            if (window != null && !attached) { attached = true; window.ContentRendered += delegate { mailboxRendered = true; }; }
            if (window != null && (startMinimized ? window.IsLoaded && !window.IsVisible && app.MainWindow == window : mailboxRendered && window.IsVisible)) { completed = true; timer.Stop(); window.Close(); }
            else if (DateTime.UtcNow > deadline) { timer.Stop(); app.Shutdown(1); }
        };
        app.Startup += delegate(object sender, StartupEventArgs eventArgs) { typeof(App).GetMethod("StartDesktop", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(app, new object[] { sender, eventArgs }); };
        timer.Start(); app.Run(); Check(completed, "Real startup did not render the mailbox and hand off");
        Console.WriteLine("Passed full " + (startMinimized ? "start-minimized" : "normal/welcome") + " offline startup and mailbox handoff. Synthetic local profile only.");
    }
}
