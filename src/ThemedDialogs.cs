using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Windows.Media;

namespace TMApps {
    public class ThemedDialog : Window {
        public readonly StackPanel Body,Actions;
        public ThemedDialog(Window owner,string title,string message) {
            Title=title; Width=600; SizeToContent=SizeToContent.Height; MaxHeight=Math.Min(800,SystemParameters.WorkArea.Height-40); ResizeMode=ResizeMode.NoResize;
            WindowStyle=WindowStyle.None; AllowsTransparency=true; Background=Brushes.Transparent; Foreground=(Brush)new BrushConverter().ConvertFromString("#ECEEF3"); FontFamily=new FontFamily("Segoe UI");
            WindowStartupLocation=WindowStartupLocation.CenterScreen;
            if(owner!=null && owner.IsLoaded) { Owner=owner; WindowStartupLocation=WindowStartupLocation.CenterOwner; Icon=owner.Icon; }
            Resources=(ResourceDictionary)XamlReader.Parse(@"<ResourceDictionary xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'>
             <Style TargetType='Button'><Setter Property='Background' Value='#2D313B'/><Setter Property='Foreground' Value='#ECEEF3'/><Setter Property='Padding' Value='18,11'/><Setter Property='Margin' Value='8,0,0,0'/><Setter Property='Cursor' Value='Hand'/><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='Button'><Border x:Name='Bubble' Background='{TemplateBinding Background}' CornerRadius='18' Padding='{TemplateBinding Padding}' BorderBrush='#F68B40' BorderThickness='0'><ContentPresenter HorizontalAlignment='Center' VerticalAlignment='Center'/></Border><ControlTemplate.Triggers><Trigger Property='IsMouseOver' Value='True'><Setter TargetName='Bubble' Property='Opacity' Value='0.8'/></Trigger><Trigger Property='IsKeyboardFocused' Value='True'><Setter TargetName='Bubble' Property='BorderThickness' Value='1'/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
             <Style TargetType='TextBox'><Setter Property='Foreground' Value='#ECEEF3'/><Setter Property='Background' Value='#2D313B'/><Setter Property='Padding' Value='12,10'/><Setter Property='CaretBrush' Value='#ECEEF3'/><Setter Property='Template'><Setter.Value><ControlTemplate TargetType='TextBox'><Border Background='{TemplateBinding Background}' CornerRadius='15' BorderBrush='#48424A' BorderThickness='1' Padding='{TemplateBinding Padding}'><ScrollViewer x:Name='PART_ContentHost'/></Border></ControlTemplate></Setter.Value></Setter></Style>
             <Style TargetType='CheckBox'><Setter Property='Foreground' Value='#ECEEF3'/></Style><Style TargetType='RadioButton'><Setter Property='Foreground' Value='#ECEEF3'/><Setter Property='Margin' Value='0,10'/></Style>
            </ResourceDictionary>");
            var outer=new Border { CornerRadius=new CornerRadius(20),Background=(Brush)new BrushConverter().ConvertFromString("#22252C"),BorderBrush=(Brush)new BrushConverter().ConvertFromString("#714022"),BorderThickness=new Thickness(1) }; Content=outer;
            var layout=new StackPanel(); outer.Child=layout;
            var header=new Border { CornerRadius=new CornerRadius(19,19,0,0),Background=(Brush)new BrushConverter().ConvertFromString("#412313"),Padding=new Thickness(23,18,16,18) };
            header.MouseLeftButtonDown+=(s,e)=>{ if(e.LeftButton==System.Windows.Input.MouseButtonState.Pressed) DragMove(); };
            var row=new DockPanel(); header.Child=row; layout.Children.Add(header);
            var close=new Button { Content="×",Padding=new Thickness(10,4,10,4),ToolTip="Cancel",IsCancel=true }; close.Click+=(s,e)=>Close(); DockPanel.SetDock(close,Dock.Right); row.Children.Add(close);
            row.Children.Add(new TextBlock { Text=title,FontSize=22,FontWeight=FontWeights.SemiBold,VerticalAlignment=VerticalAlignment.Center,TextWrapping=TextWrapping.Wrap });
            Body=new StackPanel { Margin=new Thickness(24,20,24,10) }; layout.Children.Add(new ScrollViewer { Content=Body,MaxHeight=Math.Max(200,MaxHeight-175),VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled });
            Body.Children.Add(new TextBlock { Text=message,Foreground=(Brush)new BrushConverter().ConvertFromString("#BBC2CE"),TextWrapping=TextWrapping.Wrap,LineHeight=21,Margin=new Thickness(0,0,0,12) });
            Actions=new StackPanel { Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right,Margin=new Thickness(16,12,24,22) }; layout.Children.Add(Actions);
        }
        public Button AddAction(string text,bool primary,Action clicked,string name) {
            var button=new Button { Name=name,Content=text };
            if(primary) button.Background=(Brush)new BrushConverter().ConvertFromString("#CC5500");
            button.Click+=(s,e)=>clicked(); Actions.Children.Add(button); return button;
        }
    }
    public static class ThemedDialogs {
        public static bool Confirm(Window owner,string title,string message,string action) {
            var dialog=new ThemedDialog(owner,title,message);
            dialog.AddAction("Cancel",false,()=>dialog.Close(),"CancelAction").IsCancel=true;
            dialog.AddAction(action,true,()=>dialog.DialogResult=true,"ConfirmAction");
            return dialog.ShowDialog()==true;
        }
        public static void Info(Window owner,string title,string message) {
            var dialog=new ThemedDialog(owner,title,message); dialog.AddAction("OK",true,()=>dialog.Close(),"ConfirmAction"); dialog.ShowDialog();
        }
        public static UninstallOptions Uninstall(Window owner,AppInfo app,string[] locations) {
            var dialog=new ThemedDialog(owner,"Uninstall "+app.name,"Remove the application and its launcher-managed startup entry and desktop icon. Choose what happens to its local data.");
            var keep=new RadioButton { Name="KeepData",Content="Keep local data (recommended)",IsChecked=true }; dialog.Body.Children.Add(keep);
            var delete=new RadioButton { Name="DeleteData",Content="Delete local data permanently" }; dialog.Body.Children.Add(delete);
            dialog.Body.Children.Add(new TextBlock { Text="This includes saved accounts, settings, caches, and projects stored inside the app profile. It affects all copies for this Windows user. Server mail, external work folders, and custom --data-dir profiles are not removed.",Foreground=Brushes.LightGray,TextWrapping=TextWrapping.Wrap,FontSize=11,Margin=new Thickness(0,8,0,10) });
            dialog.Body.Children.Add(new TextBlock { Text="Standard local data folders:\n"+String.Join("\n",locations),Foreground=Brushes.LightGray,TextWrapping=TextWrapping.Wrap,FontSize=11 });
            UninstallOptions result=null;
            dialog.AddAction("Cancel",false,()=>dialog.Close(),"CancelAction").IsCancel=true;
            var confirm=dialog.AddAction("Uninstall and keep data",true,()=>{ result=new UninstallOptions { deleteLocalData=delete.IsChecked==true }; dialog.DialogResult=true; },"ConfirmAction");
            delete.Checked+=(s,e)=>confirm.Content="Uninstall and delete data"; keep.Checked+=(s,e)=>confirm.Content="Uninstall and keep data";
            dialog.ShowDialog(); return result;
        }
    }
}
