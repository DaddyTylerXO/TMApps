using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Postbox;

class ProviderSetupTests {
    static int checks;
    static void Check(bool value, string message) { if (!value) throw new Exception(message); checks++; }
    static IEnumerable<T> Descendants<T>(DependencyObject parent) where T : DependencyObject {
        foreach (var item in LogicalTreeHelper.GetChildren(parent)) {
            var child = item as DependencyObject; if (child == null) continue;
            var element = child as UIElement; if (element != null && element.Visibility != Visibility.Visible) continue;
            if (child is T) yield return (T)child;
            foreach (var nested in Descendants<T>(child)) yield return nested;
        }
    }
    static string Name(DependencyObject item) { return System.Windows.Automation.AutomationProperties.GetName(item); }
    [STAThread] static void Main(string[] args) {
        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        string directory = Path.Combine(args[0], "provider-setup-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(directory);
        var config = new ProviderConfiguration();
        Check(!config.Ready("Microsoft") && !config.Ready("Gmail"), "Empty configuration pretended sign-in was ready");
        config.OutlookClientId = "00000000-0000-0000-0000-000000000000"; Check(!config.Ready("Microsoft"), "Empty GUID accepted");
        config.OutlookClientId = Guid.NewGuid().ToString(); config.GmailClientId = "123-test.apps.googleusercontent.com"; config.GmailDesktopClientSecret = "synthetic-desktop-secret";
        Check(config.Ready("Microsoft") && config.Ready("Gmail"), "Valid deployment configuration not recognized");
        var microsoft = ProviderChoices.Account("Microsoft"); microsoft.ClientId = config.OutlookClientId;
        var msal = typeof(ProviderLogin).GetMethod("MicrosoftClient", BindingFlags.NonPublic | BindingFlags.Static).Invoke(null, new object[] { microsoft });
        Check(msal != null, "Microsoft authentication dependency load");
        var gmail = ProviderChoices.Account("Gmail"); gmail.ClientId = config.GmailClientId; gmail.ClientSecret = config.GmailDesktopClientSecret;
        var google = (IDisposable)typeof(ProviderLogin).GetMethod("GoogleFlow", BindingFlags.NonPublic | BindingFlags.Static).Invoke(null, new object[] { gmail, false }); google.Dispose();
        Check(google != null, "Google PKCE authentication dependency load");
        Check(ProviderChoices.Account("iCloud").ImapHost == "imap.mail.me.com" && ProviderChoices.Account("iCloud").SmtpHost == "smtp.mail.me.com", "iCloud preset");
        gmail.AuthMethod = "OAuth"; gmail.Email = "test@gmail.com"; gmail.Validate(); Check(ProviderLogin.UsesOAuth(gmail), "Gmail OAuth incorrectly required a password");
        gmail.AuthMethod = null; gmail.Password = "app-password"; Check(!ProviderLogin.UsesOAuth(gmail), "Existing Gmail app password incorrectly switched authentication");
        foreach (string provider in ProviderChoices.Providers) {
            var settings = new SettingsStore(Path.Combine(directory, provider + ".json")); var welcome = new WelcomeWindow(settings, new Preferences(), true);
            Check(!Descendants<TextBox>(welcome).Any(), "Welcome still asks for an email or server fields");
            Check(Descendants<Button>(welcome).Count(b => Name(b).StartsWith("Sign in with ")) == 3, "Provider sign-in choices missing");
            string label = provider == "Other IMAP" ? ProviderChoices.Name(provider) : "Sign in with " + ProviderChoices.Name(provider);
            Descendants<Button>(welcome).Single(b => Name(b) == label).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Check(welcome.SelectedProvider == provider && welcome.Result != null && settings.Load().SetupCompleted, "Welcome did not route to the chosen provider");
        }
        var exploreSettings = new SettingsStore(Path.Combine(directory, "explore.json")); var explore = new WelcomeWindow(exploreSettings, new Preferences(), true);
        Descendants<Button>(explore).Single(b => b.Content as string == "Explore for now").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(explore.Result != null && explore.SelectedProvider == null, "Explore forced provider setup");
        MailAccount connected = null;
        Func<MailAccount, CancellationToken, Task> fake = delegate(MailAccount account, CancellationToken token) { connected = account; return Task.FromResult(0); };
        var setup = new AccountSetupWindow(null, new ProviderConfiguration(), fake, delegate { }, null);
        Check(!Descendants<TextBox>(setup).Any(), "Accounts picker exposed technical fields");
        setup.SelectProvider("Microsoft"); Check(!Descendants<TextBox>(setup).Any(), "Outlook still asks for client IDs or server settings");
        Check(Descendants<TextBlock>(setup).Any(t => t.Text.Contains("isn’t enabled")), "Unconfigured Outlook falsely offers working sign-in");
        setup.SelectProvider("Gmail"); Check(!Descendants<TextBox>(setup).Any(), "Gmail browser screen exposed server settings");
        setup.SelectProvider("iCloud");
        Check(Descendants<TextBox>(setup).Count() == 1 && Descendants<PasswordBox>(setup).Count() == 1, "iCloud should ask only for email and app password");
        setup.SelectProvider("Other IMAP"); Check(Descendants<TextBox>(setup).Count() == 6, "Advanced setup missing server controls");
        setup.ShowPicker(); Check(!Descendants<TextBox>(setup).Any(), "Back did not restore clean provider picker"); setup.Close();
        var cloud = new AccountSetupWindow(null, config, fake, delegate { }, "iCloud");
        Descendants<TextBox>(cloud).Single().Text = "test@icloud.com"; Descendants<PasswordBox>(cloud).Single().Password = "fake-app-password";
        Descendants<Button>(cloud).Single(b => b.Content as string == "Connect iCloud").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(cloud.Connected && connected != null && connected.Email == "test@icloud.com" && connected.ImapPort == 993 && connected.SmtpPort == 587, "Simple iCloud form did not connect using hidden presets");
        var failure = new TaskCompletionSource<int>(); failure.SetException(new MailKit.Security.SslHandshakeException(new string('x', 1200)));
        var failed = new AccountSetupWindow(null, config, delegate(MailAccount value, CancellationToken token) { return failure.Task; }, delegate { }, "iCloud");
        Descendants<TextBox>(failed).Single().Text = "test@icloud.com"; Descendants<PasswordBox>(failed).Single().Password = "fake-app-password";
        Descendants<Button>(failed).Single(b => b.Content as string == "Connect iCloud").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(!failed.Connected && Descendants<TextBlock>(failed).Any(t => t.Text.Contains("secure connection") && t.Text.Length < 200), "TLS failure did not show a concise message");
        Check(!Descendants<TextBox>(failed).Any(t => Name(t) == "Technical connection details"), "Long connection details expanded automatically");
        Descendants<Button>(failed).Single(b => b.Content as string == "Show connection details").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(Descendants<TextBox>(failed).Any(t => Name(t) == "Technical connection details" && t.IsReadOnly && t.Height == 140 && t.Text.Length > 1200), "Optional connection details were not bounded and readable");
        failed.ShowPicker(); Check(!Descendants<TextBox>(failed).Any(), "Back did not clear connection error details"); failed.Close();
        var ready = new AccountSetupWindow(null, config, fake, delegate { }, "Microsoft");
        Check(Descendants<Button>(ready).Any(b => b.Content as string == "Continue with Outlook") && !Descendants<TextBox>(ready).Any(), "Configured Outlook has no simple sign-in action"); ready.Close();
        var bundled = ProviderConfiguration.Load();
        if (bundled.Ready("Microsoft")) { var releaseSetup = new AccountSetupWindow(null, bundled, fake, delegate { }, "Microsoft"); Check(Descendants<Button>(releaseSetup).Any(b => b.Content as string == "Continue with Outlook") && !Descendants<TextBlock>(releaseSetup).Any(t => t.Text.Contains("Sign-in isn’t enabled")), "Bundled Outlook configuration did not enable sign-in"); releaseSetup.Close(); }
        Theme.SetMode("Light"); var light = new WelcomeWindow(exploreSettings, new Preferences(), true); light.Measure(new Size(820, 680)); light.Arrange(new Rect(0, 0, 820, 680));
        Check(light.DesiredSize.Width <= 820, "Provider chooser overflows in light mode"); light.Close();
        Console.WriteLine("Passed " + checks + " provider setup checks. No browser authentication or external mailbox operations were performed."); app.Shutdown();
    }
}
