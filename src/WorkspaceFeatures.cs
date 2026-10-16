using System;
using System.Windows;
using System.Windows.Controls;

namespace Postbox {
    public partial class App {
        private FrameworkElement inboxPanel, previewPanel;
        private DockPanel centerHost;
        private StackPanel navigationFooter;
        private SpotifyWidget spotify;
        private GridSplitter inboxSplitter;
        private System.Windows.Controls.Primitives.Thumb navigationResizer;
        private double FittedNavigationWidth() { return Math.Max(180, Math.Min(preferences.NavigationWidth, Math.Max(180, Math.Min(520, (window.ActualWidth > 0 ? window.ActualWidth : window.Width) - 620)))); }
        private void ConstrainInboxSize() {
            bool horizontal = preferences.InboxEdge == "Top" || preferences.InboxEdge == "Bottom";
            bool reversed = preferences.InboxEdge == "Right" || preferences.InboxEdge == "Bottom";
            int index = reversed ? 1 : 0;
            if (horizontal && mailArea.RowDefinitions.Count == 2) mailArea.RowDefinitions[index].Height = new GridLength(Math.Max(180, Math.Min(preferences.InboxHeight, mailArea.ActualHeight - 160)));
            if (!horizontal && mailArea.ColumnDefinitions.Count == 2) mailArea.ColumnDefinitions[index].Width = new GridLength(Math.Max(290, Math.Min(preferences.InboxWidth, mailArea.ActualWidth - 320)));
        }
        private void SavePaneSizes() { try { settingsStore.Save(preferences); } catch (Exception ex) { Status("Pane size could not be saved: " + ex.Message); } }
        private void ApplyNavigationResize() {
            if (navigationResizer != null) workspace.Children.Remove(navigationResizer);
            if (preferences.NavigationCollapsed || preferences.NavigationEdge == "Top" || preferences.NavigationEdge == "Bottom") return;
            bool right = preferences.NavigationEdge == "Right";
            navigationResizer = new System.Windows.Controls.Primitives.Thumb { Width = 7, HorizontalAlignment = right ? HorizontalAlignment.Left : HorizontalAlignment.Right, Cursor = System.Windows.Input.Cursors.SizeWE, Background = System.Windows.Media.Brushes.Transparent, ToolTip = "Drag to resize folders" };
            navigationResizer.Template = (ControlTemplate)System.Windows.Markup.XamlReader.Parse("<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' TargetType='Thumb'><Border Background='Transparent'><Border Width='2' CornerRadius='1' Background='#3A8C5E' Opacity='0.4'/></Border></ControlTemplate>");
            System.Windows.Automation.AutomationProperties.SetName(navigationResizer, "Resize folders pane");
            Grid.SetRow(navigationResizer, 1); Grid.SetColumn(navigationResizer, right ? 2 : 0); Panel.SetZIndex(navigationResizer, 10); workspace.Children.Add(navigationResizer);
            navigationResizer.DragDelta += delegate(object sender, System.Windows.Controls.Primitives.DragDeltaEventArgs e) { double maximum = Math.Max(180, Math.Min(520, (window.ActualWidth > 0 ? window.ActualWidth : window.Width) - 620)); preferences.NavigationWidth = Math.Max(180, Math.Min(maximum, navigation.Width + (right ? -e.HorizontalChange : e.HorizontalChange))); navigation.Width = preferences.NavigationWidth; };
            navigationResizer.DragCompleted += delegate { SavePaneSizes(); ApplyNavigation(); };
        }
        private void ApplyInboxLayout() {
            if (inboxPanel == null || previewPanel == null) return;
            if (inboxSplitter != null) mailArea.Children.Remove(inboxSplitter);
            mailArea.ColumnDefinitions.Clear(); mailArea.RowDefinitions.Clear();
            bool horizontal = preferences.InboxEdge == "Top" || preferences.InboxEdge == "Bottom";
            bool reversed = preferences.InboxEdge == "Right" || preferences.InboxEdge == "Bottom";
            var border = inboxPanel as Border; if (border != null) border.BorderThickness = horizontal ? (reversed ? new Thickness(0, 1, 0, 0) : new Thickness(0, 0, 0, 1)) : (reversed ? new Thickness(1, 0, 0, 0) : new Thickness(0, 0, 1, 0));
            if (horizontal) {
                for (int i = 0; i < 2; i++) { bool list = (i == 0) != reversed; mailArea.RowDefinitions.Add(new RowDefinition { Height = list ? new GridLength(Math.Max(180, Math.Min(preferences.InboxHeight, Math.Max(180, mailArea.ActualHeight - 160)))) : new GridLength(1, GridUnitType.Star), MinHeight = list ? 180 : 160 }); }
                Grid.SetColumn(inboxPanel, 0); Grid.SetColumn(previewPanel, 0); Grid.SetRow(inboxPanel, reversed ? 1 : 0); Grid.SetRow(previewPanel, reversed ? 0 : 1);
            } else {
                for (int i = 0; i < 2; i++) { bool list = (i == 0) != reversed; mailArea.ColumnDefinitions.Add(new ColumnDefinition { Width = list ? new GridLength(Math.Max(290, Math.Min(preferences.InboxWidth, Math.Max(290, mailArea.ActualWidth - 320)))) : new GridLength(1, GridUnitType.Star), MinWidth = list ? 290 : 320 }); }
                Grid.SetRow(inboxPanel, 0); Grid.SetRow(previewPanel, 0); Grid.SetColumn(inboxPanel, reversed ? 1 : 0); Grid.SetColumn(previewPanel, reversed ? 0 : 1);
            }
            inboxSplitter = new GridSplitter { Background = System.Windows.Media.Brushes.Transparent, ShowsPreview = false, ResizeDirection = horizontal ? GridResizeDirection.Rows : GridResizeDirection.Columns, ResizeBehavior = reversed ? GridResizeBehavior.PreviousAndCurrent : GridResizeBehavior.CurrentAndNext, ToolTip = "Drag to resize the message list and preview" };
            inboxSplitter.Width = horizontal ? Double.NaN : 7; inboxSplitter.Height = horizontal ? 7 : Double.NaN;
            inboxSplitter.HorizontalAlignment = horizontal ? HorizontalAlignment.Stretch : reversed ? HorizontalAlignment.Left : HorizontalAlignment.Right;
            inboxSplitter.VerticalAlignment = horizontal ? (reversed ? VerticalAlignment.Top : VerticalAlignment.Bottom) : VerticalAlignment.Stretch;
            inboxSplitter.Template = (ControlTemplate)System.Windows.Markup.XamlReader.Parse("<ControlTemplate xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation' TargetType='GridSplitter'><Border Background='Transparent'><Border CornerRadius='3' Margin='2' Background='#3A8C5E' Opacity='0.45'/></Border></ControlTemplate>");
            Grid.SetRow(inboxSplitter, horizontal && reversed ? 1 : 0); Grid.SetColumn(inboxSplitter, !horizontal && reversed ? 1 : 0); Panel.SetZIndex(inboxSplitter, 10); mailArea.Children.Add(inboxSplitter);
            System.Windows.Automation.AutomationProperties.SetName(inboxSplitter, "Resize message list and preview");
            inboxSplitter.DragCompleted += delegate { if (horizontal) preferences.InboxHeight = mailArea.RowDefinitions[reversed ? 1 : 0].ActualHeight; else preferences.InboxWidth = mailArea.ColumnDefinitions[reversed ? 1 : 0].ActualWidth; SavePaneSizes(); };
        }
        private void ApplySpotifyPlacement() {
            if (centerHost == null || navigationFooter == null) return;
            if (spotify != null) { Detach(spotify); spotify.Stop(); }
            headerSearch.Width = 440;
            if (preferences.SpotifyPlacement == "Off") return;
            if (spotify == null) spotify = new SpotifyWidget();
            spotify.SetSidebar(preferences.SpotifyPlacement == "Sidebar");
            if (preferences.SpotifyPlacement == "Sidebar") {
                if (preferences.NavigationCollapsed) { spotify.ToolTip = "Expand the navigation ribbon to see Spotify"; return; }
                navigationFooter.Children.Insert(0, spotify);
            } else if (preferences.SpotifyPlacement == "Top") { headerSearch.Width = 210; spotify.SetHeader(); Grid.SetColumn(spotify, 1); headerLeft.Children.Add(spotify); }
            else { DockPanel.SetDock(spotify, Dock.Bottom); centerHost.Children.Insert(0, spotify); }
            spotify.Start();
        }
    }
}
