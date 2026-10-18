using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using Postbox;
class RecipientSuggestionTests {
    static int checks;
    static void Check(bool condition, string reason) { if (!condition) throw new Exception(reason); checks++; }
    static object Get(object target, string name) { return target.GetType().GetField(name, BindingFlags.Instance | BindingFlags.NonPublic).GetValue(target); }
    [STAThread] static void Main(string[] args) {
        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        var messages = new List<Message> {
            new Message { Folder="Sent", AccountId="one", Address="self@example.com", To="frequent@example.com; recent@example.com", Cc="copy@example.com", Bcc="hidden@example.com", Date=DateTime.Now },
            new Message { Folder="Sent", AccountId="one", Address="self@example.com", To="FREQUENT@example.com; self@example.com; ; invalid", Cc="frequent@example.com", Date=DateTime.Now.AddDays(-1) },
            new Message { Folder="Sent", AccountId="two", Address="self@example.com", To="other-account@example.com" },
            new Message { Folder="Inbox", AccountId="one", Address="incoming@example.com", To="incoming-target@example.com" },
            new Message { Folder="Drafts", AccountId="one", Address="self@example.com", To="draft-only@example.com" }
        };
        var ranked = RecipientHistory.Build(messages,"self@example.com","one");
        Check(ranked.First().Equals("frequent@example.com",StringComparison.OrdinalIgnoreCase),"Suggestions were not ranked by sent-message frequency");
        Check(ranked.Count == 4 && ranked.Contains("copy@example.com") && ranked.Contains("hidden@example.com"),"Cc/Bcc history was omitted or unrelated account/draft/incoming/self addresses were included");
        int caret; string completed = RecipientHistory.Complete("first@example.com; fre",23,"frequent@example.com",out caret);
        Check(completed == "first@example.com; frequent@example.com; " && caret == completed.Length,"Completing a second address damaged existing recipients");
        completed = RecipientHistory.Complete("fre; last@example.com",3,"frequent@example.com",out caret);
        Check(completed == "frequent@example.com; last@example.com","Completion replaced recipients after the active address");
        string directory = args[0]; Directory.CreateDirectory(directory);
        var mailbox = new MailStore(Path.Combine(directory,"suggestions.protected"),true,false); mailbox.Messages.AddRange(messages);
        var prefs = new SettingsStore(Path.Combine(directory,"settings.json")).Load(); prefs.EmailAddress="self@example.com";
        var composer = new ComposerWindow(prefs,mailbox,null,"",null,"one"); composer.Show(); composer.Activate(); composer.UpdateLayout();
        foreach(string name in new[] {"to","cc","bcc"}) {
            var input=(TextBox)Get(composer,name); input.Focus(); input.Text="fre"; input.CaretIndex=input.Text.Length;
            var popup=((List<Popup>)Get(composer,"recipientSuggestionPopups")).Single(p=>p.PlacementTarget==input);
            Check(popup.IsOpen,"Recipient dropdown did not open in " + name);
            var list=(ListBox)((Border)popup.Child).Child;
            Check(list.Items.Count==1 && list.Items[0].ToString().Equals("frequent@example.com",StringComparison.OrdinalIgnoreCase),"Recipient dropdown showed incorrect results in " + name);
            input.RaiseEvent(new KeyEventArgs(Keyboard.PrimaryDevice,PresentationSource.FromVisual(input),0,Key.Enter){RoutedEvent=Keyboard.PreviewKeyDownEvent});
            Check(input.Text.Equals("frequent@example.com; ",StringComparison.OrdinalIgnoreCase) && !popup.IsOpen,"Enter did not commit the suggestion in " + name);
            input.Clear();
        }
        var reply = new ComposerWindow(prefs,mailbox,null,"reply",new Message{Address="sender@example.com",Subject="Test"},"one");
        Check(((List<string>)Get(reply,"recipientHistory")).Count==4,"Reply composer did not receive the account history");
        composer.Close(); reply.Close(); app.Shutdown();
        Console.WriteLine("Passed " + checks + " recipient-history and To/Cc/Bcc dropdown checks. Synthetic local mail only.");
    }
}
