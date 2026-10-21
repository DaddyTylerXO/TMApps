# Launcher content

`experience.json` supplies the in-app KB Library and app detail screens. Keep `desktop/experience.json` identical for native macOS/Linux packaging. Windows embeds the content, and the desktop client bundles it. Rebuild and release the launcher to change this content.

Each app ID has a `releaseNotes` string, one optional `video` URL, and up to ten `screenshots` entries containing `url` and `caption`. Publish real app screenshots/videos in the app branch first, then use commit-pinned raw.githubusercontent.com/DaddyTylerXO/TMApps URLs. Do not add placeholder download URLs or advertise unproduced media. Missing entries are shown as unpublished. MP4 is the preferred showcase format for broad decoder support. Test actual playback on target operating systems before publishing a video.

KB IDs are stable (`Launcher-KB1`, etc.). Update article bodies, keep cross references valid, run the documented bundled Python `tools/build-kb.py`, and render/inspect the Word document before publishing an updated KB Library. `auth-config.json` contains only a project HTTPS origin and public key; its empty default intentionally disables sign-in. See `backend/README.md`.
