using System;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Windows.Foundation;
using Windows.Media.Control;

namespace Postbox {
    public class SpotifySnapshot {
        public string Title { get; set; }
        public string Artist { get; set; }
        public bool Available { get; set; }
        public bool Playing { get; set; }
        public bool CanToggle { get; set; }
        public bool CanNext { get; set; }
        public bool CanPrevious { get; set; }
    }
    public class SpotifyClient {
        private GlobalSystemMediaTransportControlsSessionManager manager;
        private GlobalSystemMediaTransportControlsSession session;
        private static async Task<T> Wait<T>(IAsyncOperation<T> operation) {
            try {
                for (int count = 0; operation.Status == AsyncStatus.Started; count++) { if (count >= 100) { operation.Cancel(); throw new TimeoutException("Windows media controls did not respond."); } await Task.Delay(100); }
                return operation.GetResults();
            } finally { operation.Close(); }
        }
        public static bool IsSpotify(string applicationId) { return !String.IsNullOrEmpty(applicationId) && applicationId.IndexOf("spotify", StringComparison.OrdinalIgnoreCase) >= 0; }
        public async Task<SpotifySnapshot> Read() {
            if (manager == null) manager = await Wait(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
            session = manager.GetSessions().FirstOrDefault(s => IsSpotify(s.SourceAppUserModelId));
            if (session == null) return new SpotifySnapshot { Title = "Spotify is not playing", Artist = "Open Spotify on this PC to see your music" };
            var media = await Wait(session.TryGetMediaPropertiesAsync()); var playback = session.GetPlaybackInfo(); var controls = playback.Controls;
            return new SpotifySnapshot { Title = String.IsNullOrEmpty(media.Title) ? "Spotify" : media.Title, Artist = media.Artist, Available = true, Playing = playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing, CanToggle = controls.IsPlayPauseToggleEnabled, CanNext = controls.IsNextEnabled, CanPrevious = controls.IsPreviousEnabled };
        }
        public async Task<bool> Control(string action) {
            var current = session; if (current == null || !IsSpotify(current.SourceAppUserModelId)) return false;
            if (action == "toggle") return await Wait(current.TryTogglePlayPauseAsync());
            if (action == "next") return await Wait(current.TrySkipNextAsync());
            if (action == "previous") return await Wait(current.TrySkipPreviousAsync());
            throw new ArgumentException("Unknown playback action.");
        }
    }
    public class SpotifyWidget : Border, IDisposable {
        private readonly SpotifyClient client = new SpotifyClient();
        private readonly DispatcherTimer timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        private readonly StackPanel layout, details, controls;
        private readonly TextBlock title, artist;
        private readonly Button play, next, previous;
        private bool busy, disposed, active;
        public SpotifyWidget() {
            Background = Theme.B("Surface"); CornerRadius = new CornerRadius(14); Padding = new Thickness(14, 10, 14, 10); Margin = new Thickness(12, 8, 12, 8);
            layout = new StackPanel { Orientation = Orientation.Horizontal }; Child = layout;
            details = new StackPanel { Width = 300, Margin = new Thickness(0, 0, 18, 0) }; layout.Children.Add(details);
            details.Children.Add(new TextBlock { Text = "SPOTIFY", FontSize = 9, Foreground = Theme.B("#8793A7"), Margin = new Thickness(0, 0, 0, 3) });
            title = new TextBlock { Text = "Checking Spotify…", FontSize = 12, FontWeight = FontWeights.SemiBold, Foreground = Theme.B("Text"), TextTrimming = TextTrimming.CharacterEllipsis }; artist = new TextBlock { FontSize = 10, Foreground = Theme.B("#8793A7"), TextTrimming = TextTrimming.CharacterEllipsis, Margin = new Thickness(0, 3, 0, 0) }; details.Children.Add(title); details.Children.Add(artist);
            controls = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center }; layout.Children.Add(controls);
            previous = ControlButton("|‹", "Previous track", "previous"); play = ControlButton("▶", "Play or pause Spotify", "toggle"); next = ControlButton("›|", "Next track", "next"); controls.Children.Add(previous); controls.Children.Add(play); controls.Children.Add(next);
            timer.Tick += async delegate { await Refresh(); };
        }
        public void SetSidebar(bool sidebar) { layout.Orientation = sidebar ? Orientation.Vertical : Orientation.Horizontal; details.Width = sidebar ? 160 : 300; details.Margin = new Thickness(0, 0, sidebar ? 0 : 18, sidebar ? 8 : 0); }
        public async void Start() { if (disposed) return; active = true; timer.Start(); await Refresh(); }
        public void Stop() { active = false; timer.Stop(); }
        private Button ControlButton(string text, string hint, string action) {
            var button = new Button { Content = text, ToolTip = hint, Padding = new Thickness(10, 7, 10, 7), Margin = new Thickness(2), IsEnabled = false };
            button.Click += async delegate {
                if (busy || !active || disposed) return; busy = true; SetControls(false, false, false);
                try { if (!await client.Control(action)) artist.Text = "Spotify did not accept this playback action"; }
                catch (Exception ex) { artist.Text = "Playback control unavailable"; ToolTip = ex.Message; }
                finally { busy = false; }
                if (active && !disposed) await Refresh();
            }; return button;
        }
        private void SetControls(bool toggle, bool skipNext, bool skipPrevious) { play.IsEnabled = toggle; next.IsEnabled = skipNext; previous.IsEnabled = skipPrevious; }
        private async Task Refresh() {
            if (busy || !active || disposed) return; busy = true;
            try {
                var state = await client.Read(); if (!active || disposed) return;
                title.Text = state.Title; title.ToolTip = state.Title; artist.Text = state.Artist; artist.ToolTip = state.Artist;
                play.Content = state.Playing ? "Ⅱ" : "▶"; SetControls(state.Available && state.CanToggle, state.Available && state.CanNext, state.Available && state.CanPrevious); timer.Interval = TimeSpan.FromSeconds(3); ToolTip = "Controls the Spotify desktop media session on this PC";
            } catch (Exception ex) { if (active && !disposed) { title.Text = "Spotify controls unavailable"; artist.Text = "Windows could not access a Spotify media session"; ToolTip = ex.Message; SetControls(false, false, false); timer.Interval = TimeSpan.FromSeconds(15); } }
            finally { busy = false; }
        }
        public void Dispose() { Stop(); disposed = true; }
    }
}
