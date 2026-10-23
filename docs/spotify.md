# Spotify setup

The public desktop Client ID is `abc7cf7d00604cf7afd861e163c8be29`. Register exactly `http://127.0.0.1:43823/spotify/callback` in Spotify Developer settings. The public desktop client uses authorization-code PKCE with S256; there is no client secret. A loopback listener exists only during a requested sign-in and validates its random state before exchanging the authorization code.

Open Spotify in launcher navigation or Appearance settings. Connect Spotify, complete browser consent, then start playback in your Spotify app, phone, speaker or web player. Browser streaming opens `https://open.spotify.com/` in the user's browser; audio is not streamed through an unsupported embedded Electron SDK. Switch modes in the Spotify window. Controls operate the active Spotify device. Premium membership and developer-app user access are required; production distribution also depends on Spotify's quota/approval rules.

Windows uses DPAPI-protected refresh authorization. Electron clients use secure OS storage; Linux without a secure keyring keeps the session in memory. Access tokens are never returned to the renderer. Each app signs in separately. Finish one sign-in before connecting another because they use the same loopback port. Disconnect removes local authorization; revoke access through Spotify to remove provider authorization.

Refresh runs every 15 seconds while the music window is visible. Closing it stops refresh. Spotify playback continues on the selected device; browser playback uses the browser's own resources. Rate-limit responses pause requests. No background player is created at launcher startup.

The launcher implementation has isolated PKCE/state, token-storage, callback cancellation, playback-command, rate-limit, UI and resource checks. Live account authorization/playback is not yet verified. All eight companion app branches receive source updates only for later releases, as requested.

Primary provider documentation: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow and https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
