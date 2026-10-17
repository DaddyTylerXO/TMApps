using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;

namespace Postbox {
    public static class ProviderChoices {
        public static readonly string[] Providers = { "Microsoft", "Gmail", "iCloud", "Other IMAP" };
        public static string Name(string provider) { return provider == "Microsoft" ? "Outlook" : provider == "Other IMAP" ? "Other Provider / Advanced Setup" : provider; }
        public static MailAccount Account(string provider) {
            return new MailAccount { Id = Guid.NewGuid().ToString("N"), Provider = provider, ImapHost = provider == "Microsoft" ? "outlook.office365.com" : provider == "Gmail" ? "imap.gmail.com" : provider == "iCloud" ? "imap.mail.me.com" : "", SmtpHost = provider == "Microsoft" ? "smtp-mail.outlook.com" : provider == "Gmail" ? "smtp.gmail.com" : provider == "iCloud" ? "smtp.mail.me.com" : "", ImapPort = 993, SmtpPort = 587 };
        }
        private static Brush Color(string hex) { return (Brush)new BrushConverter().ConvertFromString(hex); }
        private static void Shape(Canvas canvas, string geometry, string fill, string stroke, double thickness) { canvas.Children.Add(new System.Windows.Shapes.Path { Data = Geometry.Parse(geometry), Fill = fill == null ? null : Color(fill), Stroke = stroke == null ? null : Color(stroke), StrokeThickness = thickness, StrokeLineJoin = PenLineJoin.Round, StrokeStartLineCap = PenLineCap.Round, StrokeEndLineCap = PenLineCap.Round }); }
        public static FrameworkElement Logo(string provider) {
            var art = new Canvas { Width = 32, Height = 32 };
            if (provider == "Microsoft") {
                var back = new Border { Width = 23, Height = 25, CornerRadius = new CornerRadius(3), Background = Color("#28A8EA") }; Canvas.SetLeft(back, 9); Canvas.SetTop(back, 3); art.Children.Add(back);
                Shape(art, "M12,10 L30,10 L30,28 L12,28 Z", "#1479C5", null, 0); Shape(art, "M12,13 L22,21 L31,13", null, "#78D2FA", 1.6);
                var tile = new Border { Width = 22, Height = 23, CornerRadius = new CornerRadius(3), Background = Color("#0767B8"), Child = new TextBlock { Text = "O", FontFamily = new FontFamily("Segoe UI"), FontSize = 19, FontWeight = FontWeights.SemiBold, Foreground = Brushes.White, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } }; Canvas.SetTop(tile, 7); art.Children.Add(tile);
            } else if (provider == "Gmail") {
                Shape(art, "M4,26 L4,8 L16,17 L28,8 L28,26", null, "#EA4335", 5);
                Shape(art, "M4,26 L4,12", null, "#4285F4", 5); Shape(art, "M28,26 L28,12", null, "#34A853", 5);
                Shape(art, "M4,12 L4,8 L9,12", null, "#C5221F", 5); Shape(art, "M23,12 L28,8 L28,12", null, "#FBBC04", 5);
            } else if (provider == "iCloud") {
                var cloud = new System.Windows.Shapes.Path { Data = Geometry.Parse("M8,26 C0,26 0,14 8,14 C9,4 23,3 25,13 C35,12 36,26 27,26 Z"), Fill = new LinearGradientBrush((Color)ColorConverter.ConvertFromString("#6ED7FC"), (Color)ColorConverter.ConvertFromString("#247BEF"), 90) }; art.Children.Add(cloud);
            } else Shape(art, "M3,8 L29,8 L29,25 L3,25 Z M3,9 L16,19 L29,9", null, "#A9B0C0", 2);
            return new Viewbox { Width = 32, Height = 32, Child = art, Margin = new Thickness(0, 0, 16, 0) };
        }
        public static Button Button(string provider, Action chosen) {
            string label = provider == "Other IMAP" ? Name(provider) : "Sign in with " + Name(provider);
            var content = new DockPanel { LastChildFill = true }; content.Children.Add(Logo(provider));
            var arrow = new TextBlock { Text = "›", FontSize = 23, Foreground = Theme.B("Muted"), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(12, 0, 0, 0) }; DockPanel.SetDock(arrow, Dock.Right); content.Children.Add(arrow);
            content.Children.Add(new TextBlock { Text = label, FontSize = 14, FontWeight = FontWeights.SemiBold, Foreground = Theme.B("Text"), VerticalAlignment = VerticalAlignment.Center });
            var button = new Button { Content = content, HorizontalContentAlignment = HorizontalAlignment.Stretch, Background = Theme.B("Raised"), Padding = new Thickness(18, 13, 18, 13), Margin = new Thickness(0, 0, 0, 10), MinHeight = 58, Cursor = Cursors.Hand };
            System.Windows.Automation.AutomationProperties.SetName(button, label); button.Click += delegate { chosen(); }; return button;
        }
        public static StackPanel Picker(Action<string> selected) {
            var panel = new StackPanel(); foreach (var provider in Providers) { string choice = provider; panel.Children.Add(Button(provider, delegate { selected(choice); })); } return panel;
        }
    }

    public sealed class AccountSetupWindow : Window {
        private readonly MailAccount current;
        private readonly string[] launcherEmails;
        private readonly ProviderConfiguration configuration;
        private readonly Func<MailAccount, CancellationToken, Task> connect;
        private readonly Action disconnect;
        private readonly StackPanel form;
        private readonly TextBlock status;
        private readonly Button detailsButton;
        private readonly TextBox connectionDetails;
        private readonly Button back;
        private CancellationTokenSource cancellation;
        private bool busy, closeAfterCancel;
        public string SelectedProvider { get; private set; }
        public bool Connected { get; private set; }
        public AccountSetupWindow(MailAccount existing, ProviderConfiguration config, Func<MailAccount, CancellationToken, Task> connection, Action remove, string initialProvider, System.Collections.Generic.IEnumerable<string> suggestedEmails = null) {
            launcherEmails=(suggestedEmails ?? new string[0]).ToArray();
            current = existing; configuration = config; connect = connection; disconnect = remove;
            Title = "Add an account · TMA-Mail"; Width = 610; Height = 690; MinWidth = 500; MinHeight = 560; MaxHeight = Math.Max(560, SystemParameters.WorkArea.Height - 30); WindowStartupLocation = WindowStartupLocation.CenterOwner; ShowInTaskbar = true; Theme.Install(this); Background = Theme.B("Canvas");
            var root = new DockPanel { Margin = new Thickness(30, 22, 30, 24), MaxWidth = 500, HorizontalAlignment = HorizontalAlignment.Center }; Content = root;
            var heading = new DockPanel { Margin = new Thickness(0, 0, 0, 18) }; DockPanel.SetDock(heading, Dock.Top); root.Children.Add(heading);
            back = new Button { Content = "‹  Back", Padding = new Thickness(12, 8, 12, 8), HorizontalAlignment = HorizontalAlignment.Left }; back.Click += delegate { ShowPicker(); }; heading.Children.Add(back);
            heading.Children.Add(new TextBlock { Text = "TMA-Mail", FontSize = 12, Foreground = Theme.B("Muted"), VerticalAlignment = VerticalAlignment.Center, HorizontalAlignment = HorizontalAlignment.Right });
            var footer = new StackPanel { Margin = new Thickness(0, 14, 0, 0) }; DockPanel.SetDock(footer, Dock.Bottom); root.Children.Add(footer);
            status = new TextBlock { TextWrapping = TextWrapping.Wrap, Foreground = Theme.B("Muted"), FontSize = 12, MaxHeight = 72, TextTrimming = TextTrimming.CharacterEllipsis, Margin = new Thickness(0, 0, 0, 10) }; footer.Children.Add(status);
            connectionDetails = new TextBox { IsReadOnly = true, TextWrapping = TextWrapping.Wrap, Height = 140, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Margin = new Thickness(0, 4, 0, 10), Visibility = Visibility.Collapsed };
            System.Windows.Automation.AutomationProperties.SetName(connectionDetails, "Technical connection details");
            detailsButton = new Button { Content = "Show connection details", HorizontalAlignment = HorizontalAlignment.Left, Padding = new Thickness(10, 6, 10, 6), Margin = new Thickness(0, 0, 0, 8), Visibility = Visibility.Collapsed };
            detailsButton.Click += delegate { bool show = connectionDetails.Visibility != Visibility.Visible; connectionDetails.Visibility = show ? Visibility.Visible : Visibility.Collapsed; detailsButton.Content = show ? "Hide connection details" : "Show connection details"; }; footer.Children.Add(detailsButton); footer.Children.Add(connectionDetails);
            var cancel = new Button { Content = "Cancel", HorizontalAlignment = HorizontalAlignment.Right, Padding = new Thickness(18, 8, 18, 8) }; cancel.Click += delegate { Close(); }; footer.Children.Add(cancel);
            form = new StackPanel(); root.Children.Add(new ScrollViewer { Content = form, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled });
            Closing += delegate(object sender, System.ComponentModel.CancelEventArgs args) { if (busy) { closeAfterCancel = true; cancellation.Cancel(); status.Text = "Cancelling sign-in…"; args.Cancel = true; } };
            if (initialProvider == null) ShowPicker(); else SelectProvider(initialProvider);
        }
        private void Heading(string title, string subtitle) {
            form.Children.Clear(); status.Text = ""; ClearConnectionDetails();
            form.Children.Add(new TextBlock { Text = title, FontSize = 26, FontWeight = FontWeights.SemiBold, Foreground = Theme.B("Text"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 6, 0, 12) });
            form.Children.Add(new TextBlock { Text = subtitle, FontSize = 13, Foreground = Theme.B("Muted"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 24) });
        }
        private void AddAction(string label, Action action, bool primary) {
            var button = new Button { Content = label, Padding = new Thickness(18, 12, 18, 12), Margin = new Thickness(0, 12, 0, 0), HorizontalContentAlignment = HorizontalAlignment.Center };
            if (primary) { button.Background = Theme.B("Accent"); button.Foreground = Brushes.White; }
            button.Click += delegate { try { action(); } catch (Exception ex) { status.Text = ex.Message; } }; form.Children.Add(button);
        }
        public void ShowPicker() {
            if (busy) return; SelectedProvider = null; back.Visibility = Visibility.Hidden;
            Heading(current == null ? "Add your email" : "Your connected account", current == null ? "Choose your provider. We’ll take care of the settings." : current.Email + "\nYou can reconnect or choose a different provider.");
            if(launcherEmails.Length>0) form.Children.Add(new TextBlock { Text="From TMApps Launcher: "+String.Join(", ",launcherEmails)+". Choose a provider to connect an address. Your app-specific password or provider sign-in is still required.",TextWrapping=TextWrapping.Wrap,Foreground=Theme.B("Muted"),Margin=new Thickness(0,0,0,14) });
            form.Children.Add(ProviderChoices.Picker(SelectProvider));
            if (current != null) AddAction("Disconnect " + current.Email, delegate { disconnect(); Close(); }, false);
        }
        public void SelectProvider(string provider) {
            if (busy) return; SelectedProvider = provider; back.Visibility = Visibility.Visible;
            if (provider == "Other IMAP") { ShowAdvanced(); return; }
            if (provider == "iCloud") { ShowPassword(provider); return; }
            Heading("Sign in with " + ProviderChoices.Name(provider), "Your browser will open the official sign-in page. TMA-Mail never sees your account password.");
            form.Children.Add(ProviderChoices.Logo(provider));
            if (!configuration.Ready(provider)) {
                form.Children.Add(new TextBlock { Text = "Sign-in isn’t enabled in this build yet. The app owner needs to finish the provider setup before you can connect.", TextWrapping = TextWrapping.Wrap, Foreground = Theme.B("Muted"), Margin = new Thickness(0, 22, 0, 0), FontSize = 13 });
                AddAction("View provider setup guide", OpenGuide, false);
            } else AddAction("Continue with " + ProviderChoices.Name(provider), async delegate { await RunConnection(async delegate(CancellationToken token) { var account = ProviderChoices.Account(provider); await ProviderLogin.SignIn(account, configuration, token); return account; }); }, true);
            if (provider == "Gmail") AddAction("Use a Google app password instead", delegate { ShowPassword("Gmail"); }, false);
        }
        private static void OpenGuide() { Process.Start(new ProcessStartInfo(System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SETUP.md")) { UseShellExecute = true }); }
        private TextBox Field(string label, string value) {
            form.Children.Add(new TextBlock { Text = label, FontSize = 12, Foreground = Theme.B("Text"), Margin = new Thickness(0, 12, 0, 6) });
            var input = new TextBox { Text = value ?? "", Padding = new Thickness(12, 10, 12, 10) }; System.Windows.Automation.AutomationProperties.SetName(input, label); form.Children.Add(input); return input;
        }
        private PasswordBox Password(bool appleHelp = false) {
            var label = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 16, 0, 6) };
            label.Children.Add(new TextBlock { Text = "App-specific password", FontSize = 12, Foreground = Theme.B("Text"), VerticalAlignment = VerticalAlignment.Center }); form.Children.Add(label);
            if (appleHelp) {
                var instructions = new StackPanel();
                instructions.Children.Add(new TextBlock { Text = "Create an Apple app-specific password", FontSize = 13, FontWeight = FontWeights.SemiBold, Foreground = Theme.B("Text"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 8) });
                instructions.Children.Add(new TextBlock { Text = "1. Sign in at account.apple.com.\n2. Open Sign-In and Security → App-Specific Passwords.\n3. Choose Generate an app-specific password and follow Apple’s instructions.\n4. Paste the generated password into TMA-Mail below.\n\nYour Apple Account needs two-factor authentication. Use the generated password here, rather than your usual Apple Account password.", FontSize = 12, Foreground = Theme.B("Muted"), TextWrapping = TextWrapping.Wrap });
                var guide = new Button { Content = "Read Apple’s step-by-step guide ↗", HorizontalAlignment = HorizontalAlignment.Left, Padding = new Thickness(12, 8, 12, 8), Margin = new Thickness(0, 10, 0, 0), ToolTip = "https://support.apple.com/en-gb/102654" };
                guide.Click += delegate { try { Process.Start("https://support.apple.com/en-gb/102654"); } catch (Exception ex) { status.Text = "The guide could not be opened: " + ex.Message; } }; instructions.Children.Add(guide);
                var help = new Border { Child = instructions, Background = Theme.B("Raised"), CornerRadius = new CornerRadius(12), Padding = new Thickness(14), Margin = new Thickness(0, 2, 0, 10), Visibility = Visibility.Collapsed }; form.Children.Add(help);
                var question = new Button { Content = "?", Width = 24, Height = 24, MinHeight = 0, FontSize = 12, FontWeight = FontWeights.Bold, Padding = new Thickness(0), Margin = new Thickness(8, 0, 0, 0), ToolTip = "How to create an Apple app-specific password" };
                System.Windows.Automation.AutomationProperties.SetName(question, "Help creating an Apple app-specific password");
                question.Click += delegate { help.Visibility = help.Visibility == Visibility.Visible ? Visibility.Collapsed : Visibility.Visible; }; label.Children.Add(question);
            }
            var password = new PasswordBox { Padding = new Thickness(12, 10, 12, 10), Background = Theme.B("Surface"), Foreground = Theme.B("Text"), BorderBrush = Theme.B("Borders") }; System.Windows.Automation.AutomationProperties.SetName(password, "App-specific password"); form.Children.Add(password); return password;
        }
        private TextBox EmailField(string currentEmail) {
            var email=Field("Email address",currentEmail ?? launcherEmails.FirstOrDefault() ?? "");
            if(launcherEmails.Length>0) {
                var suggestions=new ComboBox { ItemsSource=launcherEmails,SelectedIndex=-1,Margin=new Thickness(0,8,0,12),ToolTip="Email addresses saved in TMApps Launcher" };
                System.Windows.Automation.AutomationProperties.SetName(suggestions,"TMApps Launcher email suggestions");
                suggestions.SelectionChanged+=delegate { if(suggestions.SelectedItem!=null) email.Text=(string)suggestions.SelectedItem; };
                form.Children.Add(suggestions);
            }
            return email;
        }
        private void ShowPassword(string provider) {
            SelectedProvider = provider;
            Heading("Sign in with " + ProviderChoices.Name(provider), provider == "iCloud" ? "Enter your iCloud Mail address and an app-specific password from Apple. Your server settings are filled in automatically." : "Use a Google app password with 2-Step Verification. Your Gmail settings are already filled in.");
            var email = EmailField(current != null && current.Provider == provider ? current.Email : null); var password = Password(provider == "iCloud");
            AddAction(provider == "iCloud" ? "Get an app-specific password from Apple ↗" : "Get a Google app password ↗", delegate { Process.Start(provider == "iCloud" ? "https://account.apple.com/" : "https://myaccount.google.com/apppasswords"); }, false);
            AddAction("Connect " + ProviderChoices.Name(provider), async delegate { await RunConnection(delegate(CancellationToken token) { var value = ProviderChoices.Account(provider); value.Email = email.Text.Trim(); value.Password = password.Password.Replace(" ", ""); value.Validate(); return Task.FromResult(value); }); }, true);
        }
        private void ShowAdvanced() {
            Heading("Advanced setup", "For other email providers. Use the server settings supplied by your email service.");
            var email = EmailField(null); var user = Field("Username (optional)", ""); var password = Password();
            var imap = Field("Incoming IMAP server", ""); var imapPort = Field("IMAP port", "993"); var smtp = Field("Outgoing SMTP server", ""); var smtpPort = Field("SMTP port", "587");
            AddAction("Connect account", async delegate { await RunConnection(delegate(CancellationToken token) {
                int incoming, outgoing; if (!Int32.TryParse(imapPort.Text, out incoming) || !Int32.TryParse(smtpPort.Text, out outgoing)) throw new ArgumentException("Enter valid port numbers.");
                var value = ProviderChoices.Account("Other IMAP"); value.Email = email.Text.Trim(); value.UserName = user.Text.Trim(); value.Password = password.Password; value.ImapHost = imap.Text.Trim(); value.ImapPort = incoming; value.SmtpHost = smtp.Text.Trim(); value.SmtpPort = outgoing; value.SmtpSsl = outgoing == 465; value.Validate(); return Task.FromResult(value);
            }); }, true);
        }
        private async Task RunConnection(Func<CancellationToken, Task<MailAccount>> prepare) {
            if (busy) return; busy = true; closeAfterCancel = false; form.IsEnabled = false; back.IsEnabled = false;
            ClearConnectionDetails();
            cancellation = new CancellationTokenSource(); cancellation.CancelAfter(TimeSpan.FromMinutes(5));
            status.Text = "Finish signing in, then we’ll connect your mailbox…";
            try { var value = await prepare(cancellation.Token); cancellation.Token.ThrowIfCancellationRequested(); value.Validate(); status.Text = "Connecting your mailbox…"; await connect(value, cancellation.Token); Connected = true; busy = false; Close(); }
            catch (OperationCanceledException) { status.Text = "Sign-in cancelled. You can try again whenever you’re ready."; }
            catch (Microsoft.Identity.Client.MsalException) { status.Text = "Outlook couldn’t finish signing in. Try again, or check the provider setup guide."; }
            catch (MailKit.Security.SslHandshakeException ex) { ConnectionError("We couldn’t establish a secure connection. Check Windows date/time and your network, then try again. Connection details are available below.", ex); }
            catch (MailKit.Security.AuthenticationException ex) { ConnectionError("Your email provider couldn’t verify the sign-in. Check the email address and app-specific password, or sign in again.", ex); }
            catch (Exception ex) { string reason = ex.Message.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "Please try again."; if (reason.Length > 180) reason = reason.Substring(0, 180) + "…"; ConnectionError("We couldn’t connect: " + reason, ex); }
            finally { busy = false; cancellation.Dispose(); cancellation = null; form.IsEnabled = true; back.IsEnabled = true; if (closeAfterCancel && !Connected) Close(); }
        }
        private void ClearConnectionDetails() { detailsButton.Visibility = Visibility.Collapsed; detailsButton.Content = "Show connection details"; connectionDetails.Visibility = Visibility.Collapsed; connectionDetails.Text = ""; }
        private void ConnectionError(string message, Exception error) {
            status.Text = message; var details = new System.Text.StringBuilder();
            for (var currentError = error; currentError != null; currentError = currentError.InnerException) details.AppendLine(currentError.GetType().Name + ": " + currentError.Message);
            connectionDetails.Text = details.ToString(); detailsButton.Visibility = Visibility.Visible;
        }
    }
}
