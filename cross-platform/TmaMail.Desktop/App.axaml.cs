using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace TmaMail.Desktop;
public sealed partial class App : Application {
    public override void Initialize() => AvaloniaXamlLoader.Load(this);
    public override void OnFrameworkInitializationCompleted() {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop) {
            desktop.MainWindow = new MainWindow { DataContext = new MailboxViewModel() };
            if (Program.SmokeTest) desktop.MainWindow.Opened += delegate {
                Avalonia.Threading.Dispatcher.UIThread.Post(() => {
                    var process = System.Diagnostics.Process.GetCurrentProcess();
                    long startup = Program.Startup.ElapsedMilliseconds, memory = process.WorkingSet64;
                    var cpu = process.TotalProcessorTime;
                    bool warmed = false;
                    var timer = new Avalonia.Threading.DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
                    timer.Tick += delegate {
                        if (!warmed) { warmed = true; process.Refresh(); cpu = process.TotalProcessorTime; timer.Interval = TimeSpan.FromSeconds(1); return; }
                        timer.Stop(); process.Refresh();
                        var evidence = new { Version = "0.17.0-preview.1", OS = System.Runtime.InteropServices.RuntimeInformation.OSDescription, Runtime = System.Runtime.InteropServices.RuntimeInformation.RuntimeIdentifier, Architecture = System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture.ToString(), NativeWindowOpened = true, StartupMilliseconds = startup, WorkingSetBytes = memory, IdleCpuMillisecondsOverOneSecond = (process.TotalProcessorTime - cpu).TotalMilliseconds, SampleMessages = ((MailboxViewModel)desktop.MainWindow.DataContext).Messages.Count };
                        File.WriteAllText("startup-evidence.json", System.Text.Json.JsonSerializer.Serialize(evidence, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
                        process.Dispose(); desktop.Shutdown(startup > 20000 || memory > 524288000 ? 1 : 0);
                    }; timer.Start();
                }, Avalonia.Threading.DispatcherPriority.ApplicationIdle);
            };
        }
        base.OnFrameworkInitializationCompleted();
    }
}
