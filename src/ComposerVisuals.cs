using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Shapes;

namespace Postbox {
    public partial class ComposerWindow {
        private static readonly Dictionary<string, string> iconPaths = new Dictionary<string, string> {
            { "attach", "M8,13 L15,6 C18,3 22,7 19,10 L10,19 C5,24 -1,17 4,12 L13,3 M7,15 L15,7" },
            { "link", "M10,14 L14,10 M8,16 L6,18 C2,22 -2,16 2,12 L7,7 C9,5 12,5 14,7 M10,17 C12,19 15,19 17,17 L22,12 C26,8 20,2 16,6 L14,8" },
            { "signature", "M3,18 C10,4 14,3 10,11 C6,19 5,9 13,13 C17,16 15,9 19,13 M3,21 L21,21" },
            { "contacts", "M15,7 A4,4 0 1 1 7,7 A4,4 0 1 1 15,7 M3,21 L3,19 C3,13 19,13 19,19 L19,21 M19,4 C24,4 24,11 20,11 M21,15 C24,16 24,19 24,20" },
            { "paste", "M8,5 L4,5 L4,22 L20,22 L20,5 L16,5 M8,3 L16,3 L16,7 L8,7 Z M8,12 L16,12 M8,16 L14,16" },
            { "copy", "M8,8 L21,8 L21,22 L8,22 Z M16,4 L3,4 L3,17" },
            { "cut", "M8,17 A3,3 0 1 1 2,17 A3,3 0 1 1 8,17 M22,17 A3,3 0 1 1 16,17 A3,3 0 1 1 22,17 M7,15 L18,2 M17,15 L6,2" },
            { "send", "M2,3 L22,12 L2,21 L6,12 Z M6,12 L21,12" },
            { "save", "M4,3 L18,3 L22,7 L22,22 L3,22 L3,3 Z M7,3 L7,10 L17,10 L17,3 M7,22 L7,15 L18,15 L18,22" },
            { "trash", "M3,6 L21,6 M8,6 L8,3 L16,3 L16,6 M5,6 L6,22 L18,22 L19,6 M10,10 L10,18 M14,10 L14,18" },
            { "mic", "M9,5 A3,3 0 0 1 15,5 L15,12 A3,3 0 0 1 9,12 Z M5,10 L5,12 C5,21 19,21 19,12 L19,10 M12,19 L12,23 M8,23 L16,23" },
            { "check", "M3,12 L9,18 L21,5" },
            { "list", "M8,5 L22,5 M8,12 L22,12 M8,19 L22,19 M2,5 L3,5 M2,12 L3,12 M2,19 L3,19" },
            { "left", "M3,4 L21,4 M3,9 L15,9 M3,14 L21,14 M3,19 L15,19" },
            { "centre", "M3,4 L21,4 M6,9 L18,9 M3,14 L21,14 M6,19 L18,19" },
            { "right", "M3,4 L21,4 M9,9 L21,9 M3,14 L21,14 M9,19 L21,19" },
            { "justify", "M3,4 L21,4 M3,9 L21,9 M3,14 L21,14 M3,19 L21,19" },
            { "highlight", "M6,16 L15,3 L21,7 L12,20 Z M6,16 L12,20 L4,22 Z M2,23 L15,23" },
            { "colour", "M6,17 L12,3 L18,17 M8,12 L16,12 M3,22 L21,22" },
            { "table", "M3,3 L21,3 L21,21 L3,21 Z M3,9 L21,9 M3,15 L21,15 M9,3 L9,21 M15,3 L15,21" },
            { "clock", "M21,12 A9,9 0 1 1 3,12 A9,9 0 1 1 21,12 M12,6 L12,12 L16,14" },
            { "read", "M3,4 L11,6 L11,22 L3,20 Z M21,4 L13,6 L13,22 L21,20 Z" },
            { "undo", "M3,10 L8,4 M3,10 L10,11 M3,10 C17,0 27,12 19,21" },
            { "redo", "M21,10 L16,4 M21,10 L14,11 M21,10 C7,0 -3,12 5,21" },
            { "flag", "M4,23 L4,3 L13,3 L15,6 L22,6 L22,16 L13,16 L11,13 L4,13" },
            { "paint", "M5,3 L21,3 L21,10 L5,10 Z M5,6 L2,6 L2,14 L13,14 L13,18 M11,18 L15,18 L15,24 L11,24 Z" },
            { "more", "M4,12 L5,12 M11,12 L12,12 M18,12 L19,12" }
        };
        private static FrameworkElement DrawIcon(string name, Brush foreground) {
            var drawing = new Canvas { Width = 26, Height = 26 };
            var path = new Path { Data = Geometry.Parse(iconPaths.ContainsKey(name) ? iconPaths[name] : iconPaths["more"]), Stroke = foreground, StrokeThickness = 1.8, StrokeStartLineCap = PenLineCap.Round, StrokeEndLineCap = PenLineCap.Round, StrokeLineJoin = PenLineJoin.Round };
            drawing.Children.Add(path); return new Viewbox { Width = 17, Height = 17, Child = drawing, VerticalAlignment = VerticalAlignment.Center };
        }
        private static string IconName(string label) {
            string value = label.ToLowerInvariant();
            if (value.Contains("attach") || value.StartsWith("📎")) return "attach";
            if (value.Contains("link")) return "link";
            if (value.Contains("signature")) return "signature";
            if (value.Contains("contact") || value.Contains("names") || value.StartsWith("add to")) return "contacts";
            if (value.Contains("paste")) return "paste"; if (value == "copy") return "copy"; if (value == "cut") return "cut";
            if (value.StartsWith("send")) return "send"; if (value.Contains("save") || value.Contains("export") || value.Contains("import")) return "save";
            if (value.Contains("discard")) return "trash"; if (value.Contains("dictat")) return "mic";
            if (value.Contains("spell")) return "check"; if (value.Contains("list")) return "list";
            if (value.Contains("left")) return "left"; if (value.Contains("centre")) return "centre"; if (value.Contains("right")) return "right"; if (value.Contains("justify")) return "justify";
            if (value.Contains("highlight")) return "highlight"; if (value.Contains("colour")) return "colour";
            if (value.Contains("table")) return "table"; if (value.Contains("date")) return "clock";
            if (value.Contains("read")) return "read"; if (value == "undo") return "undo"; if (value == "redo") return "redo";
            if (value.Contains("flag") || value.Contains("follow") || value.Contains("importance")) return "flag";
            if (value.Contains("format")) return "paint"; return "more";
        }
        private static object ToolContent(string label, bool primary) {
            var foreground = primary ? Brushes.White : Theme.B("Text");
            if (Array.IndexOf(new[] { "B", "I", "U", "A+", "A−" }, label) >= 0) {
                var letter = new TextBlock { Text = label, FontSize = 14, Foreground = foreground, MinWidth = 16, TextAlignment = TextAlignment.Center };
                if (label == "B") letter.FontWeight = FontWeights.Bold;
                if (label == "I") letter.FontStyle = FontStyles.Italic;
                if (label == "U") letter.TextDecorations = TextDecorations.Underline;
                return letter;
            }
            var row = new StackPanel { Orientation = Orientation.Horizontal };
            row.Children.Add(DrawIcon(IconName(label), foreground));
            bool compact = label.StartsWith("≡") || label == "A Colour" || label == "Highlight" || label == "• List" || label == "1. List";
            if (!compact) {
                string text = label.Replace("📎 ", "").Replace("● ", "").Replace(" ↗", "");
                row.Children.Add(new TextBlock { Text = text, FontSize = 12, Foreground = foreground, Margin = new Thickness(7, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center });
            } else if (label == "1. List") row.Children.Add(new TextBlock { Text = "1", FontSize = 9, Foreground = foreground, Margin = new Thickness(2, 0, 0, 0) });
            return row;
        }
        private static TabControl CreateRibbon() {
            return (TabControl)XamlReader.Parse(@"<TabControl xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' Background='Transparent' BorderThickness='0' Margin='0,0,0,14'><TabControl.Template><ControlTemplate TargetType='TabControl'><Grid><Grid.RowDefinitions><RowDefinition Height='Auto'/><RowDefinition Height='Auto'/></Grid.RowDefinitions><TabPanel IsItemsHost='True' Margin='0,0,0,6'/><Border Grid.Row='1' Background='{DynamicResource TSurface}' CornerRadius='17' Padding='10,8'><ContentPresenter x:Name='PART_SelectedContentHost' ContentSource='SelectedContent'/></Border></Grid></ControlTemplate></TabControl.Template></TabControl>");
        }
        private void BuildPolishedRibbon(TabControl tabs) {
            var message = RibbonTab(tabs, "Message");
            var shortcuts = new WrapPanel { Width = 800, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(1, 0, 1, 5) }; message.Children.Add(shortcuts);
            Tool(shortcuts, "Attach file", Attach); Tool(shortcuts, "Link", InsertLink); Tool(shortcuts, "Signature", InsertSignature); Tool(shortcuts, "Contacts", AddressBook); Command(shortcuts, "Paste", ApplicationCommands.Paste);
            var basic = new WrapPanel { Width = 800, HorizontalAlignment = HorizontalAlignment.Left }; message.Children.Add(basic); FontControls(basic);
            Command(basic, "B", EditingCommands.ToggleBold); Command(basic, "I", EditingCommands.ToggleItalic); Command(basic, "U", EditingCommands.ToggleUnderline);
            basic.Children.Add(new Border { Background = Theme.B("#DDE4EF"), Width = 1, Height = 20, Margin = new Thickness(9, 8, 9, 8) });
            Command(basic, "• List", EditingCommands.ToggleBullets); Command(basic, "1. List", EditingCommands.ToggleNumbering); Command(basic, "≡ Left", EditingCommands.AlignLeft); Command(basic, "≡ Centre", EditingCommands.AlignCenter); Command(basic, "≡ Right", EditingCommands.AlignRight);
            Tool(basic, "A Colour", delegate { ColorMenu(TextElement.ForegroundProperty); }); Tool(basic, "Highlight", delegate { ColorMenu(TextElement.BackgroundProperty); });
            var insert = RibbonTab(tabs, "Insert"); var inserts = Group(insert, "", 960); Tool(inserts, "Attach file", Attach); Tool(inserts, "Hyperlink", InsertLink); Tool(inserts, "Signature", InsertSignature); Tool(inserts, "Table", InsertTable); Tool(inserts, "Date / time", delegate { editor.Selection.Text = DateTime.Now.ToString("f"); editor.Focus(); }); Tool(inserts, "Horizontal rule", delegate { editor.Selection.Text = "\n────────────────────────\n"; editor.Focus(); });
            var format = RibbonTab(tabs, "Format"); var formatting = Group(format, "", 960); FontControls(formatting); FormatControls(formatting); Command(formatting, "Indent +", EditingCommands.IncreaseIndentation); Command(formatting, "Indent −", EditingCommands.DecreaseIndentation); Tool(formatting, "Clear formatting", delegate { editor.Selection.ClearAllProperties(); editor.Focus(); }); Tool(formatting, "Format painter", PaintFormat); Command(formatting, "Cut", ApplicationCommands.Cut); Command(formatting, "Copy", ApplicationCommands.Copy);
            var review = RibbonTab(tabs, "Review"); var reviews = Group(review, "", 960); Tool(reviews, "Check spelling", CheckSpelling); Tool(reviews, "Check names", CheckNames);
            dictateButton = Button("Dictate", Dictate, false); reviews.Children.Add(dictateButton); Tool(reviews, "Read aloud / stop", ReadAloud); Tool(reviews, "Reading view", ReadingView); Tool(reviews, "Word count", delegate { status.Text = WordCountText(); });
            var options = RibbonTab(tabs, "Options"); var opts = Group(options, "", 960); var importanceLabel = Text("Importance", 12); importanceLabel.VerticalAlignment = VerticalAlignment.Center; importanceLabel.Margin = new Thickness(8); opts.Children.Add(importanceLabel); opts.Children.Add(importance); opts.Children.Add(followUp);
            Tool(opts, "Switch page background", delegate { bool dark = editor.Background == Theme.B("Surface"); editor.Background = dark ? Brushes.White : Theme.B("Surface"); editor.Foreground = dark ? Brushes.Black : Theme.B("Text"); RichMail.AdaptDefaultColors(editor, editor.Foreground); editor.CaretBrush = editor.Foreground; });
            var file = RibbonTab(tabs, "File"); var files = Group(file, "", 960); Tool(files, "Save draft", delegate { Persist(false); }); Tool(files, "Export RTF…", ExportRtf); Tool(files, "Import RTF…", ImportRtf); Tool(files, "Undo", delegate { if (editor.CanUndo) editor.Undo(); }); Tool(files, "Redo", delegate { if (editor.CanRedo) editor.Redo(); });
        }
        private string WordCountText() { return RichMail.Plain(editor).Split((char[])null, StringSplitOptions.RemoveEmptyEntries).Length + " words · " + RichMail.Plain(editor).Length + " characters"; }
    }
}
