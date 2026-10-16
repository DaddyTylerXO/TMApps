using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;

class LayoutTests {
    [STAThread] static void Main(string[] args) {
        Window window;
        using (var source = File.OpenRead(args[0])) window = (Window)XamlReader.Load(source);
        foreach (double width in new[] { 1000.0, 1420.0 }) {
            window.Width = width;
            var content = (FrameworkElement)window.Content;
            content.Measure(new Size(width - 16, 860));
            content.Arrange(new Rect(0, 0, width - 16, 860));
            content.UpdateLayout();
            var search = (TextBox)window.FindName("SearchBox");
            if (search.ActualWidth < 250) throw new Exception("Search input collapsed at width " + width);
            var list = (ListBox)window.FindName("MessageList");
            if (list.ActualWidth < 280) throw new Exception("Message list too narrow");
        }
        window.Close();
        Console.WriteLine("Passed XAML loading and layout checks at 1000px and 1420px.");
    }
}
