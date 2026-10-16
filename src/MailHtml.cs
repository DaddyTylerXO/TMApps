using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace Postbox {
    public static class MailHtml {
        public static string Export(FlowDocument document) { return "<html><body style=\"font-family:Segoe UI,sans-serif;color:#222;background:#fff\">" + Blocks(document.Blocks) + "</body></html>"; }
        private static string Blocks(BlockCollection blocks) {
            var output = new StringBuilder();
            foreach (Block block in blocks) {
                var paragraph = block as Paragraph;
                var section = block as Section;
                var list = block as System.Windows.Documents.List;
                var table = block as Table;
                if (paragraph != null) output.Append("<p style=\"margin:0 0 10px;text-align:" + paragraph.TextAlignment.ToString().ToLowerInvariant() + "\">" + Inlines(paragraph.Inlines) + "</p>");
                else if (section != null) output.Append(Blocks(section.Blocks));
                else if (list != null) { bool ordered = list.MarkerStyle == TextMarkerStyle.Decimal; output.Append(ordered ? "<ol>" : "<ul>"); foreach (ListItem item in list.ListItems) output.Append("<li>" + Blocks(item.Blocks) + "</li>"); output.Append(ordered ? "</ol>" : "</ul>"); }
                else if (table != null) { output.Append("<table style=\"border-collapse:collapse\">"); foreach (TableRowGroup group in table.RowGroups) foreach (TableRow row in group.Rows) { output.Append("<tr>"); foreach (TableCell cell in row.Cells) output.Append("<td style=\"border:1px solid #ccc;padding:8px\">" + Blocks(cell.Blocks) + "</td>"); output.Append("</tr>"); } output.Append("</table>"); }
            }
            return output.ToString();
        }
        private static string Encode(string value) { return WebUtility.HtmlEncode(value ?? ""); }
        private static string Inlines(InlineCollection inlines) {
            var output = new StringBuilder();
            foreach (Inline inline in inlines) {
                var run = inline as Run; var span = inline as Span; var link = inline as Hyperlink; var ui = inline as InlineUIContainer;
                string text = run != null ? Encode(run.Text).Replace("\n", "<br>") : span != null ? Inlines(span.Inlines) : inline is LineBreak ? "<br>" : "";
                if (ui != null) {
                    var image = ui.Child as Image; var source = image == null ? null : image.Source as BitmapSource;
                    if (source != null) using (var stream = new MemoryStream()) { var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(source)); encoder.Save(stream); text = "<img alt=\"Signature graphic\" style=\"max-width:600px\" src=\"data:image/png;base64," + Convert.ToBase64String(stream.ToArray()) + "\">"; }
                }
                string style = "font-family:" + Encode(inline.FontFamily.Source) + ";font-size:" + inline.FontSize.ToString(System.Globalization.CultureInfo.InvariantCulture) + "px;";
                if (inline.FontWeight >= FontWeights.Bold) style += "font-weight:bold;";
                if (inline.FontStyle == FontStyles.Italic) style += "font-style:italic;";
                if (inline.TextDecorations != null && inline.TextDecorations.Count > 0) style += "text-decoration:underline;";
                var color = inline.Foreground as SolidColorBrush;
                if (color != null && color.Color != ((SolidColorBrush)Theme.B("Text")).Color) style += "color:#" + color.Color.R.ToString("X2") + color.Color.G.ToString("X2") + color.Color.B.ToString("X2") + ";";
                var background = inline.Background as SolidColorBrush; if (background != null && background.Color.A > 0) style += "background-color:#" + background.Color.R.ToString("X2") + background.Color.G.ToString("X2") + background.Color.B.ToString("X2") + ";";
                text = "<span style=\"" + style + "\">" + text + "</span>";
                if (link != null && link.NavigateUri != null && new[] { "https", "http", "mailto" }.Contains(link.NavigateUri.Scheme)) text = "<a href=\"" + Encode(link.NavigateUri.AbsoluteUri) + "\">" + text + "</a>";
                output.Append(text);
            }
            return output.ToString();
        }
    }
}
