using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;

namespace Postbox {
    public partial class App {
        private bool showAfterWelcome;
        private async void StartDesktop(object sender, StartupEventArgs args) {
            StartupSplash splash = null;
            var cancellation = new CancellationTokenSource();
            bool handoff = false;
            try {
                splash = new StartupSplash(); MainWindow = splash;
                AppBrand.Apply(splash);
                splash.Closed += delegate {
                    if (!handoff) { cancellation.Cancel(); exiting = true; if (window != null) window.Close(); Shutdown(); }
                };
                splash.Show();
                if (args.Args.Contains("--splash-preview")) return;
                var elapsed = Stopwatch.StartNew();
                await Task.Delay(70, cancellation.Token);
                splash.SetStage("Preparing your workspace…");
                Initialize();
                cancellation.Token.ThrowIfCancellationRequested();
                bool welcomeNeeded = !preferences.SetupCompleted || args.Args.Contains("--setup");
                splash.SetStage(welcomeNeeded ? "Getting your welcome screen ready…" : "Your workspace is ready");
                int remaining = 1750 - (int)elapsed.ElapsedMilliseconds;
                if (remaining > 0) await Task.Delay(remaining, cancellation.Token);
                cancellation.Token.ThrowIfCancellationRequested();
                handoff = true;
                if (welcomeNeeded) {
                    var welcome = new WelcomeWindow(settingsStore, preferences, true);
                    MainWindow = welcome;
                    // Keep a real message loop during setup without showing the mailbox behind it.
                    var completion = new TaskCompletionSource<bool>();
                    welcome.Closed += delegate { completion.TrySetResult(welcome.Result != null); };
                    welcome.Show(); splash.Close();
                    bool completed = await completion.Task;
                    if (!completed) { exiting = true; window.Close(); Shutdown(); return; }
                    preferences = welcome.Result; showAfterWelcome = true; ApplyPreferences();
                } else splash.Close();
                MainWindow = window; ShutdownMode = ShutdownMode.OnMainWindowClose;
                window.Show();
                StartMailConnection();
                if (!preferences.StartMinimized || showAfterWelcome) window.Activate();
            } catch (OperationCanceledException) { }
            catch (Exception ex) {
                handoff = true; if (splash != null && splash.IsVisible) splash.Close();
                exiting = true; if (window != null) window.Close();
                MessageBox.Show("TMA-Mail could not start.\n\n" + ex.Message, "TMA-Mail", MessageBoxButton.OK, MessageBoxImage.Error); Shutdown(1);
            } finally {
                // The preview splash keeps this source alive until its Close callback runs.
                if (!args.Args.Contains("--splash-preview")) cancellation.Dispose();
            }
        }
    }

    public class MailTree : Canvas {
        private readonly List<Action> stop = new List<Action>();
        public MailTree(bool animated) {
            Width = 340; Height = 240;
            var ground = new Ellipse { Width = 170, Height = 14, Fill = ColorBrush("#14271E") }; SetLeft(ground, 85); SetTop(ground, 219); Children.Add(ground);
            var trunk = new Path { Data = Geometry.Parse("M153,221 C160,189 157,162 159,124 L169,124 C169,162 167,190 180,221 Z M163,165 L128,133 L132,127 L165,150 M166,147 L202,117 L206,124 L166,163"), Fill = ColorBrush("#A19074") }; Children.Add(trunk);
            var canopy = new Canvas { Width = 340, Height = 175, RenderTransformOrigin = new Point(0.5, 1) }; Children.Add(canopy);
            Leaf(canopy, 65, 78, 88, "#265F44"); Leaf(canopy, 107, 38, 100, "#347B54"); Leaf(canopy, 174, 58, 92, "#286B49"); Leaf(canopy, 129, 85, 100, "#3B895D"); Leaf(canopy, 205, 104, 62, "#327953");
            var highlight = new Ellipse { Width = 28, Height = 12, Fill = ColorBrush("#69AA7E"), Opacity = 0.45, RenderTransform = new RotateTransform(-24) }; SetLeft(highlight, 135); SetTop(highlight, 59); canopy.Children.Add(highlight);
            for (int i = 0; i < 5; i++) {
                var envelope = Envelope(); SetLeft(envelope, new[] { 91.0, 213, 127, 191, 156 }[i]); SetTop(envelope, new[] { 112.0, 121, 80, 86, 115 }[i]); Children.Add(envelope);
                var movement = new TranslateTransform(); var rotation = new RotateTransform(-10 + i * 4); var transforms = new TransformGroup(); transforms.Children.Add(rotation); transforms.Children.Add(movement); envelope.RenderTransform = transforms; envelope.RenderTransformOrigin = new Point(0.5, 0.5);
                if (animated && SystemParameters.ClientAreaAnimation) {
                    int index = i;
                    Loaded += delegate {
                        var duration = TimeSpan.FromSeconds(1.75); var delay = TimeSpan.FromMilliseconds(index * 310);
                        movement.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(0, 112, duration) { BeginTime = delay, RepeatBehavior = RepeatBehavior.Forever, EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn } });
                        movement.BeginAnimation(TranslateTransform.XProperty, new DoubleAnimation(0, index % 2 == 0 ? 17 : -19, duration) { BeginTime = delay, RepeatBehavior = RepeatBehavior.Forever });
                        rotation.BeginAnimation(RotateTransform.AngleProperty, new DoubleAnimation(-12, 20, duration) { BeginTime = delay, RepeatBehavior = RepeatBehavior.Forever });
                        var fade = new DoubleAnimationUsingKeyFrames { BeginTime = delay, Duration = duration, RepeatBehavior = RepeatBehavior.Forever };
                        fade.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromTimeSpan(TimeSpan.Zero))); fade.KeyFrames.Add(new LinearDoubleKeyFrame(1, KeyTime.FromTimeSpan(TimeSpan.FromSeconds(0.16)))); fade.KeyFrames.Add(new LinearDoubleKeyFrame(1, KeyTime.FromTimeSpan(TimeSpan.FromSeconds(1.3)))); fade.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromTimeSpan(duration))); envelope.BeginAnimation(OpacityProperty, fade);
                    };
                    stop.Add(delegate { movement.BeginAnimation(TranslateTransform.YProperty, null); movement.BeginAnimation(TranslateTransform.XProperty, null); rotation.BeginAnimation(RotateTransform.AngleProperty, null); envelope.BeginAnimation(OpacityProperty, null); });
                } else envelope.Opacity = i < 3 ? 0.9 : 0;
            }
            if (animated && SystemParameters.ClientAreaAnimation) {
                var sway = new RotateTransform(); canopy.RenderTransform = sway;
                Loaded += delegate { sway.BeginAnimation(RotateTransform.AngleProperty, new DoubleAnimation(-1.5, 1.5, TimeSpan.FromSeconds(1.2)) { AutoReverse = true, RepeatBehavior = RepeatBehavior.Forever }); };
                stop.Add(delegate { sway.BeginAnimation(RotateTransform.AngleProperty, null); });
            }
            Unloaded += delegate { foreach (var action in stop) action(); };
        }
        private static void Leaf(Canvas canvas, double x, double y, double size, string color) { var leaf = new Ellipse { Width = size, Height = size * 0.83, Fill = ColorBrush(color) }; SetLeft(leaf, x); SetTop(leaf, y); canvas.Children.Add(leaf); }
        private static Border Envelope() { var canvas = new Canvas { Width = 28, Height = 21 }; var flap = new Path { Data = Geometry.Parse("M3,5 L14,12 L25,5 M3,18 L10,11 M25,18 L18,11"), Stroke = ColorBrush("#478260"), StrokeThickness = 1.3, StrokeLineJoin = PenLineJoin.Round }; canvas.Children.Add(flap); return new Border { Width = 28, Height = 21, CornerRadius = new CornerRadius(4), Background = ColorBrush("#F4EEDB"), Child = canvas }; }
        internal static Brush ColorBrush(string value) { return (Brush)new BrushConverter().ConvertFromString(value); }
    }

    public class StartupSplash : Window {
        private readonly TextBlock status;
        public StartupSplash() {
            Title = "TMA-Mail · Starting"; Width = 590; Height = 395; WindowStartupLocation = WindowStartupLocation.CenterScreen; WindowStyle = WindowStyle.None; ResizeMode = ResizeMode.NoResize; AllowsTransparency = true; Background = Brushes.Transparent; FontFamily = new FontFamily("Segoe UI");
            var card = new Border { CornerRadius = new CornerRadius(22), BorderThickness = new Thickness(1), BorderBrush = MailTree.ColorBrush("#2B4636"), Background = new LinearGradientBrush((Color)ColorConverter.ConvertFromString("#10281B"), (Color)ColorConverter.ConvertFromString("#141B17"), 90), Padding = new Thickness(26, 20, 26, 22) }; Content = card;
            var root = new Grid(); card.Child = root; root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            var heading = new DockPanel(); root.Children.Add(heading);
            var close = new Button { Content = "×", FontSize = 21, Foreground = MailTree.ColorBrush("#A8BCAD"), Background = Brushes.Transparent, BorderThickness = new Thickness(0), Width = 28, Height = 28, ToolTip = "Cancel startup", Cursor = Cursors.Hand }; close.Click += delegate { Close(); }; DockPanel.SetDock(close, Dock.Right); heading.Children.Add(close);
            heading.Children.Add(new TextBlock { Text = "TMA-Mail", FontSize = 18, FontWeight = FontWeights.SemiBold, Foreground = MailTree.ColorBrush("#E7F0E9"), VerticalAlignment = VerticalAlignment.Center });
            var art = new StackPanel { VerticalAlignment = VerticalAlignment.Center }; Grid.SetRow(art, 1); root.Children.Add(art); art.Children.Add(new Viewbox { Width = 310, Height = 219, Child = new MailTree(true) });
            art.Children.Add(new TextBlock { Text = "A home for your conversations", HorizontalAlignment = HorizontalAlignment.Center, Foreground = MailTree.ColorBrush("#A1B6A6"), FontSize = 12, Margin = new Thickness(0, 6, 0, 0) });
            var footer = new StackPanel(); Grid.SetRow(footer, 2); root.Children.Add(footer); status = new TextBlock { Text = "Starting TMA-Mail…", Foreground = MailTree.ColorBrush("#C2D1C6"), FontSize = 11, Margin = new Thickness(0, 0, 0, 12) }; footer.Children.Add(status);
            var progress = new Border { Height = 3, Background = MailTree.ColorBrush("#293E30"), CornerRadius = new CornerRadius(2), ClipToBounds = true }; var track = new Canvas(); progress.Child = track; var light = new Border { Width = 100, Height = 3, CornerRadius = new CornerRadius(2), Background = MailTree.ColorBrush("#68B083") }; track.Children.Add(light); footer.Children.Add(progress);
            Loaded += delegate { if (SystemParameters.ClientAreaAnimation) light.BeginAnimation(Canvas.LeftProperty, new DoubleAnimation(-100, 540, TimeSpan.FromSeconds(1.6)) { RepeatBehavior = RepeatBehavior.Forever }); };
            Closed += delegate { light.BeginAnimation(Canvas.LeftProperty, null); };
            card.MouseLeftButtonDown += delegate(object sender, MouseButtonEventArgs e) { if (e.ChangedButton == MouseButton.Left && !(e.OriginalSource is Button)) DragMove(); };
        }
        public void SetStage(string text) { status.Text = text; }
    }

    public class WelcomeWindow : Window {
        private readonly TextBox email;
        private readonly TextBlock error;
        public Preferences Result { get; private set; }
        public WelcomeWindow(SettingsStore store, Preferences current, bool firstRun) {
            Title = firstRun ? "Welcome to TMA-Mail" : "Email profile · TMA-Mail"; Width = 790; Height = 560; MinWidth = 740; MinHeight = 540; WindowStartupLocation = WindowStartupLocation.CenterScreen; FontFamily = new FontFamily("Segoe UI"); Theme.Install(this);
            var grid = new Grid(); Content = grid; grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(260) }); grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            var forest = new Border { Background = Theme.B("#14243E"), Padding = new Thickness(18, 30, 18, 24) }; grid.Children.Add(forest);
            var illustration = new StackPanel { VerticalAlignment = VerticalAlignment.Center }; forest.Child = illustration;
            illustration.Children.Add(new TextBlock { Text = "TMA-Mail", Foreground = Brushes.White, FontWeight = FontWeights.SemiBold, FontSize = 24, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 25) });
            illustration.Children.Add(new Viewbox { Width = 220, Height = 175, Child = new MailTree(false) });
            illustration.Children.Add(new TextBlock { Text = "Your mail.\nYour space.", FontSize = 21, Foreground = MailTree.ColorBrush("#E1EEE5"), TextAlignment = TextAlignment.Center, Margin = new Thickness(0, 23, 0, 0) });
            var right = new Grid { Margin = new Thickness(32, 32, 32, 26) }; Grid.SetColumn(right, 1); grid.Children.Add(right); right.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); right.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            var form = new StackPanel { VerticalAlignment = VerticalAlignment.Center }; right.Children.Add(form);
            form.Children.Add(new TextBlock { Text = firstRun ? "LET’S GET STARTED" : "YOUR EMAIL PROFILE", FontSize = 10, FontWeight = FontWeights.SemiBold, Foreground = Theme.B("#8793A7"), Margin = new Thickness(0, 0, 0, 14) });
            form.Children.Add(new TextBlock { Text = firstRun ? "Welcome to TMA-Mail" : "Add your email address", FontSize = 27, FontWeight = FontWeights.SemiBold, Foreground = Theme.B("Text"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 14) });
            form.Children.Add(new TextBlock { Text = "Save an email address to your profile, or explore the application first.", FontSize = 13, Foreground = Theme.B("#8793A7"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 26) });
            form.Children.Add(new TextBlock { Text = "Email address", FontSize = 12, Foreground = Theme.B("Text"), Margin = new Thickness(0, 0, 0, 8) });
            email = new TextBox { Text = current.EmailAddress ?? "", FontSize = 15, Padding = new Thickness(13, 12, 13, 12), ToolTip = "you@example.com" }; System.Windows.Automation.AutomationProperties.SetName(email, "Email address"); form.Children.Add(email);
            error = new TextBlock { Foreground = Theme.B("#BC4343"), FontSize = 11, TextWrapping = TextWrapping.Wrap, MinHeight = 28, Margin = new Thickness(0, 8, 0, 4) }; form.Children.Add(error);
            var save = new Button { Content = "Continue to account setup  →", IsDefault = true, Background = Theme.B("#4D83F5"), Foreground = Brushes.White, Padding = new Thickness(14, 12, 14, 12), Margin = new Thickness(0, 0, 0, 9) };
            var skip = new Button { Content = "Explore for now", Padding = new Thickness(14, 12, 14, 12) }; form.Children.Add(save); form.Children.Add(skip);
            Action<bool> complete = delegate(bool addAddress) {
                try { Result = WelcomeFlow.Complete(store, current, addAddress, email.Text); Close(); }
                catch (FormatException) { error.Text = "Check your email address, or choose Explore for now."; email.Focus(); }
                catch (Exception ex) { error.Text = "Your profile could not be saved. " + ex.Message; }
            };
            save.Click += delegate { complete(true); }; skip.Click += delegate { complete(false); };
            var note = new TextBlock { Text = "Connect an account next to send and receive mail, or explore with sample messages.", FontSize = 10, Foreground = Theme.B("#8793A7"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 22, 0, 0) }; Grid.SetRow(note, 1); right.Children.Add(note);
            Loaded += delegate { email.Focus(); email.CaretIndex = email.Text.Length; };
        }
    }
}
