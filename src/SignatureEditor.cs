using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Win32;

namespace Postbox {
    public static class SignatureTools {
        public static void Insert(RichTextBox editor, MailSignature signature) {
            var staged = new RichTextBox();
            if (!String.IsNullOrEmpty(signature.RichBody) && RichMail.Load(staged, signature.RichBody)) {
                using (var stream = new MemoryStream(Convert.FromBase64String(RichMail.Save(staged)))) editor.Selection.Load(stream, DataFormats.Rtf);
            } else editor.Selection.Text = signature.PlainBody ?? "";
            editor.Focus();
        }
        public static void Initial(RichTextBox editor, Preferences preferences, bool reply, string quote) {
            editor.Document.Blocks.Clear(); editor.Document.Blocks.Add(new Paragraph(new Run("")));
            var signature = preferences.GetSignature(reply);
            if (signature != null) {
                var staged = new RichTextBox();
                if (!String.IsNullOrEmpty(signature.RichBody) && RichMail.Load(staged, signature.RichBody)) {
                    foreach (var block in staged.Document.Blocks.ToList()) { staged.Document.Blocks.Remove(block); editor.Document.Blocks.Add(block); }
                } else if (!String.IsNullOrEmpty(signature.PlainBody)) editor.Document.Blocks.Add(new Paragraph(new Run(signature.PlainBody)));
            }
            if (!String.IsNullOrEmpty(quote)) editor.Document.Blocks.Add(new Paragraph(new Run("\n" + quote)));
        }
        public static string Ask(Window owner, string title, string initial) {
            var dialog = new Window { Owner = owner, Title = title, Width = 430, Height = 175, WindowStartupLocation = WindowStartupLocation.CenterOwner, ResizeMode = ResizeMode.NoResize }; Theme.Install(dialog);
            var panel = new StackPanel { Margin = new Thickness(20) }; dialog.Content = panel; var input = new TextBox { Text = initial ?? "" }; panel.Children.Add(input);
            var ok = new Button { Content = "OK", HorizontalAlignment = HorizontalAlignment.Right, Padding = new Thickness(18, 9, 18, 9), Margin = new Thickness(0, 12, 0, 0), IsDefault = true }; ok.Click += delegate { if (!String.IsNullOrWhiteSpace(input.Text)) dialog.DialogResult = true; }; panel.Children.Add(ok);
            dialog.Loaded += delegate { input.Focus(); input.SelectAll(); }; return dialog.ShowDialog() == true ? input.Text.Trim() : null;
        }
    }
    public class SignatureEditor : Window {
        private readonly RichTextBox editor;
        private readonly Preferences working;
        private readonly MailSignature signature;
        private readonly ComboBox templates, imageSize;
        private readonly TextBlock status;
        private bool dirty;
        private readonly List<MailSignature> templateDraft;
        public SignatureEditor(Preferences settings, MailSignature item) {
            working = settings; signature = item;
            templateDraft = settings.SignatureTemplates.Select(t => new MailSignature { Id = t.Id, Name = t.Name, PlainBody = t.PlainBody, RichBody = t.RichBody }).ToList();
            Title = "Advanced signature editing · " + item.Name; Width = 960; Height = 740; MinWidth = 780; MinHeight = 620; WindowStartupLocation = WindowStartupLocation.CenterOwner; Theme.Install(this);
            var grid = new Grid { Margin = new Thickness(24) }; Content = grid;
            foreach (var height in new[] { GridLength.Auto, GridLength.Auto, GridLength.Auto, new GridLength(1, GridUnitType.Star), GridLength.Auto }) grid.RowDefinitions.Add(new RowDefinition { Height = height });
            var heading = new TextBlock { Text = "Design your signature", FontSize = 24, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 0, 0, 18) }; grid.Children.Add(heading);
            var library = new WrapPanel { Margin = new Thickness(0, 0, 0, 12) }; Grid.SetRow(library, 1); grid.Children.Add(library);
            templates = new ComboBox { Width = 220, MinHeight = 35, Margin = new Thickness(3), DisplayMemberPath = "Name" }; RefreshTemplates(); library.Children.Add(templates);
            Add(library, "Use template", UseTemplate); Add(library, "Save as template", SaveTemplate); Add(library, "Import RTF", Import); Add(library, "Export RTF", Export);
            var tools = new WrapPanel { Margin = new Thickness(0, 0, 0, 12) }; Grid.SetRow(tools, 2); grid.Children.Add(tools);
            editor = new RichTextBox { Background = Theme.B("Surface"), Foreground = Theme.B("Text"), CaretBrush = Theme.B("Text"), Padding = new Thickness(22), BorderThickness = new Thickness(0), VerticalScrollBarVisibility = ScrollBarVisibility.Auto, FontSize = settings.ComposeFontSize, FontFamily = new FontFamily(settings.ComposeFont) };
            editor.Language = System.Windows.Markup.XmlLanguage.GetLanguage(settings.SpellLanguage); SpellCheck.SetIsEnabled(editor, settings.SpellCheckEnabled);
            var font = new ComboBox { Width = 140, Margin = new Thickness(3), ItemsSource = new[] { "Segoe UI", "Arial", "Calibri", "Georgia", "Consolas", "Times New Roman" }, SelectedItem = settings.ComposeFont }; font.SelectionChanged += delegate { if (font.SelectedItem != null) { editor.Selection.ApplyPropertyValue(TextElement.FontFamilyProperty, new FontFamily((string)font.SelectedItem)); editor.Focus(); } }; tools.Children.Add(font);
            var size = new ComboBox { Width = 60, Margin = new Thickness(3), ItemsSource = new[] { "10", "11", "12", "14", "16", "18", "20", "24", "32" }, SelectedItem = settings.ComposeFontSize.ToString() }; size.SelectionChanged += delegate { if (size.SelectedItem != null) { editor.Selection.ApplyPropertyValue(TextElement.FontSizeProperty, Double.Parse((string)size.SelectedItem)); editor.Focus(); } }; tools.Children.Add(size);
            Command(tools, "B", EditingCommands.ToggleBold); Command(tools, "I", EditingCommands.ToggleItalic); Command(tools, "U", EditingCommands.ToggleUnderline);
            Command(tools, "Left", EditingCommands.AlignLeft); Command(tools, "Centre", EditingCommands.AlignCenter); Command(tools, "Right", EditingCommands.AlignRight); Command(tools, "• List", EditingCommands.ToggleBullets);
            Add(tools, "Colour", ChooseColor); Add(tools, "Link", AddLink); Add(tools, "Graphic…", AddGraphic);
            imageSize = new ComboBox { Width = 90, Margin = new Thickness(3), ItemsSource = new[] { "64", "96", "128", "192", "256" }, SelectedItem = "128", ToolTip = "Width for the next inserted graphic (pixels)" }; tools.Children.Add(imageSize);
            var card = new Border { Background = Theme.B("Surface"), CornerRadius = new CornerRadius(18), Padding = new Thickness(10), Child = editor }; Grid.SetRow(card, 3); grid.Children.Add(card);
            if (String.IsNullOrEmpty(item.RichBody) || !RichMail.Load(editor, item.RichBody)) RichMail.SetPlain(editor, item.PlainBody ?? "");
            var footer = new DockPanel { Margin = new Thickness(0, 16, 0, 0) }; Grid.SetRow(footer, 4); grid.Children.Add(footer);
            var buttons = new StackPanel { Orientation = Orientation.Horizontal }; DockPanel.SetDock(buttons, Dock.Right); footer.Children.Add(buttons);
            Add(buttons, "Cancel", delegate { Close(); }); Add(buttons, "Apply signature", delegate { signature.PlainBody = RichMail.Plain(editor); signature.RichBody = RichMail.Save(editor); working.SignatureTemplates = templateDraft; DialogResult = true; });
            status = new TextBlock { Text = "Graphics and templates stay local. Apply here, then Save changes in Settings.", TextWrapping = TextWrapping.Wrap, FontSize = 11, Foreground = Theme.B("#8793A7"), VerticalAlignment = VerticalAlignment.Center }; footer.Children.Add(status);
            editor.TextChanged += delegate { dirty = true; };
        }
        private static void Add(Panel panel, string text, Action action) { var button = new Button { Content = text, Margin = new Thickness(3), Padding = new Thickness(12, 8, 12, 8), MinHeight = 34 }; button.Click += delegate { try { action(); } catch (Exception ex) { MessageBox.Show("Could not complete that action.\n" + ex.Message, "TMA-Mail"); } }; panel.Children.Add(button); }
        private void Command(Panel panel, string text, ICommand command) { Add(panel, text, delegate { editor.Focus(); if (command.CanExecute(null)) command.Execute(null); }); }
        private void RefreshTemplates() {
            var available = new List<MailSignature> {
                new MailSignature { Id = "builtin-simple", Name = "Simple · built in", PlainBody = working.DisplayName + "\nYour role · Your organisation\nyou@example.com" },
                new MailSignature { Id = "builtin-professional", Name = "Professional · built in", PlainBody = working.DisplayName + "\nJob title | Organisation\nPhone · Email · Website" },
                new MailSignature { Id = "builtin-minimal", Name = "Minimal · built in", PlainBody = "Best regards,\n" + working.DisplayName }
            }; available.AddRange(templateDraft); templates.ItemsSource = available; templates.SelectedIndex = 0;
        }
        private void UseTemplate() {
            var template = templates.SelectedItem as MailSignature; if (template == null) return;
            if (dirty && MessageBox.Show(this, "Replace the signature body with this template?", "Use template", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return;
            if (String.IsNullOrEmpty(template.RichBody) || !RichMail.Load(editor, template.RichBody)) {
                RichMail.SetPlain(editor, template.PlainBody);
                if (template.Id == "builtin-professional") {
                    var first = editor.Document.Blocks.FirstBlock as Paragraph;
                    if (first != null) { var text = template.PlainBody.Split('\n'); first.Inlines.Clear(); first.Inlines.Add(new Run(text[0]) { FontSize = 22, FontWeight = FontWeights.Bold }); first.Inlines.Add(new LineBreak()); first.Inlines.Add(new Run(String.Join("\n", text.Skip(1))) { FontSize = 12 }); }
                }
            }
            status.Text = "Template applied. Edit its text and add a graphic to personalise it.";
        }
        private void SaveTemplate() { string name = SignatureTools.Ask(this, "Name your template", "My template"); if (name == null) return; templateDraft.Add(new MailSignature { Id = Guid.NewGuid().ToString(), Name = name, PlainBody = RichMail.Plain(editor), RichBody = RichMail.Save(editor) }); RefreshTemplates(); templates.SelectedIndex = templates.Items.Count - 1; status.Text = "Template staged. Apply signature, then Save changes in Settings to keep it."; }
        private void ChooseColor() { var menu = new ContextMenu(); foreach (string name in new[] { "Default", "Black", "White", "RoyalBlue", "ForestGreen", "DarkRed", "Gray" }) { string color = name; var item = new MenuItem { Header = name }; item.Click += delegate { editor.Selection.ApplyPropertyValue(TextElement.ForegroundProperty, color == "Default" ? Theme.B("Text") : (Brush)new BrushConverter().ConvertFromString(color)); editor.Focus(); }; menu.Items.Add(item); } menu.IsOpen = true; }
        private void AddLink() { string text = editor.Selection.Text; string value = SignatureTools.Ask(this, "Link URL (https:// or mailto:)", "https://"); if (value == null) return; Uri uri; if (!Uri.TryCreate(value, UriKind.Absolute, out uri) || !new[] { "http", "https", "mailto" }.Contains(uri.Scheme)) throw new ArgumentException("Use an http, https, or mailto URL."); editor.Selection.Text = ""; var link = new Hyperlink(new Run(String.IsNullOrWhiteSpace(text) ? value : text), editor.CaretPosition) { NavigateUri = uri }; editor.CaretPosition = link.ElementEnd; editor.Focus(); }
        private void AddGraphic() {
            var picker = new OpenFileDialog { Filter = "Images|*.png;*.jpg;*.jpeg;*.gif;*.bmp", Title = "Insert signature graphic" }; if (picker.ShowDialog(this) != true) return;
            if (new FileInfo(picker.FileName).Length > 2 * 1024 * 1024) throw new ArgumentException("Choose a graphic smaller than 2 MB.");
            var bitmap = new BitmapImage(); bitmap.BeginInit(); bitmap.CacheOption = BitmapCacheOption.OnLoad; bitmap.DecodePixelWidth = 512; bitmap.UriSource = new Uri(picker.FileName); bitmap.EndInit(); bitmap.Freeze();
            var image = new Image { Source = bitmap, Width = Double.Parse((string)imageSize.SelectedItem), Stretch = Stretch.Uniform }; var inline = new InlineUIContainer(image, editor.CaretPosition); editor.CaretPosition = inline.ElementEnd; editor.Focus();
        }
        private void Import() { var picker = new OpenFileDialog { Filter = "Rich text (*.rtf)|*.rtf" }; if (picker.ShowDialog(this) != true) return; if (dirty && MessageBox.Show(this, "Replace this signature body with the RTF file?", "Import signature", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return; if (!RichMail.Load(editor, Convert.ToBase64String(File.ReadAllBytes(picker.FileName)))) throw new InvalidDataException("The rich text file could not be read."); }
        private void Export() { var save = new SaveFileDialog { Filter = "Rich text (*.rtf)|*.rtf", FileName = "signature.rtf" }; if (save.ShowDialog(this) == true) File.WriteAllBytes(save.FileName, Convert.FromBase64String(RichMail.Save(editor))); }
    }
    public class SignatureProfile {
        private readonly Preferences editing;
        private readonly Window owner;
        private readonly ComboBox picker, newDefault, replyDefault;
        private readonly TextBox plain;
        private readonly TextBlock hint;
        public bool IsUpdating { get; private set; }
        public event Action Changed;
        public SignatureProfile(StackPanel panel, Preferences settings, Window window) {
            editing = settings; owner = window;
            picker = Select(panel, "Signature to edit");
            var buttons = new WrapPanel(); panel.Children.Add(buttons);
            Add(buttons, "New", NewSignature); Add(buttons, "Rename", Rename); Add(buttons, "Delete", Delete); Add(buttons, "Advanced signature editing…", Advanced);
            plain = new TextBox { AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, Height = 95, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Margin = new Thickness(0, 10, 0, 5) }; panel.Children.Add(plain);
            hint = new TextBlock { FontSize = 11, Foreground = Theme.B("#8793A7"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 10) }; panel.Children.Add(hint);
            newDefault = Select(panel, "Default for new messages"); replyDefault = Select(panel, "Default for replies and forwards");
            picker.SelectionChanged += delegate { if (IsUpdating) return; editing.ActiveSignatureId = picker.SelectedValue as string; ShowSelected(); Notify(); };
            plain.TextChanged += delegate { if (IsUpdating) return; var selected = Selected(); if (selected != null) { selected.PlainBody = plain.Text; selected.RichBody = null; editing.Signature = plain.Text; hint.Text = "Plain text signature. Use Advanced editing for formatting and graphics."; } Notify(); };
            newDefault.SelectionChanged += delegate { if (!IsUpdating) { editing.NewSignatureId = newDefault.SelectedValue as string ?? ""; Notify(); } };
            replyDefault.SelectionChanged += delegate { if (!IsUpdating) { editing.ReplySignatureId = replyDefault.SelectedValue as string ?? ""; Notify(); } };
            Refresh();
        }
        private void Notify() { if (Changed != null) Changed(); }
        private static ComboBox Select(StackPanel panel, string label) { panel.Children.Add(new TextBlock { Text = label, FontSize = 12, Foreground = Theme.B("Text"), Margin = new Thickness(0, 12, 0, 6) }); var combo = new ComboBox { DisplayMemberPath = "Name", SelectedValuePath = "Id", MinHeight = 34 }; panel.Children.Add(combo); return combo; }
        private static void Add(Panel panel, string text, Action action) { var button = new Button { Content = text, Padding = new Thickness(10, 8, 10, 8), Margin = new Thickness(0, 8, 7, 0) }; button.Click += delegate { action(); }; panel.Children.Add(button); }
        private MailSignature Selected() { return editing.Signatures.FirstOrDefault(s => s.Id == (picker.SelectedValue as string)); }
        private void ShowSelected() {
            IsUpdating = true; var selected = Selected(); plain.IsEnabled = selected != null; plain.Text = selected == null ? "" : selected.PlainBody ?? "";
            hint.Text = selected != null && !String.IsNullOrEmpty(selected.RichBody) ? "Rich formatting/graphics saved. Editing this plain text box replaces that formatting." : "Use Advanced editing for formatting, graphics, and templates.";
            IsUpdating = false;
        }
        private void Refresh() {
            IsUpdating = true;
            picker.ItemsSource = editing.Signatures.ToList(); picker.SelectedValue = editing.ActiveSignatureId;
            var defaults = new[] { new MailSignature { Id = "", Name = "(None)" } }.Concat(editing.Signatures).ToList();
            newDefault.ItemsSource = defaults; replyDefault.ItemsSource = defaults.ToList(); newDefault.SelectedValue = editing.NewSignatureId ?? ""; replyDefault.SelectedValue = editing.ReplySignatureId ?? "";
            IsUpdating = false; ShowSelected();
        }
        private void NewSignature() {
            string name = SignatureTools.Ask(owner, "New signature name", "My signature"); if (name == null) return;
            var signature = new MailSignature { Id = Guid.NewGuid().ToString(), Name = name, PlainBody = "" }; bool first = editing.Signatures.Count == 0;
            editing.Signatures.Add(signature); editing.ActiveSignatureId = signature.Id; if (first) { editing.NewSignatureId = signature.Id; editing.ReplySignatureId = signature.Id; }
            Refresh(); Notify();
        }
        private void Rename() { var selected = Selected(); if (selected == null) return; string name = SignatureTools.Ask(owner, "Rename signature", selected.Name); if (name == null) return; selected.Name = name; Refresh(); Notify(); }
        private void Delete() {
            var selected = Selected(); if (selected == null || MessageBox.Show(owner, "Delete the signature '" + selected.Name + "' from this settings preview?", "Delete signature", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return;
            editing.Signatures.Remove(selected); editing.Signature = ""; editing.ActiveSignatureId = editing.Signatures.Select(s => s.Id).FirstOrDefault(); if (editing.NewSignatureId == selected.Id) editing.NewSignatureId = ""; if (editing.ReplySignatureId == selected.Id) editing.ReplySignatureId = ""; Refresh(); Notify();
        }
        private void Advanced() { var selected = Selected(); if (selected == null) { NewSignature(); selected = Selected(); if (selected == null) return; } var editor = new SignatureEditor(editing, selected) { Owner = owner }; if (editor.ShowDialog() == true) { editing.Signature = selected.PlainBody ?? ""; ShowSelected(); Notify(); } }
        public void ReadInto(Preferences value) {
            value.Signatures = editing.Signatures; value.SignatureTemplates = editing.SignatureTemplates; value.ActiveSignatureId = editing.ActiveSignatureId; value.NewSignatureId = editing.NewSignatureId; value.ReplySignatureId = editing.ReplySignatureId;
            var selected = Selected(); value.Signature = selected == null ? "" : selected.PlainBody ?? "";
        }
    }

}
