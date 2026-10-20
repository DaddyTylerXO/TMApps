# TMA-Cut

A local video editor for the TMApps suite, with a red camera icon, rounded controls, and the suite's dark palette. Windows x64, macOS Intel/Apple silicon, and Linux x64 packages are built by GitHub Actions. Native builds are unsigned / macOS ad-hoc signed and are not notarized.

## Editing

- Import multiple videos; join, reorder, remove, and trim them on a non-destructive timeline.
- Pick 16:9, 9:16, 1:1, 4:5, or 4:3. Fit the full frame against a solid colour or blurred copy of the source.
- Add a title, manually timed captions or imported SRT captions, a watermark, and an image overlay with position, size, opacity, and PNG transparency.
- Undo/redo, save `.tmacut` projects, reopen them, and locate missing source files. Projects reference original media; keep the originals with your edit.
- Export MP4 / H.264 with AAC audio at 480p, 720p, 1080p, 1440p, or 4K, 24–144 fps, and 5–100 Mbps. Resolution is the short edge: portrait 4K is 2160 × 3840. Frame conversion duplicates/drops frames; it is not AI interpolation. Bitrate is a target; actual size varies by content.
- Smart HDR detects PQ/HLG footage and tone-maps it to BT.709 SDR. It does not produce HDR output or invent HDR detail. Preview uses the system decoder; export is the authoritative render.
- Export, then open TikTok Studio, YouTube Studio, or Instagram with the file revealed in your file manager. Users choose the file, sign in, and confirm publishing. This version does not store social credentials or perform direct API uploads.

The red tray popup follows TMA-Mail's 14px rounded container and 19px button shapes. Linux DBus StatusNotifier hosts receive a native menu; the desktop theme controls that fallback's colours. Closing asks before discarding edits or cancelling an export.

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

FFmpeg/FFprobe are bundled. Development overrides: `TMA_CUT_FFMPEG` and `TMA_CUT_FFPROBE`. Package on each target OS / architecture so media tools match it. Tests render actual video covering joins, audio/silence, captions, logos, backgrounds, 4K/144fps, HDR tone mapping, and cancellation, plus UI interaction tests.

## Releases and launcher

Pushes to [TMA-Cut](https://github.com/DaddyTylerXO/TMApps/tree/TMA-Cut) run `.github/workflows/release.yml`. All four native builds must pass before packages and SHA-256 files publish to the existing `tma-apps` release. The shared catalog is merged with existing apps and uploaded after all packages upload successfully. The launcher must include the Cut registration before reading the six-app catalog. Launcher changes live on [TMApps-Launcher](https://github.com/DaddyTylerXO/TMApps/tree/TMApps-Launcher).

See [third-party notices](THIRD_PARTY.md) for media-tool licenses and source links.


