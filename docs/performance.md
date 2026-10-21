# Launcher performance checks

Every code update running `test.ps1` now runs a separate native Windows startup and two-second idle sample. Source and packaged Electron smoke checks sample the desktop process family on all four macOS/Linux OS/architecture jobs. Reports are retained as CI artifacts.

| Check | Startup budget | Working set budget | Idle CPU budget |
|---|---:|---:|---:|
| Windows native launcher | 15 seconds | 350 MB | 15 percent normalized to CPU count |
| Electron launcher process family | 30 seconds | 800 MB | 30 percent summed process metric |

These are regression ceilings rather than target resource usage. Machine load affects samples, especially on shared CI hosts. Initial local measurements before release were about 0.5 seconds and 97 MB for native Windows and 0.4 seconds and 328 MB for the Electron preview, with low idle CPU. They do not predict every user's computer or app workload. Current release measurements are in the CI reports.

No polling loop was added for Help, galleries, sign-in, or settings search. Content is bundled; screenshots load only in Details and are decoded to bounded preview sizes in Windows. HTML images load lazily. Videos are never autoplayed and closing Details stops playback. Cached profiles, private sign-in data and crash drafts stay outside the app installation.

Use Quit instead of close-to-tray to release memory. Disable startup launch to reduce boot work and startup update checks to avoid their initial network work. Video playback uses CPU/GPU decoding, RAM and bandwidth. Settings explains these tradeoffs and links Launcher-KB6. Re-run functional tests and resource checks for each update; investigate new failures before publishing.
