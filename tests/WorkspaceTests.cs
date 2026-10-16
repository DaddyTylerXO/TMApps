using System;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Collections.Generic;
using System.Linq;
using System.Windows.Media.Imaging;
using Postbox;

class WorkspaceTests {
    static object Get(object obj, string field) { return obj.GetType().GetField(field, BindingFlags.Instance | BindingFlags.NonPublic).GetValue(obj); }
    static object Call(object obj, string method, params object[] args) { return obj.GetType().GetMethod(method, BindingFlags.Instance | BindingFlags.NonPublic).Invoke(obj, args); }
    [STAThread] static void Main() {
        var app = new App(); Call(app, "Initialize");
        var window = (Window)Get(app, "window");
        var preferences = (Preferences)Get(app, "preferences");
        int checks = 0;
        foreach (string edge in new[] { "Left", "Top", "Right", "Bottom" }) {
            foreach (bool collapsed in new[] { false, true }) {
                preferences.NavigationEdge = edge; preferences.NavigationCollapsed = collapsed; Call(app, "ApplyPreferences");
                var content = (FrameworkElement)window.Content;
                content.Measure(new Size(984, 760)); content.Arrange(new Rect(0, 0, 984, 760)); content.UpdateLayout();
                var navigation = (Border)Get(app, "navigation"); var workspace = (Grid)Get(app, "workspace");
                var navPosition = navigation.TranslatePoint(new Point(0, 0), workspace);
                if (edge == "Right" && navPosition.X < 700) throw new Exception("Right navigation is not on right");
                if (edge == "Bottom" && navPosition.Y < 600) throw new Exception("Bottom navigation is not on bottom");
                if ((edge == "Left" || edge == "Right") && Math.Abs(navigation.ActualWidth - (collapsed ? 88 : 224)) > 1) throw new Exception("Incorrect ribbon width");
                var list = (ListBox)window.FindName("MessageList");
                var point = list.TranslatePoint(new Point(list.ActualWidth, 0), content);
                if (list.ActualWidth < 280 || point.X > 984) throw new Exception("List outside workspace");
                checks++;
            }
        }
        var editor = new TextBox(); Call(app, "ApplySpellCheck", editor);
        if (!SpellCheck.GetIsEnabled(editor) || !String.Equals(editor.Language.IetfLanguageTag, "en-GB", StringComparison.OrdinalIgnoreCase)) throw new Exception("Spellchecker not enabled: " + SpellCheck.GetIsEnabled(editor) + ", " + editor.Language.IetfLanguageTag);
        preferences.SpellCheckEnabled = false; Call(app, "ApplySpellCheck", editor);
        if (SpellCheck.GetIsEnabled(editor)) throw new Exception("Spellchecker opt out ignored");
        var dark = ((SolidColorBrush)Theme.B("Surface")).Color;
        preferences.AppearanceMode = "Light"; Call(app, "ApplyPreferences");
        if (((SolidColorBrush)Theme.B("Surface")).Color == dark) throw new Exception("Light mode did not update existing brushes");
        preferences.AppearanceMode = "Dark"; Call(app, "ApplyPreferences");
        if (((SolidColorBrush)Theme.B("Surface")).Color != dark) throw new Exception("Dark mode did not restore palette");
        app.GetType().GetField("favouritesTab", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(app, true); Call(app, "ApplyNavigation");
        if (((Button)window.FindName("ArchiveNav")).Visibility != Visibility.Collapsed || ((Button)window.FindName("InboxNav")).Visibility != Visibility.Visible) throw new Exception("Favourite folder filtering failed");
        app.GetType().GetField("favouritesTab", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(app, false); Call(app, "ApplyNavigation");
        var listBox = (ListBox)window.FindName("MessageList");
        listBox.SelectedItems.Clear(); listBox.SelectedItems.Add(listBox.Items[0]); listBox.SelectedItems.Add(listBox.Items[1]);
        var picked = listBox.SelectedItems.Cast<Message>().Select(m => m.Id).ToList();
        if (!((TextBlock)window.FindName("SubjectText")).Text.Contains("2 messages")) throw new Exception("Multi selection preview missing");
        Call(app, "MoveSelected", "Trash"); var mailbox = (MailStore)Get(app, "store");
        if (mailbox.Messages.Count(m => picked.Contains(m.Id) && m.Folder == "Trash") != 2) throw new Exception("Batch deletion failed");
        Call(app, "UndoMove");
        if (mailbox.Messages.Count(m => picked.Contains(m.Id) && m.Folder == "Inbox") != 2) throw new Exception("Batch undo failed");
        preferences.Signature = "Regards,\nTester";
        var composer = new ComposerWindow(preferences, mailbox, null, "", null);
        var richEditor = (RichTextBox)Get(composer, "editor");
        if (!RichMail.Plain(richEditor).Contains("Regards,")) throw new Exception("Composer signature missing");
        RichMail.SetPlain(richEditor, "Formatted text ✓");
        richEditor.Selection.Select(richEditor.Document.ContentStart, richEditor.Document.ContentEnd); richEditor.Selection.ApplyPropertyValue(TextElement.FontWeightProperty, FontWeights.Bold);
        ((TextBox)Get(composer, "to")).Text = "test@example.com"; ((TextBox)Get(composer, "cc")).Text = "cc@example.com"; ((TextBox)Get(composer, "bcc")).Text = "bcc@example.com";
        ((ComboBox)Get(composer, "importance")).SelectedItem = "High"; ((CheckBox)Get(composer, "followUp")).IsChecked = true;
        ((List<MailAttachment>)Get(composer, "attachments")).Add(new MailAttachment { Name = "sample.txt", Size = 3, Data = Convert.ToBase64String(new byte[] { 1, 2, 3 }) });
        var savedDraft = (Message)Call(composer, "SaveMessage", false);
        composer.GetType().GetField("completed", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(composer, true); composer.Close();
        var reopened = new ComposerWindow(preferences, mailbox, savedDraft, "", null);
        var reopenedEditor = (RichTextBox)Get(reopened, "editor");
        reopenedEditor.Selection.Select(reopenedEditor.Document.ContentStart, reopenedEditor.Document.ContentEnd);
        if (!FontWeights.Bold.Equals(reopenedEditor.Selection.GetPropertyValue(TextElement.FontWeightProperty))) throw new Exception("Rich formatting lost");
        if (savedDraft.Cc != "cc@example.com" || savedDraft.Bcc != "bcc@example.com" || !savedDraft.FollowUp || savedDraft.Importance != "High" || savedDraft.Attachments.Single().Data != "AQID") throw new Exception("Message metadata lost");
        ((TextBox)Get(reopened, "to")).Text = "invalid"; int before = mailbox.Messages.Count(m => m.Folder == "Sent"); Call(reopened, "Persist", true);
        if (mailbox.Messages.Count(m => m.Folder == "Sent") != before) throw new Exception("Invalid recipient accepted");
        ((TextBox)Get(reopened, "to")).Text = "test@example.com"; Call(reopened, "Persist", true);
        if (mailbox.Messages.Count(m => m.Folder == "Sent") != before) throw new Exception("Disconnected composer simulated a send");
        reopened.Deliver = delegate(Message message) { return System.Threading.Tasks.Task.FromResult<string>(null); };
        Call(reopened, "Persist", true);
        if (mailbox.Messages.Count(m => m.Id == savedDraft.Id) != 1 || mailbox.Messages.Single(m => m.Id == savedDraft.Id).Folder != "Sent") throw new Exception("Sending duplicated the draft");
        var roundtrip = new RichTextBox();
        if (RichMail.Load(roundtrip, "invalid rtf base64")) throw new Exception("Invalid RTF accepted");
        if (!RichMail.Load(roundtrip, mailbox.Messages.Single(m => m.Id == savedDraft.Id).RichBody)) throw new Exception("Saved RTF not readable: " + mailbox.Messages.Single(m => m.Id == savedDraft.Id).RichBody.Substring(0, 100));
        preferences.InboxEdge = "Left";
        foreach (string edge in new[] { "Left", "Top", "Right", "Bottom" }) {
            preferences.InboxEdge = edge; Call(app, "ApplyPreferences");
            var content = (FrameworkElement)window.Content; content.Measure(new Size(984, 760)); content.Arrange(new Rect(0, 0, 984, 760)); content.UpdateLayout();
            var inbox = (FrameworkElement)Get(app, "inboxPanel"); var preview = (FrameworkElement)Get(app, "previewPanel"); var area = (Grid)Get(app, "mailArea");
            var inboxPoint = inbox.TranslatePoint(new Point(0, 0), area); var previewPoint = preview.TranslatePoint(new Point(0, 0), area);
            if (edge == "Right" && inboxPoint.X <= previewPoint.X || edge == "Bottom" && inboxPoint.Y <= previewPoint.Y || edge == "Left" && inboxPoint.X >= previewPoint.X || edge == "Top" && inboxPoint.Y >= previewPoint.Y) throw new Exception("Inbox edge not applied: " + edge);
        }
        var signatureBody = new RichTextBox(); RichMail.SetPlain(signatureBody, "Graphic signature");
        signatureBody.Selection.Select(signatureBody.Document.ContentStart, signatureBody.Document.ContentEnd); signatureBody.Selection.ApplyPropertyValue(TextElement.FontWeightProperty, FontWeights.Bold);
        var pixels = new byte[] { 0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255, 255, 255, 255, 255 };
        var bitmap = BitmapSource.Create(2, 2, 96, 96, PixelFormats.Bgra32, null, pixels, 8); bitmap.Freeze();
        var picture = new Image { Source = bitmap, Width = 48, Height = 48 }; var signatureParagraph = new Paragraph(); signatureParagraph.Inlines.Add(new InlineUIContainer(picture)); signatureBody.Document.Blocks.Add(signatureParagraph);
        var graphicSignature = new MailSignature { Id = "graphic", Name = "With image", PlainBody = RichMail.Plain(signatureBody), RichBody = RichMail.Save(signatureBody) };
        preferences.Signatures = new List<MailSignature> { graphicSignature }; preferences.NewSignatureId = "graphic"; preferences.ReplySignatureId = "graphic";
        var signatureCompose = new ComposerWindow(preferences, mailbox, null, "", null);
        var signatureEditor = (RichTextBox)Get(signatureCompose, "editor");
        bool hasImage = signatureEditor.Document.Blocks.OfType<Paragraph>().SelectMany(p => p.Inlines.OfType<InlineUIContainer>()).Any(i => i.Child is Image);
        if (!hasImage || !RichMail.Plain(signatureEditor).Contains("Graphic signature")) throw new Exception("Graphic signature insertion lost content");
        signatureCompose.GetType().GetField("completed", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(signatureCompose, true); signatureCompose.Close();
        var advanced = new SignatureEditor(preferences, graphicSignature);
        ((List<MailSignature>)Get(advanced, "templateDraft")).Add(new MailSignature { Id = "staged", Name = "Staged", PlainBody = "Text" }); advanced.Close();
        if (preferences.SignatureTemplates.Count != 0) throw new Exception("Cancelled advanced signature editor leaked templates");
        if (!SpotifyClient.IsSpotify("SpotifyAB.SpotifyMusic_test!Spotify") || SpotifyClient.IsSpotify("chrome.exe") || SpotifyClient.IsSpotify(null)) throw new Exception("Spotify session filter");
        window.Close();
        Console.WriteLine("Passed " + checks + " workspace layouts, theme switching, favourites, bulk move/undo, spellchecker configuration, and rich composer roundtrip, inbox placement, graphic signatures, and Spotify filtering checks.");
    }
}
