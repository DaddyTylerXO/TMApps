using System;
using System.Windows;
using System.Windows.Controls;

namespace Postbox {
    public partial class App {
        private FrameworkElement inboxPanel, previewPanel;
        private DockPanel centerHost;
        private StackPanel navigationFooter;
        private SpotifyWidget spotify;
        private void ApplyInboxLayout() {
            if (inboxPanel == null || previewPanel == null) return;
            mailArea.ColumnDefinitions.Clear(); mailArea.RowDefinitions.Clear();
            bool horizontal = preferences.InboxEdge == "Top" || preferences.InboxEdge == "Bottom";
            bool reversed = preferences.InboxEdge == "Right" || preferences.InboxEdge == "Bottom";
            var border = inboxPanel as Border; if (border != null) border.BorderThickness = horizontal ? (reversed ? new Thickness(0, 1, 0, 0) : new Thickness(0, 0, 0, 1)) : (reversed ? new Thickness(1, 0, 0, 0) : new Thickness(0, 0, 1, 0));
            if (horizontal) {
                for (int i = 0; i < 2; i++) { bool list = (i == 0) != reversed; mailArea.RowDefinitions.Add(new RowDefinition { Height = new GridLength(list ? 0.42 : 0.58, GridUnitType.Star), MinHeight = list ? 180 : 160, MaxHeight = list ? 300 : Double.PositiveInfinity }); }
                Grid.SetColumn(inboxPanel, 0); Grid.SetColumn(previewPanel, 0); Grid.SetRow(inboxPanel, reversed ? 1 : 0); Grid.SetRow(previewPanel, reversed ? 0 : 1);
            } else {
                for (int i = 0; i < 2; i++) { bool list = (i == 0) != reversed; mailArea.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(list ? 0.5 : 1, GridUnitType.Star), MinWidth = list ? 290 : 420, MaxWidth = list ? 365 : Double.PositiveInfinity }); }
                Grid.SetRow(inboxPanel, 0); Grid.SetRow(previewPanel, 0); Grid.SetColumn(inboxPanel, reversed ? 1 : 0); Grid.SetColumn(previewPanel, reversed ? 0 : 1);
            }
        }
        private void ApplySpotifyPlacement() {
            if (centerHost == null || navigationFooter == null) return;
            if (spotify != null) { Detach(spotify); spotify.Stop(); }
            if (preferences.SpotifyPlacement == "Off") return;
            if (spotify == null) spotify = new SpotifyWidget();
            spotify.SetSidebar(preferences.SpotifyPlacement == "Sidebar");
            if (preferences.SpotifyPlacement == "Sidebar") {
                if (preferences.NavigationCollapsed) { spotify.ToolTip = "Expand the navigation ribbon to see Spotify"; return; }
                navigationFooter.Children.Insert(0, spotify);
            } else { DockPanel.SetDock(spotify, preferences.SpotifyPlacement == "Top" ? Dock.Top : Dock.Bottom); centerHost.Children.Insert(0, spotify); }
            spotify.Start();
        }
    }
}
