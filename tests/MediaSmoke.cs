using System;
using Postbox;

class MediaSmoke {
    static void Main() {
        var state = new SpotifyClient().Read().GetAwaiter().GetResult();
        Console.WriteLine(state.Available ? "Spotify media session discovered. Playback controls were not invoked." : "Windows media discovery succeeded. No Spotify media session is active.");
    }
}
