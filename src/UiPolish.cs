using System;
using System.Linq;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Windows.Media;
namespace Postbox {
    public static class UiPolish {
        private static ControlTemplate pill;
        private static void Pill(Button button) {
            if (pill == null) pill = (ControlTemplate)XamlReader.Parse("<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml' TargetType='Button'><Border x:Name='pill' Background='{TemplateBinding Background}' CornerRadius='18' Padding='{TemplateBinding Padding}' BorderThickness='{TemplateBinding BorderThickness}' BorderBrush='{TemplateBinding BorderBrush}'><ContentPresenter HorizontalAlignment='{TemplateBinding HorizontalContentAlignment}' VerticalAlignment='Center'/></Border><ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter TargetName='pill' Property='Opacity' Value='0.82'/></Trigger><Trigger Property='IsPressed' Value='True'><Setter TargetName='pill' Property='Opacity' Value='0.65'/></Trigger><Trigger Property='IsEnabled' Value='False'><Setter TargetName='pill' Property='Opacity' Value='0.4'/></Trigger><Trigger Property='IsKeyboardFocused' Value='True'><Setter TargetName='pill' Property='BorderThickness' Value='1'/><Setter TargetName='pill' Property='BorderBrush' Value='White'/></Trigger></ControlTemplate.Triggers></ControlTemplate>");
            button.Template = pill;
        }
        private sealed class Caption : StackPanel { public string Text; public override string ToString() { return Text; } }
        public static void Navigation(Button button, string caption, string kind, bool iconOnly) {
            string path = kind == "wrench" ? "M14.7 6.3 A1 1 0 0 0 14.7 7.7 L16.3 9.3 A1 1 0 0 0 17.7 9.3 L21 6 A6 6 0 0 1 13.06 13.94 L5.5 21.5 A2.12 2.12 0 0 1 2.5 18.5 L10.06 10.94 A6 6 0 0 1 18 3 Z" : kind == "calendar" ? "M3 5 L21 5 L21 21 L3 21 Z M3 10 L21 10 M7 2 L7 7 M17 2 L17 7 M7 14 L10 14 M14 14 L17 14 M7 18 L10 18" : "M2 6 L18 6 L18 20 L2 20 Z M2 6 L10 13 L18 6 M20 1 L20 7 M17 4 L23 4";
            var drawing = new GeometryDrawing(null, new Pen(Brushes.White, 1.7) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round, LineJoin = PenLineJoin.Round }, Geometry.Parse(path)); drawing.Freeze(); var source = new DrawingImage(drawing); source.Freeze();
            var panel = new Caption { Text = caption, Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center, HorizontalAlignment = HorizontalAlignment.Center, UseLayoutRounding = true };
            panel.Children.Add(new Image { Source = source, Width = 20, Height = 20, Stretch = Stretch.Uniform, SnapsToDevicePixels = true, Margin = new Thickness(0, 0, iconOnly ? 0 : 9, 0) }); if (!iconOnly) panel.Children.Add(new TextBlock { Text = caption, FontSize = 12, FontWeight = FontWeights.SemiBold, Foreground = Brushes.White, VerticalAlignment = VerticalAlignment.Center });
            button.Content = panel; Pill(button); AutomationProperties.SetName(button, caption);
        }
        public static void MailAction(Button button) { Pill(button); button.Height = 32; button.MinHeight = 32; button.Padding = new Thickness(12, 6, 12, 6); button.Margin = new Thickness(0, 4, 8, 4); button.FontSize = 12; button.FontWeight = FontWeights.Normal; button.Background = Theme.B("SidebarAccent"); button.Foreground = Brushes.White; button.VerticalAlignment = VerticalAlignment.Top; button.HorizontalAlignment = HorizontalAlignment.Left; }
        private static readonly DependencyProperty SettingsPrimary = DependencyProperty.RegisterAttached("SettingsPrimary", typeof(bool?), typeof(UiPolish), new PropertyMetadata(null));
        private static DataTemplate settingsCaption;
        public static void SettingsButton(Button button) { Pill(button);
            var primary = (bool?)button.GetValue(SettingsPrimary); if (!primary.HasValue) { var color = button.Background as SolidColorBrush; primary = color != null && (color.Color == ((SolidColorBrush)Theme.B("Accent")).Color || color.Color == ((SolidColorBrush)Theme.B("SidebarAccent")).Color); button.SetValue(SettingsPrimary, primary); }
            button.Background = Theme.B(primary.Value ? "SidebarAccent" : "SidebarSelected"); button.Foreground = Brushes.White; button.MinHeight = 36; button.Padding = new Thickness(14, 8, 14, 8); button.HorizontalAlignment = HorizontalAlignment.Left; button.VerticalAlignment = VerticalAlignment.Center;
            button.Margin = new Thickness(button.Margin.Left, Math.Max(4, button.Margin.Top), Math.Max(10, button.Margin.Right), Math.Max(10, button.Margin.Bottom));
            if (button.Content is string) { if (settingsCaption == null) settingsCaption = (DataTemplate)XamlReader.Parse("<DataTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation'><TextBlock Text='{Binding}' TextWrapping='Wrap' TextAlignment='Center'/></DataTemplate>"); button.ContentTemplate = settingsCaption; }
        }
        public static void SettingsTree(DependencyObject root) { var button = root as Button; if (button != null) SettingsButton(button); foreach (var child in LogicalTreeHelper.GetChildren(root).OfType<DependencyObject>().ToList()) SettingsTree(child); }
    }
}
