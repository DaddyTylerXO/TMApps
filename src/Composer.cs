using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Mail;
using System.Speech.Recognition;
using System.Speech.Synthesis;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using Microsoft.Win32;

namespace Postbox {
    public static class RichMail {
        public static string Save(RichTextBox editor) { using (var stream = new MemoryStream()) { new TextRange(editor.Document.ContentStart, editor.Document.ContentEnd).Save(stream, DataFormats.Rtf); return Convert.ToBase64String(stream.ToArray()); } }
        public static bool Load(RichTextBox editor, string value) {
            try {
                byte[] data = Convert.FromBase64String(value);
                if (data.Length < 6 || System.Text.Encoding.ASCII.GetString(data, 0, 5) != "{\\rtf") return false;
                var document = new FlowDocument { FontFamily = editor.FontFamily, FontSize = editor.FontSize, PagePadding = new Thickness(0) };
                using (var stream = new MemoryStream(data)) new TextRange(document.ContentStart, document.ContentEnd).Load(stream, DataFormats.Rtf);
                editor.Document = document; AdaptDefaultColors(editor, Theme.B("Text")); return true;
            } catch (Exception ex) { if (!(ex is FormatException || ex is ArgumentException || ex is System.IO.IOException)) throw; return false; }
        }
        public static void AdaptDefaultColors(RichTextBox editor, Brush target) {
            for (var position = editor.Document.ContentStart; position != null && position.CompareTo(editor.Document.ContentEnd) < 0; position = position.GetNextContextPosition(LogicalDirection.Forward)) {
                var element = position.Parent as TextElement; if (element == null) continue;
                var foreground = element.Foreground as SolidColorBrush;
                if (foreground != null && new[] { "#FFE0EDE3", "#FF1D3728", "#FFECEEF3", "#FF242833" }.Contains(foreground.Color.ToString().ToUpperInvariant())) element.Foreground = target;
            }
        }
        public static string Plain(RichTextBox editor) { return new TextRange(editor.Document.ContentStart, editor.Document.ContentEnd).Text.TrimEnd('\r', '\n'); }
        public static void SetPlain(RichTextBox editor, string value) { editor.Document.Blocks.Clear(); editor.Document.Blocks.Add(new Paragraph(new Run(value ?? ""))); }
        public static List<string> Recipients(params string[] fields) {
            var addresses = new List<string>();
            foreach (var field in fields) foreach (string entry in (field ?? "").Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)) {
                var address = new MailAddress(entry.Trim()); if (address.Address.IndexOf('@') < 1) throw new FormatException("Check email addresses."); addresses.Add(address.Address);
            }
            return addresses;
        }
    }
    public partial class ComposerWindow : Window {
        private readonly Preferences preferences;
        private readonly MailStore store;
        private Message draft;
        private readonly RichTextBox editor;
        private readonly TextBox to, cc, bcc, subject;
        private readonly WrapPanel attachmentBar;
        private readonly TextBlock status;
        private readonly ComboBox importance;
        private readonly CheckBox followUp;
        private readonly List<MailAttachment> attachments = new List<MailAttachment>();
        private string baseline;
        private bool completed;
        private bool sending;
        public Func<Message, System.Threading.Tasks.Task<string>> Deliver { get; set; }
        private Brush paintedColor;
        private FontFamily paintedFont;
        private object paintedSize, paintedWeight, paintedStyle;
        private SpeechRecognitionEngine recognizer;
        private SpeechSynthesizer speaker;
        private Button dictateButton;
        public event Action<bool, string> Saved;
        public string RecipientAddresses { get { return String.Join(", ", new[] { to.Text, cc.Text, bcc.Text }.Where(v => !String.IsNullOrWhiteSpace(v))); } }
        public void SetFastRecipients(string recipients) { to.Text = String.Join("; ", RichMail.Recipients(recipients)); cc.Clear(); bcc.Clear(); baseline = Snapshot(); }
        public ComposerWindow(Preferences prefs, MailStore mailbox, Message existing, string mode, Message original, string accountId = null) {
            preferences = prefs; store = mailbox; draft = existing;
            recipientHistory = RecipientHistory.Build(mailbox.Messages, prefs.EmailAddress, accountId);
            Title = existing == null ? "New message · TMA-Mail" : "Edit draft · TMA-Mail";
            Width = 1180; Height = 880; MinWidth = 940; MinHeight = 700; WindowStartupLocation = WindowStartupLocation.CenterOwner; FontFamily = new FontFamily("Segoe UI"); Theme.Install(this);
            var root = new Grid { Margin = new Thickness(28, 24, 28, 22) }; Content = root;
            foreach (var size in new[] { GridLength.Auto, GridLength.Auto, GridLength.Auto, GridLength.Auto, GridLength.Auto, new GridLength(1, GridUnitType.Star), GridLength.Auto }) root.RowDefinitions.Add(new RowDefinition { Height = size });
            var heading = new DockPanel { Margin = new Thickness(2, 0, 2, 20) };
            var demo = new Border { CornerRadius = new CornerRadius(12), Background = Theme.B("#F0F3F8"), Padding = new Thickness(12, 7, 12, 7), VerticalAlignment = VerticalAlignment.Center, Child = new TextBlock { Text = "LOCAL DRAFT", FontSize = 10, Foreground = Theme.B("#8793A7") } };
            DockPanel.SetDock(demo, Dock.Right); heading.Children.Add(demo);
            var titleRow = new StackPanel { Orientation = Orientation.Horizontal };
            titleRow.Children.Add(new Border { Background = Theme.B("#F0F3F8"), CornerRadius = new CornerRadius(16), Width = 44, Height = 44, Child = DrawIcon("signature", Theme.B("#244B91")), Margin = new Thickness(0, 0, 13, 0) });
            var titleText = new StackPanel(); var title = Text(existing == null ? "New message" : "Edit draft", 23); title.FontWeight = FontWeights.SemiBold; titleText.Children.Add(title);
            titleText.Children.Add(new TextBlock { Text = "From " + prefs.DisplayName + (String.IsNullOrWhiteSpace(prefs.EmailAddress) ? "" : " · " + prefs.EmailAddress), FontSize = 11, Foreground = Theme.B("#8793A7"), Margin = new Thickness(0, 4, 0, 0) }); titleRow.Children.Add(titleText); heading.Children.Add(titleRow); root.Children.Add(heading);
            var ribbon = CreateRibbon(); Grid.SetRow(ribbon, 1); root.Children.Add(ribbon);
            var recipients = new Grid(); Grid.SetRow(recipients, 2); root.Children.Add(recipients);
            recipients.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); recipients.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            recipients.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); recipients.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            to = RecipientField(recipients, "To", existing == null ? "" : existing.To, 0, 0); Grid.SetColumnSpan((UIElement)((FrameworkElement)to.Parent).Parent, 2);
            cc = RecipientField(recipients, "Cc", existing == null ? "" : existing.Cc, 1, 0); bcc = RecipientField(recipients, "Bcc", existing == null ? "" : existing.Bcc, 1, 1);
            var subjectRow = new DockPanel(); subjectRow.Children.Add(new TextBlock { Text = "Subject", Width = 60, VerticalAlignment = VerticalAlignment.Center, Foreground = Theme.B("#8793A7") });
            subject = new TextBox { Text = existing == null ? "" : existing.Subject, FontSize = 15, BorderThickness = new Thickness(0), Background = Brushes.Transparent }; subjectRow.Children.Add(subject); var subjectCard = new Border { Background = Theme.B("Surface"), CornerRadius = new CornerRadius(14), Padding = new Thickness(16, 4, 16, 4), Child = subjectRow, Margin = new Thickness(0, 0, 0, 10) }; Grid.SetRow(subjectCard, 3); root.Children.Add(subjectCard);
            attachmentBar = new WrapPanel { Margin = new Thickness(0, 0, 0, 8) }; Grid.SetRow(attachmentBar, 4); root.Children.Add(attachmentBar);
            editor = new RichTextBox { Background = Theme.B("Surface"), Foreground = Theme.B("Text"), CaretBrush = Theme.B("Text"), BorderBrush = Theme.B("#DDE4EF"), BorderThickness = new Thickness(0), Padding = new Thickness(14), VerticalScrollBarVisibility = ScrollBarVisibility.Auto, AcceptsTab = true, FontSize = prefs.ComposeFontSize, FontFamily = new FontFamily(prefs.ComposeFont), SelectionBrush = Theme.B("#293F62") };
            editor.Document.PagePadding = new Thickness(0); editor.Document.FontFamily = editor.FontFamily; editor.Document.FontSize = prefs.ComposeFontSize;
            editor.Language = XmlLanguage.GetLanguage(prefs.SpellLanguage); subject.Language = editor.Language; SpellCheck.SetIsEnabled(editor, prefs.SpellCheckEnabled); SpellCheck.SetIsEnabled(subject, prefs.SpellCheckEnabled);
            var writingCard = new Border { Background = Theme.B("Surface"), CornerRadius = new CornerRadius(18), Padding = new Thickness(12), Child = editor, ClipToBounds = true }; Grid.SetRow(writingCard, 5); root.Children.Add(writingCard);
            RichMail.SetPlain(editor, existing == null ? prefs.InitialBody(false) : existing.Body);
            if (existing != null && !String.IsNullOrEmpty(existing.RichBody) && !RichMail.Load(editor, existing.RichBody)) { MessageBox.Show(this, "The formatted body could not be read. The plain text copy is shown; saving will replace the damaged formatting.", "TMA-Mail"); }
            if (existing != null && existing.Attachments != null) attachments.AddRange(existing.Attachments);
            if (mode != "" && original != null) {
                subject.Text = (mode == "reply" || mode == "replyAll" ? "Re: " : "Fwd: ") + original.Subject;
                to.Text = mode == "reply" || mode == "replyAll" ? (original.Address == "you@postbox.local" || (original.Address == "you@tma-mail.local" || (!String.IsNullOrEmpty(prefs.EmailAddress) && String.Equals(original.Address, prefs.EmailAddress, StringComparison.OrdinalIgnoreCase))) ? original.To : original.Address) : "";
                if (mode == "replyAll") {
                    var own = prefs.EmailAddress ?? "";
                    var addresses = new[] { original.Address }.Concat((original.To ?? "").Split(';', ',')).Select(a => (a ?? "").Trim()).Where(a => a.Length > 0 && !String.Equals(a, own, StringComparison.OrdinalIgnoreCase)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                    to.Text = String.Join("; ", addresses);
                    cc.Text = String.Join("; ", (original.Cc ?? "").Split(';', ',').Select(a => a.Trim()).Where(a => a.Length > 0 && !String.Equals(a, own, StringComparison.OrdinalIgnoreCase) && !addresses.Contains(a, StringComparer.OrdinalIgnoreCase)).Distinct(StringComparer.OrdinalIgnoreCase));
                }
                RichMail.SetPlain(editor, prefs.InitialBody(true) + "\n\n──────── Original message ────────\nFrom: " + original.Sender + " <" + original.Address + ">\nDate: " + original.Date.ToLocalTime().ToString("f") + "\nSubject: " + original.Subject + "\n\n" + original.Body);
                if (mode == "forward" && original.Attachments != null) attachments.AddRange(original.Attachments);
            }
            if (existing == null) {
                string quote = mode != "" && original != null ? "──────── Original message ────────\nFrom: " + original.Sender + " <" + original.Address + ">\nDate: " + original.Date.ToLocalTime().ToString("f") + "\nSubject: " + original.Subject + "\n\n" + original.Body : "";
                SignatureTools.Initial(editor, prefs, mode != "", quote);
            }
            var footer = new DockPanel { Margin = new Thickness(0, 16, 0, 0) }; Grid.SetRow(footer, 6); root.Children.Add(footer);
            var actions = new StackPanel { Orientation = Orientation.Horizontal }; DockPanel.SetDock(actions, Dock.Right); footer.Children.Add(actions);
            actions.Children.Add(Button("Save draft", delegate { Persist(false); }, false)); actions.Children.Add(Button("Discard", Discard, false)); actions.Children.Add(Button("Send ↗", delegate { Persist(true); }, true));
            status = Text("Ctrl+S saves your draft · Ctrl+Enter sends through your connected account", 11); status.Foreground = Theme.B("#8793A7"); status.VerticalAlignment = VerticalAlignment.Center; status.TextWrapping = TextWrapping.Wrap; footer.Children.Add(status);
            importance = new ComboBox { ItemsSource = new[] { "Normal", "High", "Low" }, SelectedItem = existing == null || existing.Importance == null ? "Normal" : existing.Importance, Width = 95, Margin = new Thickness(3), ToolTip = "Message importance" };
            followUp = new CheckBox { Content = "⚑ Follow up", IsChecked = existing != null && existing.FollowUp, Margin = new Thickness(8), VerticalAlignment = VerticalAlignment.Center };
            BuildPolishedRibbon(ribbon); UpdateAttachments(); baseline = Snapshot();
            Closing += delegate(object sender, System.ComponentModel.CancelEventArgs e) {
                if (sending) { e.Cancel = true; return; }
                if (!completed && baseline != Snapshot()) { try { SaveMessage(false); if (Saved != null) Saved(false, subject.Text); } catch (Exception ex) { e.Cancel = true; status.Text = "Draft could not be saved: " + ex.Message; } }
            };
            Closed += delegate { if (recognizer != null) { recognizer.Dispose(); recognizer = null; } if (speaker != null) speaker.Dispose(); };
            PreviewKeyDown += delegate(object sender, KeyEventArgs e) {
                if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.S) { Persist(false); e.Handled = true; }
                else if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.Enter) { Persist(true); e.Handled = true; }
            };
            Loaded += delegate { editor.CaretPosition = editor.Document.ContentStart; if (mode == "reply") editor.Focus(); else to.Focus(); };
        }
        private static TextBlock Text(string value, double size) { return new TextBlock { Text = value, FontSize = size, Foreground = Theme.B("Text") }; }
        private static Button Button(string label, Action action, bool primary) {
            var button = new Button { Content = ToolContent(label, primary), Padding = new Thickness(12, 9, 12, 9), Margin = new Thickness(3), Cursor = Cursors.Hand, Background = Theme.B(primary ? "#4D83F5" : "#F0F3F8"), Foreground = primary ? Brushes.White : Theme.B("Text"), BorderThickness = new Thickness(0), MinHeight = 35, ToolTip = label };
            System.Windows.Automation.AutomationProperties.SetName(button, label);
            button.Click += delegate { try { action(); } catch (Exception ex) { MessageBox.Show("That action could not be completed.\n" + ex.Message, "TMA-Mail"); } }; return button;
        }
        private TextBox RecipientField(Grid parent, string name, string value, int row, int column) {
            var group = new DockPanel(); var label = Text(name, 12); label.Width = 60; label.Foreground = Theme.B("#8793A7"); label.VerticalAlignment = VerticalAlignment.Center; group.Children.Add(label);
            var box = new TextBox { Text = value ?? "", BorderThickness = new Thickness(0), Background = Brushes.Transparent, ToolTip = "Separate email addresses with semicolons" }; System.Windows.Automation.AutomationProperties.SetName(box, name); AttachRecipientSuggestions(box); group.Children.Add(box); var card = new Border { Background = Theme.B("Surface"), CornerRadius = new CornerRadius(15), Padding = new Thickness(16, 5, 16, 5), Margin = new Thickness(0, 0, column == 0 && row > 0 ? 10 : 0, 10), Child = group }; Grid.SetRow(card, row); Grid.SetColumn(card, column); parent.Children.Add(card); return box;
        }
        private StackPanel RibbonTab(TabControl tabs, string name) {
            var panel = new StackPanel { Orientation = Orientation.Vertical, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(1) };
            var scroll = new ScrollViewer { Content = panel, HorizontalScrollBarVisibility = ScrollBarVisibility.Auto, VerticalScrollBarVisibility = ScrollBarVisibility.Disabled };
            tabs.Items.Add(new TabItem { Header = name, Content = scroll }); return panel;
        }
        private WrapPanel Group(StackPanel parent, string title, double width) {
            var panel = new WrapPanel { Width = width, HorizontalAlignment = HorizontalAlignment.Left, MinHeight = 80, VerticalAlignment = VerticalAlignment.Center }; parent.Children.Add(panel); return panel;
        }
        private void Tool(Panel panel, string label, Action action) { panel.Children.Add(Button(label, action, false)); }
        private void Command(Panel panel, string label, ICommand command) { Tool(panel, label, delegate { editor.Focus(); if (command.CanExecute(null)) command.Execute(null); }); }
        private void FontControls(Panel panel) {
            var font = new ComboBox { ItemsSource = Fonts.SystemFontFamilies.Select(f => f.Source).OrderBy(f => f).ToList(), SelectedItem = preferences.ComposeFont, Width = 140, MinHeight = 35, Margin = new Thickness(3), ToolTip = "Font family" };
            font.SelectionChanged += delegate { if (font.SelectedItem != null) { editor.Selection.ApplyPropertyValue(TextElement.FontFamilyProperty, new FontFamily((string)font.SelectedItem)); editor.Focus(); } }; panel.Children.Add(font);
            var size = new ComboBox { ItemsSource = new[] { "8", "10", "11", "12", "14", "16", "18", "20", "24", "28", "36", "48" }, SelectedItem = preferences.ComposeFontSize.ToString(), Width = 62, MinHeight = 35, Margin = new Thickness(3), ToolTip = "Font size" };
            size.SelectionChanged += delegate { if (size.SelectedItem != null) { editor.Selection.ApplyPropertyValue(TextElement.FontSizeProperty, Double.Parse((string)size.SelectedItem, CultureInfo.InvariantCulture)); editor.Focus(); } }; panel.Children.Add(size);
        }
        private void FormatControls(Panel panel) {
            Command(panel, "A+", EditingCommands.IncreaseFontSize); Command(panel, "A−", EditingCommands.DecreaseFontSize); Command(panel, "B", EditingCommands.ToggleBold); Command(panel, "I", EditingCommands.ToggleItalic); Command(panel, "U", EditingCommands.ToggleUnderline);
            Command(panel, "• List", EditingCommands.ToggleBullets); Command(panel, "1. List", EditingCommands.ToggleNumbering);
            Command(panel, "≡ Left", EditingCommands.AlignLeft); Command(panel, "≡ Centre", EditingCommands.AlignCenter); Command(panel, "≡ Right", EditingCommands.AlignRight); Command(panel, "≡ Justify", EditingCommands.AlignJustify);
            Tool(panel, "A Colour", delegate { ColorMenu(TextElement.ForegroundProperty); }); Tool(panel, "Highlight", delegate { ColorMenu(TextElement.BackgroundProperty); });
        }
        private void ColorMenu(DependencyProperty property) {
            var menu = new ContextMenu();
            foreach (string color in new[] { "Default", "Black", "White", "ForestGreen", "DarkRed", "RoyalBlue", "Gold", "Yellow", "Transparent" }) {
                string choice = color; var item = new MenuItem { Header = color }; item.Click += delegate { editor.Selection.ApplyPropertyValue(property, choice == "Default" ? Theme.B("Text") : (Brush)new BrushConverter().ConvertFromString(choice)); editor.Focus(); }; menu.Items.Add(item);
            } menu.IsOpen = true;
        }
        private void PaintFormat() {
            if (paintedFont == null) { paintedFont = editor.Selection.GetPropertyValue(TextElement.FontFamilyProperty) as FontFamily; paintedSize = editor.Selection.GetPropertyValue(TextElement.FontSizeProperty); paintedWeight = editor.Selection.GetPropertyValue(TextElement.FontWeightProperty); paintedStyle = editor.Selection.GetPropertyValue(TextElement.FontStyleProperty); paintedColor = editor.Selection.GetPropertyValue(TextElement.ForegroundProperty) as Brush; status.Text = "Format copied. Select target text, then click Format painter again."; }
            else { editor.Selection.ApplyPropertyValue(TextElement.FontFamilyProperty, paintedFont); if (paintedSize != DependencyProperty.UnsetValue) editor.Selection.ApplyPropertyValue(TextElement.FontSizeProperty, paintedSize); if (paintedWeight != DependencyProperty.UnsetValue) editor.Selection.ApplyPropertyValue(TextElement.FontWeightProperty, paintedWeight); if (paintedStyle != DependencyProperty.UnsetValue) editor.Selection.ApplyPropertyValue(TextElement.FontStyleProperty, paintedStyle); if (paintedColor != null) editor.Selection.ApplyPropertyValue(TextElement.ForegroundProperty, paintedColor); paintedFont = null; editor.Focus(); status.Text = "Formatting applied"; }
        }
        private void InsertSignature() {
            var signatures = preferences.Signatures.ToList();
            if (signatures.Count == 0 && !String.IsNullOrWhiteSpace(preferences.Signature)) signatures.Add(new MailSignature { Name = "Default", PlainBody = preferences.Signature });
            if (signatures.Count == 0) { status.Text = "Create a signature in Settings → Profile & signature."; return; }
            var menu = new ContextMenu(); foreach (var signature in signatures) { var selected = signature; var item = new MenuItem { Header = signature.Name }; item.Click += delegate { SignatureTools.Insert(editor, selected); }; menu.Items.Add(item); } menu.IsOpen = true;
        }
        private void Attach() {
            var picker = new OpenFileDialog { Multiselect = true, Title = "Attach files" }; if (picker.ShowDialog(this) != true) return;
            long total = attachments.Sum(a => a.Size); var added = new List<MailAttachment>();
            foreach (string path in picker.FileNames) { var info = new FileInfo(path); total += info.Length; if (total > 20 * 1024 * 1024) throw new InvalidOperationException("Keep attachments under 20 MB total per message."); added.Add(new MailAttachment { Name = info.Name, Size = info.Length, Data = Convert.ToBase64String(File.ReadAllBytes(path)) }); }
            attachments.AddRange(added); UpdateAttachments();
        }
        private void UpdateAttachments() { attachmentBar.Children.Clear(); foreach (var attachment in attachments.ToArray()) { var local = attachment; attachmentBar.Children.Add(Button("📎 " + attachment.Name + "  ×", delegate { attachments.Remove(local); UpdateAttachments(); }, false)); } }
        private string Prompt(string title, string initial) {
            var dialog = new Window { Owner = this, Title = title, Width = 470, Height = 170, ResizeMode = ResizeMode.NoResize, WindowStartupLocation = WindowStartupLocation.CenterOwner }; Theme.Install(dialog);
            var panel = new StackPanel { Margin = new Thickness(20) }; dialog.Content = panel; var input = new TextBox { Text = initial }; panel.Children.Add(input); var ok = Button("Insert", delegate { dialog.DialogResult = true; }, true); ok.HorizontalAlignment = HorizontalAlignment.Right; panel.Children.Add(ok); dialog.Loaded += delegate { input.Focus(); input.SelectAll(); }; return dialog.ShowDialog() == true ? input.Text : null;
        }
        private void InsertLink() {
            string label = editor.Selection.Text; string link = Prompt("Insert hyperlink (https:// or mailto:)", "https://"); if (link == null) return;
            Uri uri; if (!Uri.TryCreate(link, UriKind.Absolute, out uri) || !new[] { "https", "http", "mailto" }.Contains(uri.Scheme)) throw new ArgumentException("Use an http, https, or mailto link.");
            editor.Selection.Text = ""; var hyperlink = new Hyperlink(new Run(String.IsNullOrWhiteSpace(label) ? link : label), editor.CaretPosition) { NavigateUri = uri }; hyperlink.Foreground = Theme.B("#4D83F5"); editor.CaretPosition = hyperlink.ElementEnd; editor.Focus();
        }
        private void InsertTable() {
            var table = new Table { CellSpacing = 0, BorderBrush = Theme.B("#DDE4EF"), BorderThickness = new Thickness(1) }; var rows = new TableRowGroup();
            for (int r = 0; r < 3; r++) { var row = new TableRow(); for (int c = 0; c < 3; c++) row.Cells.Add(new TableCell(new Paragraph(new Run(r == 0 ? "Heading" : "Text"))) { BorderBrush = Theme.B("#DDE4EF"), BorderThickness = new Thickness(1), Padding = new Thickness(8) }); rows.Rows.Add(row); }
            table.RowGroups.Add(rows); var current = editor.CaretPosition.Paragraph; if (current != null) editor.Document.Blocks.InsertAfter(current, table); else editor.Document.Blocks.Add(table); editor.Focus();
        }
        private void AddressBook() {
            var dialog = new Window { Owner = this, Title = "Address book · TMA-Mail", Width = 520, Height = 500, WindowStartupLocation = WindowStartupLocation.CenterOwner }; Theme.Install(dialog);
            var root = new DockPanel { Margin = new Thickness(20) }; dialog.Content = root; var description = Text("Select correspondents from your local mailbox.", 13); description.Margin = new Thickness(0, 0, 0, 12); DockPanel.SetDock(description, Dock.Top); root.Children.Add(description);
            var list = new ListBox { SelectionMode = SelectionMode.Extended, Background = Theme.B("Surface"), Foreground = Theme.B("Text"), ItemsSource = store.Messages.Where(m => m.Address != null && !m.Address.StartsWith("you@")).Select(m => m.Sender + " <" + m.Address + ">").Distinct().OrderBy(s => s).ToList() };
            var actions = new StackPanel { Orientation = Orientation.Horizontal }; DockPanel.SetDock(actions, Dock.Bottom); root.Children.Add(actions);
            foreach (string field in new[] { "To", "Cc", "Bcc" }) { string target = field; actions.Children.Add(Button("Add to " + field, delegate { var input = target == "To" ? to : target == "Cc" ? cc : bcc; var addresses = list.SelectedItems.Cast<string>().Select(value => new MailAddress(value).Address); input.Text = String.Join("; ", new[] { input.Text }.Concat(addresses).Where(value => !String.IsNullOrWhiteSpace(value))); dialog.Close(); }, true)); }
            root.Children.Add(list); dialog.ShowDialog();
        }
        private void CheckNames() { try { status.Text = RichMail.Recipients(to.Text, cc.Text, bcc.Text).Count + " valid recipient address(es). Addresses are checked for format, not deliverability."; } catch (FormatException) { status.Text = "Check recipient addresses. Separate them with semicolons."; } }
        private void CheckSpelling() {
            if (!preferences.SpellCheckEnabled) { status.Text = "Enable spellchecking in Settings → Writing."; return; }
            var position = editor.GetNextSpellingErrorPosition(editor.CaretPosition, LogicalDirection.Forward) ?? editor.GetNextSpellingErrorPosition(editor.Document.ContentStart, LogicalDirection.Forward);
            if (position == null) { status.Text = "No spelling errors found by the installed dictionary."; return; }
            var errorRange = editor.GetSpellingErrorRange(position); if (errorRange != null) editor.Selection.Select(errorRange.Start, errorRange.End); editor.Focus(); status.Text = "Right-click the underlined word for suggestions.";
        }
        private void Dictate() {
            if (recognizer != null) { recognizer.RecognizeAsyncCancel(); recognizer.Dispose(); recognizer = null; dictateButton.Content = ToolContent("Dictate", false); status.Text = "Dictation stopped"; return; }
            try {
                var available = SpeechRecognitionEngine.InstalledRecognizers(); var installed = available.FirstOrDefault(r => r.Culture.Name.Equals(preferences.SpellLanguage, StringComparison.OrdinalIgnoreCase)) ?? available.FirstOrDefault();
                if (installed == null) { status.Text = "No Windows speech recognizer is installed. Install a speech language in Windows to use dictation."; return; }
                recognizer = new SpeechRecognitionEngine(installed); recognizer.LoadGrammar(new DictationGrammar()); recognizer.SetInputToDefaultAudioDevice();
                recognizer.SpeechRecognized += delegate(object sender, SpeechRecognizedEventArgs e) { Dispatcher.BeginInvoke(new Action(delegate { if (recognizer != null) { editor.Selection.Text = e.Result.Text + " "; editor.Focus(); } })); };
                recognizer.RecognizeAsync(RecognizeMode.Multiple); dictateButton.Content = ToolContent("Stop dictation", false); status.Text = "Listening locally using Windows speech recognition. Click Stop dictation to stop.";
            } catch (Exception ex) { if (recognizer != null) recognizer.Dispose(); recognizer = null; status.Text = "Dictation unavailable: " + ex.Message; }
        }
        private void ReadAloud() { if (speaker == null) speaker = new SpeechSynthesizer(); if (speaker.State == SynthesizerState.Speaking) { speaker.SpeakAsyncCancelAll(); return; } speaker.SpeakAsync(RichMail.Plain(editor)); }
        private void ReadingView() {
            var reader = new Window { Owner = this, Title = "Reading view · TMA-Mail", Width = 800, Height = 650, WindowStartupLocation = WindowStartupLocation.CenterOwner }; Theme.Install(reader);
            var copy = new RichTextBox { IsReadOnly = true, FontSize = 22, Background = Theme.B("Surface"), Foreground = Theme.B("Text"), Padding = new Thickness(40), VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
            RichMail.SetPlain(copy, RichMail.Plain(editor)); reader.Content = copy; reader.ShowDialog();
        }
        private void ExportRtf() { var save = new SaveFileDialog { Filter = "Rich text (*.rtf)|*.rtf", FileName = "message.rtf" }; if (save.ShowDialog(this) == true) File.WriteAllBytes(save.FileName, Convert.FromBase64String(RichMail.Save(editor))); }
        private void ImportRtf() { var open = new OpenFileDialog { Filter = "Rich text (*.rtf)|*.rtf" }; if (open.ShowDialog(this) != true) return; var staged = new RichTextBox(); if (!RichMail.Load(staged, Convert.ToBase64String(File.ReadAllBytes(open.FileName)))) throw new InvalidDataException("This rich text file could not be read."); if (MessageBox.Show(this, "Replace the current message body with this RTF file?", "Import rich text", MessageBoxButton.YesNo) == MessageBoxResult.Yes) RichMail.Load(editor, RichMail.Save(staged)); }
        private string Snapshot() { return to.Text + "\0" + cc.Text + "\0" + bcc.Text + "\0" + subject.Text + "\0" + RichMail.Save(editor) + "\0" + importance.SelectedItem + "\0" + followUp.IsChecked + "\0" + String.Join("|", attachments.Select(a => a.Name + ":" + a.Data)); }
        private Message SaveMessage(bool sent) {
            // Editing a server draft creates a local draft; it does not replace the server copy.
            if (draft != null && draft.RemoteUid != 0) draft = null;
            // Stage all fields before the single atomic mailbox save.
            var message = new Message { Id = draft == null ? Guid.NewGuid().ToString() : draft.Id, Sender = preferences.DisplayName, Address = String.IsNullOrWhiteSpace(preferences.EmailAddress) ? "you@tma-mail.local" : preferences.EmailAddress, To = to.Text.Trim(), Cc = cc.Text.Trim(), Bcc = bcc.Text.Trim(), Subject = String.IsNullOrWhiteSpace(subject.Text) ? "(No subject)" : subject.Text.Trim(), Body = RichMail.Plain(editor), RichBody = RichMail.Save(editor), Folder = sent ? "Sent" : "Drafts", Date = DateTime.Now, Importance = importance.SelectedItem as string, FollowUp = followUp.IsChecked == true, Attachments = attachments.ToList(), Starred = draft != null && draft.Starred };
            if (draft != null) { message.DeliveryState = draft.DeliveryState; message.InternetMessageId = draft.InternetMessageId; }
            int index = draft == null ? -1 : store.Messages.IndexOf(draft);
            if (index >= 0) store.Messages[index] = message; else store.Messages.Add(message);
            try { store.Save(); } catch { if (index >= 0) store.Messages[index] = draft; else store.Messages.Remove(message); throw; }
            draft = message;
            return message;
        }
        private async void Persist(bool sent) {
            if (sending) return;
            try {
                if (sent && (String.IsNullOrWhiteSpace(to.Text) || RichMail.Recipients(to.Text, cc.Text, bcc.Text).Count == 0)) { status.Text = "Enter at least one recipient in To."; return; }
                if (!sent) { SaveMessage(false); completed = true; if (Saved != null) Saved(false, subject.Text); Close(); return; }
                if (Deliver == null) { status.Text = "Connect an email account before sending."; return; }
                var previous = store.Messages.FirstOrDefault(m => draft != null && m.Id == draft.Id);
                if (previous != null && (previous.DeliveryState == "Sending" || previous.DeliveryState == "Unknown")) {
                    if (MessageBox.Show(this, "A previous send may have reached the server. Check Sent and the recipient before retrying. Send another copy?", "Check delivery before retrying", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;
                }
                var message = SaveMessage(false); message.HtmlBody = MailHtml.Export(editor.Document); message.InternetMessageId = MimeKit.Utils.MimeUtils.GenerateMessageId(); message.DeliveryState = "Sending"; store.Save();
                sending = true; ((UIElement)Content).IsEnabled = false; status.Text = "Sending securely…";
                string warning;
                try { warning = await Deliver(message); }
                catch { message.DeliveryState = "Unknown"; store.Save(); status.Text = "Sending failed or delivery is uncertain. Draft kept; check Sent before retrying."; throw; }
                // Never turn an accepted SMTP send into an automatic retry when the cache write fails.
                message.Folder = "Sent"; message.DeliveryState = "Sent"; completed = true;
                try { store.Save(); } catch (Exception ex) { warning = "The server accepted your message, but the local Sent copy could not be saved: " + ex.Message + ". Do not resend."; }
                sending = false; if (Saved != null) Saved(true, subject.Text);
                if (warning != null) MessageBox.Show(this, warning, "Message sent", MessageBoxButton.OK, MessageBoxImage.Information);
                Close();
            } catch (Exception ex) { status.Text = "Action failed: " + ex.Message; }
            finally { sending = false; ((UIElement)Content).IsEnabled = true; }
        }
        private void Discard() { if (MessageBox.Show(this, "Discard this message?", "TMA-Mail", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return; if (draft != null) store.Move(draft, "Trash"); completed = true; if (Saved != null) Saved(false, subject.Text); Close(); }
    }
}
