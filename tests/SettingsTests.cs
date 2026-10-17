using System;
using System.IO;
using Postbox;

class SettingsTests {
    static int checks;
    static void Check(bool condition, string detail) { if (!condition) throw new Exception(detail); checks++; }
    static void Main(string[] args) {
        string path = Path.Combine(args[0], Guid.NewGuid().ToString(), "settings.json");
        var store = new SettingsStore(path);
        var settings = store.Load();
        Check(settings.SpellCheckEnabled && settings.SpellLanguage == "en-GB", "Default spellchecker");
        Check(!settings.LaunchWithWindows && !settings.CloseToTray, "Opt-in startup and tray");
        Check(!settings.CalendarReminderDesktop && settings.CalendarReminderSound == "Cozy", "Calendar desktop reminders opt-in and cozy sound default");
        Check(settings.AppearanceMode == "Dark", "Dark mode default");
        settings.AppearanceMode = "Light"; settings.FavouriteFolders = new System.Collections.Generic.List<string> { "Inbox", "Archive", "Archive", "invalid" }; settings.ComposeFont = "Georgia"; settings.ComposeFontSize = 18;
        settings.DisplayName = "  Test Person  "; settings.Signature = "Kind regards,\nTest Person ✓";
        settings.NavigationEdge = "Bottom"; settings.NavigationCollapsed = true;
        settings.SendSound = "Custom WAV"; settings.SendWavePath = "C:\\Sounds\\send.wav";
        settings.CalendarReminderSound = "Custom WAV"; settings.CalendarReminderWavePath = "C:\\Sounds\\reminder.wav";
        settings.ReceiveSound = "None"; settings.StartupFolder = "Drafts";
        settings.NotificationAddress = false; settings.NotificationSubject = false; settings.UnreadBadge = false;
        store.Save(settings); var loaded = store.Load();
        Check(loaded.DisplayName == "Test Person", "Name saved and trimmed");
        Check(loaded.Signature == settings.Signature, "Unicode signature persisted");
        Check(loaded.NavigationEdge == "Bottom" && loaded.NavigationCollapsed, "Layout persisted");
        Check(loaded.SendSound == "Custom WAV" && loaded.SendWavePath == settings.SendWavePath && loaded.ReceiveSound == "None", "Independent sounds persisted");
        Check(loaded.CalendarReminderSound == "Custom WAV" && loaded.CalendarReminderWavePath == settings.CalendarReminderWavePath, "Calendar reminder sound persisted independently");
        Check(loaded.StartupFolder == "Drafts", "Startup folder persisted");
        Check(!loaded.NotificationAddress && !loaded.NotificationSubject && !loaded.UnreadBadge, "Notification privacy and badge preferences persisted");
        Check(loaded.AppearanceMode == "Light" && loaded.FavouriteFolders.Count == 2 && loaded.FavouriteFolders.Contains("Archive"), "Theme and favourites persisted and normalized");
        Check(loaded.ComposeFont == "Georgia" && loaded.ComposeFontSize == 18, "Composer defaults persisted");
        Check(loaded.InitialBody(false) == "\n\n" + loaded.Signature, "New mail signature");
        loaded.SignatureOnNew = false;
        Check(loaded.InitialBody(false) == "" && loaded.InitialBody(true).Contains("Test Person"), "Signature toggles independent");
        loaded.SignatureOnReplies = false; Check(loaded.InitialBody(true) == "", "Reply signature opt out");
        var clone = store.Clone(loaded); clone.DisplayName = "Changed";
        Check(loaded.DisplayName == "Test Person", "Cancel editing clone leaves settings intact");
        clone.NavigationEdge = "invalid"; clone.SpellLanguage = "invalid"; clone.TextSize = 1000; clone.StartupFolder = "invalid"; clone.SendSound = "invalid"; clone.Normalize();
        Check(clone.NavigationEdge == "Left" && clone.SpellLanguage == "en-GB" && clone.TextSize == 20 && clone.StartupFolder == "Inbox" && clone.SendSound == "None", "Invalid settings normalized");
        Check(loaded.Signatures.Count == 1 && loaded.Signatures[0].PlainBody == loaded.Signature, "Legacy signature migrated");
        loaded.SignatureOnNew = true; loaded.SignatureOnReplies = true;
        loaded.Signatures.Add(new MailSignature { Id = "personal", Name = "Personal", PlainBody = "Personal signature", RichBody = "rich-placeholder" });
        loaded.ReplySignatureId = "personal";
        Check(loaded.InitialBody(true).Contains("Personal signature") && loaded.InitialBody(false).Contains("Test Person"), "Independent named signature defaults");
        loaded.ReplySignatureId = ""; Check(loaded.InitialBody(true) == "", "None signature default");
        loaded.SignatureTemplates.Add(new MailSignature { Id = "template", Name = "My template", PlainBody = "Template", RichBody = "rich-template" });
        loaded.InboxEdge = "Bottom"; loaded.SpotifyPlacement = "Sidebar"; store.Save(loaded);
        var signatureReload = store.Load();
        Check(signatureReload.Signatures.Count == 2 && signatureReload.Signatures[1].RichBody == "rich-placeholder" && signatureReload.SignatureTemplates[0].Name == "My template", "Rich signature/template persistence");
        Check(signatureReload.InboxEdge == "Bottom" && signatureReload.SpotifyPlacement == "Sidebar", "Inbox and Spotify layout persistence");
        var session = new SettingsPreview(store, signatureReload); var trial = store.Clone(signatureReload);
        trial.DisplayName = "Preview name"; trial.AppearanceMode = "Dark"; trial.Signatures[0].PlainBody = "Preview body";
        var live = session.Apply(trial);
        Check(live.DisplayName == "Preview name" && live.AppearanceMode == "Dark", "Settings preview applied");
        Check(store.Load().DisplayName == "Test Person", "Preview does not write preferences");
        var reverted = session.Revert();
        Check(reverted.DisplayName == "Test Person" && reverted.Signatures[0].PlainBody.Contains("Test Person"), "Cancel restores deep snapshot");
        store.Save(session.Working); Check(store.Load().DisplayName == "Preview name", "Save keeps preview preferences");
        string setupPath = Path.Combine(args[0], Guid.NewGuid().ToString(), "settings.json");
        var setupStore = new SettingsStore(setupPath); var fresh = setupStore.Load();
        Check(!fresh.SetupCompleted && fresh.EmailAddress == "", "New profiles need welcome setup");
        try { WelcomeFlow.Complete(setupStore, fresh, true, "invalid"); throw new Exception("Invalid setup address accepted"); } catch (FormatException) { Check(!File.Exists(setupPath) && !fresh.SetupCompleted, "Invalid setup does not persist or complete"); }
        var exploring = WelcomeFlow.Complete(setupStore, fresh, false, "ignored");
        Check(exploring.SetupCompleted && exploring.EmailAddress == "" && setupStore.Load().SetupCompleted, "Explore without an account persists completion");
        Check(!fresh.SetupCompleted, "Setup edits use a copy of preferences");
        var withEmail = WelcomeFlow.Complete(setupStore, exploring, true, "  test@example.com  ");
        Check(withEmail.EmailAddress == "test@example.com" && setupStore.Load().EmailAddress == "test@example.com", "Onboarding email validated and saved");
        Check(WelcomeFlow.Complete(setupStore, withEmail, false, "").EmailAddress == "test@example.com", "Explore preserves an existing profile address");
        try { WelcomeFlow.ValidateEmail("Name <test@example.com>"); throw new Exception("Display-name address accepted"); } catch (FormatException) { Check(true, "Only an email address is accepted"); }
        File.WriteAllText(setupPath, "{\"DisplayName\":\"Existing user\"}");
        Check(setupStore.Load().SetupCompleted, "Existing profiles bypass first-run onboarding after upgrade");
        File.WriteAllText(setupPath, "{\"DisplayName\":\"New user\",\"SetupCompleted\":false}");
        Check(!setupStore.Load().SetupCompleted, "Incomplete setup is retained for the next launch");
        File.WriteAllText(path, "invalid json"); store.Load();
        Check(store.RecoveryPath != null && File.ReadAllText(store.RecoveryPath) == "invalid json", "Corrupt settings recovered without data loss");
        Console.WriteLine("Passed " + checks + " settings checks.");
    }
}
