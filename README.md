# TMA-Cut

A local video editor for the TMApps suite, with a red camera icon, rounded controls, and the suite's dark palette. Windows x64, macOS Intel/Apple silicon, and Linux x64 packages are built by GitHub Actions. Native builds are unsigned / macOS ad-hoc signed and are not notarized.

## Editing in 0.2.0

- Import video, audio, images and GIFs onto stacked tracks; trim, split, group, copy/paste, change speed and merge selections on a non-destructive timeline.
- Pick 16:9, 9:16, 1:1, 4:5, or 4:3. Fit the full frame against a solid colour or blurred copy of the source.
- Add styled text, captions, overlays and watermarks. Use colour correction, HSL, filters, blurs, shape masks, chroma key and position/zoom key markers. Save colour profiles and project templates.
- Undo/redo, save `.tmacut` projects, reopen them, and locate missing source files. Projects reference original media; keep the originals with your edit.
- Mix audio tracks, record voice over, extract audio, reduce noise, apply fades and duck against a reference track. Automatic captions require a configured local whisper.cpp executable/model. Microsoft speech uses installed Windows voices or a configured Azure Speech resource.
- Export MP4, MOV, MKV, WebM, GIF, WAV or MP3 with format-specific encoding controls. Video supports 480p–4K, 24–144 fps and 5–100 Mbps; GIF supports 240–640px and 1–60 fps. Resolution is the short edge: portrait 4K is 2160 × 3840. Scaling and frame conversion do not provide AI enhancement or optical flow. Size/time estimates are approximate.
- Smart HDR detects PQ/HLG footage and tone-maps it to BT.709 SDR. It does not produce HDR output or invent HDR detail. Preview uses the system decoder; export is the authoritative render.
- Export to authorised linked accounts through private YouTube uploads or TikTok inbox drafts, using tokens for your own approved application/scopes. TikTok publishing finishes in TikTok. Browser uploaders are also available. Connection keys are encrypted using the operating system keychain; insecure fallback storage is refused.
- Resize and dock panels, pop the live preview onto another screen, customise shortcuts and timeline colours, save UI profiles, and use the asset library, favourites and declarative preset-pack manager.
- Autosaving and backups are on by default. Settings include search, gradual theme schedules, optional CPU/RAM information, storage scans and reusable intro/ending sources.

See the complete [feature coverage and limits](FEATURES.md), [KB Library](docs/KB%20Library.md), [Word user guide](docs/KB%20Library.docx), [change log](CHANGELOG.md) and [performance checks](docs/Performance.md). Recording identification through AcoustID is **not copyright clearance**. Tracking is a limited local patch matcher; GPU utilisation, executable plugins and embedded MP4 cover art are not provided. External services require separate setup.

The red tray popup follows TMA-Mail's 14px rounded container and 19px button shapes. Linux DBus StatusNotifier hosts receive a native menu; the desktop theme controls that fallback's colours. Closing can retain the app in the tray. Quitting asks before discarding edits or cancelling an export.

## Run and verify

Use Node 24 and pnpm 10 or newer:

```sh
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/electron/install.js
node node_modules/ffmpeg-static/install.js
pnpm start
pnpm test
pnpm package
```

FFmpeg/FFprobe are bundled. Development overrides: `TMA_CUT_FFMPEG` and `TMA_CUT_FFPROBE`. Package on each target OS / architecture so media tools match it. Tests render actual video covering stacked composition, transparency, grading, masks, speed, audio ducking, captions, all output containers, 4K/144fps and HDR tone mapping, plus UI, storage, integration-request and performance tests. Preview uses fast approximations; rendered export is authoritative.

## Releases and launcher

Pushes to [TMA-Cut](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Cut) run `.github/workflows/release.yml`. All four native builds must pass before packages and SHA-256 files publish to the existing `tma-apps` release. The shared catalog is merged with existing apps and uploaded after all packages upload successfully. The launcher must include the Cut registration before reading the six-app catalog. Launcher changes live on [TMApps-Launcher](https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher).

See [third-party notices](THIRD_PARTY.md) for media-tool licenses and source links.


