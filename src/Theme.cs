using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Data;
using System.ComponentModel;

namespace Postbox {
    public static class Theme {
        public static bool Dark = true;
        private static readonly Dictionary<string, SolidColorBrush> brushes = new Dictionary<string, SolidColorBrush>();
        private class ColorToken : INotifyPropertyChanged {
            public Color Color { get; set; }
            public event PropertyChangedEventHandler PropertyChanged;
            public void Update(Color value) { Color = value; if (PropertyChanged != null) PropertyChanged(this, new PropertyChangedEventArgs("Color")); }
        }
        private static readonly Dictionary<string, ColorToken> tokens = new Dictionary<string, ColorToken>();
        private static string ColorFor(string key) {
            switch (key.ToUpperInvariant()) {
                case "SIDEBARSELECTED": return "#28503A";
                case "SIDEBARACCENT": return "#3A8C5E";
                case "SURFACE": return Dark ? "#22252C" : "#FFFFFF";
                case "TEXT": case "#17243B": case "#243C60": case "#41516B": case "#4B5870": case "#4C5970": case "#53617A": return Dark ? "#ECEEF3" : "#242833";
                case "#14243E": return "#0D2419";
                case "#293F62": return "#35415B";
                case "ACCENT": case "#4D83F5": case "#447EF2": case "#386FD4": case "#3566B9": return Dark ? "#5975C5" : "#526BB0";
                case "CANVAS": case "#F5F7FB": case "#F8FAFD": return Dark ? "#17191F" : "#F4F5F8";
                case "RAISED": case "#F0F3F8": case "#F2F5F9": case "#F3F6FB": case "#F6F8FC": case "#EDF3FF": case "#ECF2FF": case "#E8EEFA": case "#E9EDFC": case "#DDE8FD": return Dark ? "#2D313B" : "#EDF0F6";
                case "BORDERS": case "#E7EBF2": case "#DDE4EF": case "#E4E9F1": case "#E3E8F1": case "#EDF0F5": case "#E1E6EF": return Dark ? "#393F4B" : "#DCE1EA";
                case "#244B91": case "#5378B8": case "#5775A8": case "#6D6EB0": return Dark ? "#B2C7FA" : "#405F9B";
                case "MUTED": case "#8793A7": case "#8090A8": case "#8290A7": case "#79879D": case "#697891": case "#7C8BA3": case "#8995A8": case "#91A0B4": case "#99A4B5": case "#A2ADBE": case "#8A98AC": case "#929DB0": return Dark ? "#A9B0C0" : "#667085";
                case "#BC4343": return Dark ? "#F39A92" : "#A82D2D";
                default: return key;
            }
        }
        public static Brush B(string key) {
            SolidColorBrush brush;
            if (!brushes.TryGetValue(key, out brush)) {
                var token = new ColorToken { Color = (Color)ColorConverter.ConvertFromString(ColorFor(key)) };
                brush = new SolidColorBrush(); BindingOperations.SetBinding(brush, SolidColorBrush.ColorProperty, new Binding("Color") { Source = token });
                tokens[key] = token; brushes[key] = brush;
            }
            return brush;
        }
        public static void SetMode(string mode) {
            Dark = mode != "Light";
            foreach (var entry in tokens) entry.Value.Update((Color)ColorConverter.ConvertFromString(ColorFor(entry.Key)));
            foreach (Window window in Application.Current.Windows) SetTitleBar(window);
        }
        public static void Install(Window window) {
            AppBrand.Apply(window);
            foreach (Match match in Regex.Matches(File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "MainWindow.xaml")), @"T([0-9A-Fa-f]{6})")) window.Resources[match.Value] = B("#" + match.Groups[1].Value);
            foreach (string key in new[] { "Surface", "Text", "#F5F7FB", "#F0F3F8", "#DDE4EF", "#4D83F5", "#8793A7", "#293F62" }) window.Resources["T" + key.Replace("#", "")] = B(key);
            window.Resources[SystemColors.WindowBrushKey] = B("Surface"); window.Resources[SystemColors.WindowTextBrushKey] = B("Text");
            window.Resources[SystemColors.ControlBrushKey] = B("#F0F3F8"); window.Resources[SystemColors.ControlTextBrushKey] = B("Text");
            window.Resources[SystemColors.HighlightBrushKey] = B("#293F62"); window.Resources[SystemColors.HighlightTextBrushKey] = Brushes.White;
            string styles = @"<ResourceDictionary xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'>
              <Style x:Key='MailScrollThumb' TargetType='Thumb'><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='Thumb'><Border Background='#3A8C5E' CornerRadius='5' Margin='2' MinWidth='5' MinHeight='5'/><ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter Property='Opacity' Value='0.75'/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
              <Style x:Key='MailScrollPage' TargetType='RepeatButton'><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='RepeatButton'><Border Background='Transparent'/></ControlTemplate></Setter.Value></Setter></Style>
              <Style TargetType='ScrollBar'><Setter Property='Width' Value='11'/><Setter Property='Background' Value='Transparent'/><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='ScrollBar'><Grid Background='{TemplateBinding Background}'><Track x:Name='PART_Track' Orientation='{TemplateBinding Orientation}' Minimum='{TemplateBinding Minimum}' Maximum='{TemplateBinding Maximum}' Value='{TemplateBinding Value}' ViewportSize='{TemplateBinding ViewportSize}' IsDirectionReversed='True'><Track.DecreaseRepeatButton><RepeatButton x:Name='decrease' Style='{StaticResource MailScrollPage}' Command='ScrollBar.PageUpCommand'/></Track.DecreaseRepeatButton><Track.Thumb><Thumb Style='{StaticResource MailScrollThumb}'/></Track.Thumb><Track.IncreaseRepeatButton><RepeatButton x:Name='increase' Style='{StaticResource MailScrollPage}' Command='ScrollBar.PageDownCommand'/></Track.IncreaseRepeatButton></Track></Grid><ControlTemplate.Triggers><Trigger Property='Orientation' Value='Horizontal'><Setter TargetName='PART_Track' Property='IsDirectionReversed' Value='False'/><Setter TargetName='decrease' Property='Command' Value='ScrollBar.PageLeftCommand'/><Setter TargetName='increase' Property='Command' Value='ScrollBar.PageRightCommand'/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter><Style.Triggers><Trigger Property='Orientation' Value='Horizontal'><Setter Property='Width' Value='Auto'/><Setter Property='Height' Value='11'/></Trigger></Style.Triggers></Style>
              <Style TargetType='Button'><Setter Property='Cursor' Value='Hand'/><Setter Property='FontSize' Value='12'/><Setter Property='HorizontalContentAlignment' Value='Center'/><Setter Property='VerticalContentAlignment' Value='Center'/><Setter Property='Background' Value='{DynamicResource TF0F3F8}'/><Setter Property='Foreground' Value='{DynamicResource TText}'/><Setter Property='Padding' Value='13,8'/><Setter Property='BorderThickness' Value='0'/><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='Button'><Border x:Name='pill' Background='{TemplateBinding Background}' CornerRadius='17' Padding='{TemplateBinding Padding}' BorderBrush='{TemplateBinding BorderBrush}' BorderThickness='{TemplateBinding BorderThickness}'><ContentPresenter HorizontalAlignment='{TemplateBinding HorizontalContentAlignment}' VerticalAlignment='Center'/></Border><ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter TargetName='pill' Property='Opacity' Value='0.78'/></Trigger><Trigger Property='IsPressed' Value='True'><Setter TargetName='pill' Property='Opacity' Value='0.56'/></Trigger><Trigger Property='IsKeyboardFocused' Value='True'><Setter TargetName='pill' Property='BorderThickness' Value='1'/><Setter TargetName='pill' Property='BorderBrush' Value='{DynamicResource T4D83F5}'/></Trigger><Trigger Property='IsEnabled' Value='False'><Setter TargetName='pill' Property='Opacity' Value='0.35'/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
              <Style TargetType='TextBox'><Setter Property='Background' Value='{DynamicResource TSurface}'/><Setter Property='Foreground' Value='{DynamicResource TText}'/><Setter Property='CaretBrush' Value='{DynamicResource TText}'/><Setter Property='BorderBrush' Value='{DynamicResource TDDE4EF}'/><Setter Property='Padding' Value='9'/></Style>
              <Style TargetType='CheckBox'><Setter Property='Foreground' Value='{DynamicResource TText}'/></Style>
              <Style TargetType='TabControl'><Setter Property='Background' Value='{DynamicResource TSurface}'/><Setter Property='Foreground' Value='{DynamicResource TText}'/><Setter Property='BorderThickness' Value='0'/></Style>
              <Style TargetType='TabItem'><Setter Property='Foreground' Value='{DynamicResource TText}'/><Setter Property='Background' Value='{DynamicResource TF0F3F8}'/><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='TabItem'><Border x:Name='b' Background='{TemplateBinding Background}' CornerRadius='15' Margin='2,3' Padding='13,8'><ContentPresenter ContentSource='Header'/></Border><ControlTemplate.Triggers><Trigger Property='IsSelected' Value='True'><Setter TargetName='b' Property='Background' Value='{DynamicResource T293F62}'/><Setter Property='Foreground' Value='{DynamicResource TText}'/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
              <Style TargetType='ComboBox'><Setter Property='Background' Value='{DynamicResource TF0F3F8}'/><Setter Property='Foreground' Value='{DynamicResource TText}'/><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='ComboBox'><Grid><ToggleButton Focusable='False' IsChecked='{Binding IsDropDownOpen, RelativeSource={RelativeSource TemplatedParent}, Mode=TwoWay}' Background='{DynamicResource TF0F3F8}' BorderBrush='{DynamicResource TDDE4EF}'><ToggleButton.Template><ControlTemplate TargetType='ToggleButton'><Border Background='{TemplateBinding Background}' BorderBrush='{TemplateBinding BorderBrush}' BorderThickness='1' CornerRadius='13'><DockPanel Margin='9'><TextBlock DockPanel.Dock='Right' Text='⌄' Foreground='{DynamicResource TText}'/><ContentPresenter Content='{Binding SelectionBoxItem, RelativeSource={RelativeSource AncestorType=ComboBox}}' Margin='0,0,12,0'/></DockPanel></Border></ControlTemplate></ToggleButton.Template></ToggleButton><Popup x:Name='PART_Popup' IsOpen='{TemplateBinding IsDropDownOpen}' Placement='Bottom' AllowsTransparency='True'><Border Background='{DynamicResource TSurface}' BorderBrush='{DynamicResource TDDE4EF}' BorderThickness='1' MinWidth='{Binding ActualWidth, RelativeSource={RelativeSource TemplatedParent}}'><ScrollViewer MaxHeight='280'><ItemsPresenter/></ScrollViewer></Border></Popup></Grid></ControlTemplate></Setter.Value></Setter></Style>
              <Style TargetType='ComboBoxItem'><Setter Property='Foreground' Value='{DynamicResource TText}'/><Setter Property='Background' Value='{DynamicResource TSurface}'/><Setter Property='Padding' Value='8'/></Style>
            </ResourceDictionary>";
            var dictionary = (ResourceDictionary)XamlReader.Parse(styles); window.Resources.MergedDictionaries.Add(dictionary);
            window.Background = B("#F5F7FB"); window.Foreground = B("Text");
            window.SourceInitialized += delegate { SetTitleBar(window); }; SetTitleBar(window);
        }
        [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr handle, int attribute, ref int value, int size);
        private static void SetTitleBar(Window window) { var handle = new WindowInteropHelper(window).Handle; if (handle == IntPtr.Zero) return; int dark = Dark ? 1 : 0; try { DwmSetWindowAttribute(handle, 20, ref dark, 4); } catch (DllNotFoundException) { } }
    }
}
