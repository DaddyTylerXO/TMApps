using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Net.Mail;

namespace Postbox {
    public class MailSignature {
        public string Id { get; set; }
        public string Name { get; set; }
        public string PlainBody { get; set; }
        public string RichBody { get; set; }
        public override string ToString() { return Name; }
    }
    public class Preferences {
        public string DisplayName { get; set; }
        public string ProfilePhoto { get; set; }
        public string EmailAddress { get; set; }
        public bool SetupCompleted { get; set; }
        public string Signature { get; set; }
        public bool SignatureOnNew { get; set; }
        public bool SignatureOnReplies { get; set; }
        public bool LaunchWithWindows { get; set; }
        public bool StartMinimized { get; set; }
        public bool StartMaximized { get; set; }
        public bool CloseToTray { get; set; }
        public string StartupFolder { get; set; }
        public bool NotifyReceived { get; set; }
        public bool NotifySent { get; set; }
        public string ReceiveSound { get; set; }
        public string SendSound { get; set; }
        public string ReceiveWavePath { get; set; }
        public string SendWavePath { get; set; }
        public bool SpellCheckEnabled { get; set; }
        public string SpellLanguage { get; set; }
        public string NavigationEdge { get; set; }
        public bool NavigationCollapsed { get; set; }
        public int TextSize { get; set; }
        public string AppearanceMode { get; set; }
        public List<string> FavouriteFolders { get; set; }
        public string ComposeFont { get; set; }
        public int ComposeFontSize { get; set; }
        public string InboxEdge { get; set; }
        public string SpotifyPlacement { get; set; }
        public List<MailSignature> Signatures { get; set; }
        public List<MailSignature> SignatureTemplates { get; set; }
        public string ActiveSignatureId { get; set; }
        public string NewSignatureId { get; set; }
        public string ReplySignatureId { get; set; }
        public Preferences() {
            DisplayName = "Tyler"; Signature = ""; SignatureOnNew = true; SignatureOnReplies = true;
            EmailAddress = "";
            StartupFolder = "Inbox"; NotifyReceived = true; NotifySent = false;
            ReceiveSound = "Notification"; SendSound = "None"; ReceiveWavePath = ""; SendWavePath = "";
            SpellCheckEnabled = true; SpellLanguage = "en-GB"; NavigationEdge = "Left"; TextSize = 14;
            AppearanceMode = "Dark"; FavouriteFolders = new List<string> { "Inbox", "Sent" }; ComposeFont = "Segoe UI"; ComposeFontSize = 14;
            InboxEdge = "Left"; SpotifyPlacement = "Off"; Signatures = new List<MailSignature>(); SignatureTemplates = new List<MailSignature>();
        }
        public void Normalize() {
            DisplayName = String.IsNullOrWhiteSpace(DisplayName) ? "Tyler" : DisplayName.Trim();
            EmailAddress = (EmailAddress ?? "").Trim();
            Signature = Signature ?? "";
            Signatures = (Signatures ?? new List<MailSignature>()).Where(s => s != null && !String.IsNullOrEmpty(s.Id)).GroupBy(s => s.Id).Select(g => g.First()).ToList();
            SignatureTemplates = (SignatureTemplates ?? new List<MailSignature>()).Where(s => s != null && !String.IsNullOrEmpty(s.Id)).ToList();
            if (Signatures.Count == 0 && !String.IsNullOrWhiteSpace(Signature)) Signatures.Add(new MailSignature { Id = Guid.NewGuid().ToString(), Name = "Default", PlainBody = Signature });
            if (!Signatures.Any(s => s.Id == ActiveSignatureId)) ActiveSignatureId = Signatures.Select(s => s.Id).FirstOrDefault();
            if (NewSignatureId == null) NewSignatureId = ActiveSignatureId ?? "";
            if (ReplySignatureId == null) ReplySignatureId = ActiveSignatureId ?? "";
            if (!Signatures.Any(s => s.Id == NewSignatureId)) NewSignatureId = "";
            if (!Signatures.Any(s => s.Id == ReplySignatureId)) ReplySignatureId = "";
            if (!new[] { "Left", "Top", "Right", "Bottom" }.Contains(InboxEdge)) InboxEdge = "Left";
            if (!new[] { "Off", "Top", "Bottom", "Sidebar" }.Contains(SpotifyPlacement)) SpotifyPlacement = "Off";
            if (AppearanceMode != "Light") AppearanceMode = "Dark";
            FavouriteFolders = (FavouriteFolders ?? new List<string>()).Where(f => new[] { "Inbox", "Starred", "Drafts", "Sent", "Archive", "Trash" }.Contains(f) || (f != null && f.StartsWith("Server:"))).Distinct().ToList();
            if (String.IsNullOrWhiteSpace(ComposeFont)) ComposeFont = "Segoe UI";
            ComposeFontSize = Math.Max(8, Math.Min(48, ComposeFontSize));
            if (!new[] { "Left", "Top", "Right", "Bottom" }.Contains(NavigationEdge)) NavigationEdge = "Left";
            if (!new[] { "Inbox", "Starred", "Drafts", "Sent", "Archive" }.Contains(StartupFolder)) StartupFolder = "Inbox";
            if (!new[] { "en-GB", "en-US", "fr-FR", "de-DE", "es-ES" }.Contains(SpellLanguage)) SpellLanguage = "en-GB";
            if (!new[] { "None", "Notification", "Chime", "Exclamation", "Custom WAV" }.Contains(ReceiveSound)) ReceiveSound = "Notification";
            if (!new[] { "None", "Notification", "Chime", "Exclamation", "Custom WAV" }.Contains(SendSound)) SendSound = "None";
            TextSize = Math.Max(12, Math.Min(20, TextSize));
            ReceiveWavePath = ReceiveWavePath ?? ""; SendWavePath = SendWavePath ?? "";
        }
        public string InitialBody(bool reply) {
            var signature = GetSignature(reply);
            return signature != null && !String.IsNullOrWhiteSpace(signature.PlainBody) ? "\n\n" + signature.PlainBody.TrimEnd() : "";
        }
        public MailSignature GetSignature(bool reply) {
            if (!(reply ? SignatureOnReplies : SignatureOnNew)) return null;
            if (Signatures != null && Signatures.Count > 0) return Signatures.FirstOrDefault(s => s.Id == (reply ? ReplySignatureId : NewSignatureId));
            return String.IsNullOrWhiteSpace(Signature) ? null : new MailSignature { Name = "Default", PlainBody = Signature };
        }
    }
    public class SettingsStore {
        private readonly string path;
        private readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 33554432 };
        public string RecoveryPath { get; private set; }
        public SettingsStore(string file) { path = file; }
        public Preferences Load() {
            if (!File.Exists(path)) return new Preferences();
            Preferences preferences;
            try {
                var values = json.Deserialize<Dictionary<string, object>>(File.ReadAllText(path, Encoding.UTF8));
                if (values == null) throw new InvalidDataException();
                preferences = json.ConvertToType<Preferences>(values);
                // Earlier releases already have a workspace; avoid onboarding them again.
                if (!values.ContainsKey("SetupCompleted")) preferences.SetupCompleted = true;
            }
            catch (Exception ex) {
                if (!(ex is ArgumentException || ex is InvalidOperationException || ex is InvalidDataException)) throw;
                RecoveryPath = path + ".recovery-" + DateTime.Now.ToString("yyyyMMddHHmmssfff"); File.Copy(path, RecoveryPath);
                preferences = new Preferences();
            }
            preferences.Normalize(); return preferences;
        }
        public Preferences Clone(Preferences value) { return json.Deserialize<Preferences>(json.Serialize(value)); }
        public void Save(Preferences value) {
            value.Normalize(); Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
            string temporary = path + ".tmp";
            File.WriteAllText(temporary, json.Serialize(value), Encoding.UTF8);
            if (File.Exists(path)) File.Replace(temporary, path, null); else File.Move(temporary, path);
        }
    }
    public class SettingsPreview {
        private readonly SettingsStore store;
        public Preferences Original { get; private set; }
        public Preferences Working { get; private set; }
        public SettingsPreview(SettingsStore repository, Preferences current) { store = repository; Original = store.Clone(current); Working = store.Clone(current); }
        public Preferences Apply(Preferences value) { value.Normalize(); Working = store.Clone(value); return store.Clone(Working); }
        public Preferences Revert() { return store.Clone(Original); }
    }
    public static class WelcomeFlow {
        public static string ValidateEmail(string value) {
            value = (value ?? "").Trim();
            if (value.Length == 0) throw new FormatException("Enter an email address, or choose Explore for now.");
            var parsed = new MailAddress(value);
            if (!String.Equals(parsed.Address, value, StringComparison.OrdinalIgnoreCase) || value.IndexOf('@') < 1) throw new FormatException("Enter an address such as you@example.com.");
            return parsed.Address;
        }
        public static Preferences Complete(SettingsStore store, Preferences current, bool addAddress, string address) {
            var completed = store.Clone(current);
            if (addAddress) completed.EmailAddress = ValidateEmail(address);
            completed.SetupCompleted = true;
            store.Save(completed);
            return completed;
        }
    }
}
