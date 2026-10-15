# Agent Office

Agent Office is hosted in [TMApps](https://github.com/DaddyTylerXO/TMApps), the application-hosting repository. See [CHANGELOG.md](CHANGELOG.md) for release history and changes in development.

Version **0.1.0**. Run **Agent Office Setup 0.1.0.exe** from `dist/` to install the current app on Windows. The setup wizard lets you choose an installation folder and creates Desktop and Start menu shortcuts. It installs for your Windows user without administrator access, adds a normal uninstall entry, and keeps your workspace data when uninstalled. All features described below are included in this 0.1.0 release.

A desktop workspace for live Codex/ChatGPT and OpenAI specialist workflows, with a visual office floor, configurable agents, real file and ArtCraft tools, handoffs, and local persistence.

## Connect Codex with ChatGPT — no API key

1. Open **AI Connection** and select **Codex · ChatGPT account**. The installed Codex runtime is detected from PATH or the Codex desktop installation. Use **Choose codex.exe** if necessary, then **Save connection**. The installer uses your installed runtime; it does not bundle Codex.
2. Choose **Sign in with ChatGPT** and finish the official browser sign-in. Agent Office uses its own Codex profile, so sign in once even if another Codex app is already connected.
3. **Refresh account & models** shows your connected account, available model catalog and usage windows. Select a model and save. Catalog presence does not guarantee inference access; a successful job verifies it.
4. Choose a work folder and per-agent ArtCraft permissions in **Integrations**, then create a job. Overview and **The Office Live** reflect real specialist stages; job details show streamed output, deliverables, tool counts and reported tokens.

This uses the official [Codex App Server](https://learn.chatgpt.com/docs/app-server) with managed ChatGPT authentication. It consumes the account's Codex allowance and limits. Codex owns sign-in, credential persistence, and token renewal. Agent Office stores the separate profile under its Windows user-data directory in `codex-profile`; credentials never enter the renderer, workspace exports, or job journal. Sign out in **AI Connection** to remove the connection. Your existing Codex profile is not modified.

Each specialist gets an isolated ephemeral thread with its actual project folder as the working directory and a workspace-write permission description. Environment access remains disabled; file actions use Agent Office's confined workspace tools and assigned ArtCraft tools. Built-in shell/web tools remain disabled. The dynamic-tool protocol is experimental: use a compatible recent Codex runtime (verified with `0.162.0-alpha.17.2`). The default limit of 20 counts **specialist stages**, not internal Codex model requests. Codex manages response lengths; the API output-token setting applies only to the API provider. Both providers retain the team tool-call budget (40 per specialist, capped at 200) and 20-minute job limit. Pause takes effect at host-tool/stage boundaries; an active Codex turn may finish unless stopped.

Sign-in requires user interaction. `node scripts/verify-codex.cjs` repeats the isolated handshake without generating model output. With a signed-in app profile, `node scripts/verify-codex-output.cjs` performs real model-backed HTML creation/readback, and `node scripts/verify-codex-job.cjs` tests the full design/review pipeline creating five SVG logos and an HTML gallery in `.verification/`. These generation checks consume account allowance. Automated tests cover streaming, writable project configuration, tools, cancellation, failures and credential isolation.

AI jobs must create or change at least one non-empty project output before they can complete. The runner compares disk content before/after execution, excludes its own job journal, and reports a visible failure if only empty folders, unchanged files, or chat claims were produced. This verifies file delivery, not every semantic requirement or runtime behavior. Job details show the verified output list. Older jobs have no verification record; **Retry this job** creates a fresh attempt using the current connection while preserving the original history. No failed/old job is retried automatically.

Completed native Codex image-generation items are copied from returned image bytes or the runtime's generated-image cache into the project `generated/` folder. Other files outside the permitted project/cache roots cannot be imported. Generated PNG/JPEG/WebP files are included in the output audit and Projects browser.

## Optional OpenAI API connection

1. Open **AI Connection**, enter your own OpenAI API key, and choose a model. `gpt-4.1-mini` is the initial editable model ID. Choose **Save connection**, then **Verify key & model**. Verification checks the model-access endpoint without generating a response. OpenAI API usage is billed to your API account.
2. **Remember on this PC** stores the key encrypted with Electron's Windows `safeStorage` facility. Uncheck it for a session-only key, or supply `OPENAI_API_KEY` in the app process environment. Keys never enter workspace exports or the job journal. Saved settings are in `openai.json` under Electron's user-data directory.
3. In **Integrations**, choose the work folder. Agents can list, read, and write text files only inside this folder. Enable the ArtCraft apps each agent needs. Folder changes are blocked during an active job.
4. Choose **Create a job**, enter a name and a detailed task brief, and select a feature, research/writing, or design workflow. You can add a custom specialist to the team and optionally link a project.
5. Watch **The Office Live**, **Jobs**, and **Activity**. Each specialist receives the goal and prior deliverables, makes actual model/tool calls, and passes its result to the next specialist. Job details show the actual outputs, files written, model-call count, and reported token usage. Progress advances only when a specialist stage finishes.
6. If a job is waiting for an app action, open its details to review the exact app, tool, and arguments. Approve or decline that action. You can optionally enable automatic execution for apps whose native interfaces enforce folder limits. Other app actions always require review because their installed interfaces can access files beyond the chosen folder.

The initial call limit is 20 model requests per job, with up to 1,800 output tokens per request. Both are editable in **AI Connection**. A job has 40 tool calls per specialist (up to 200 total) and a 20-minute runtime limit. These are execution bounds, not a dollar spending cap. A model or tool failure is recorded; it is not replaced with a simulated success.

OpenAI calls use the [Responses API function-calling flow](https://developers.openai.com/api/docs/guides/function-calling) with `store: false`; normal provider data policies still apply. The task brief, prior deliverables, and relevant tool outputs are sent to OpenAI. The API key is sent only in the API authorization header. In API mode, cloud networking is confined to the main-process OpenAI adapter; the renderer has no direct network access.

Jobs execute one at a time, by priority then creation order, to share app sessions consistently. **Pause office** stops at model/tool boundaries; an action already in flight may finish. **Stop job** cancels the model request and prevents further actions, while an app tool already running may finish. Jobs, deliverables, and events are saved in `live-jobs.json`. On restart, interrupted work becomes a visible failure and is never retried automatically. Authorized queued jobs can continue when the app reopens if it is not paused and a key is configured.

New workspaces contain no fake projects or fake jobs. Existing demo results remain labeled as demo history; old queued or running demo jobs are archived and never submitted to OpenAI. The old demo engine is retained only for historical fixtures and development tests.

This version has no shell, browser, or web-search tool. Agents can create code and read files but cannot run builds/tests or browse current websites. ArtCraft documents are headless sessions; save/export outputs before closing the app or changing folders. Model output still needs normal review.

## Projects and completed jobs

**Projects** shows named projects and live jobs with their saved folders. Assign a job to a named project to share its workspace between specialists and future jobs. New named projects use their selected location and folder name; unlinked jobs get `projects/<job-id>` under the office work folder. Legacy linked jobs keep their original `projects/<project-id>` paths. Existing jobs retain their original folders and files. ArtCraft tools retain their configured app access; agents are instructed to save outputs into the job's project folder.

When creating a project, use **Choose location…** to select its parent folder and edit **Folder name**. A preview shows the full device path. Saving creates that new folder immediately; existing files/folders with the same name are never overwritten. Folder names are checked for Windows reserved names and invalid characters. The default parent is the office work folder's `projects` directory. Project folder settings persist in `project-folders.json`, and the Projects browser can show the folder before its first job. Linked AI jobs use the registered path, even if the office default changes. Folder location is fixed once created; editing a project's display name or status does not move existing work. Older projects/jobs retain their original locations.

ArtCraft automation sessions use each live job's project directory for their working folder and supported read/write roots, so projects outside the office default work folder work with assigned ArtCraft apps too. Sessions are closed when switching project roots; save/export app documents during the job. `node scripts/verify-project-location.cjs` verifies custom-folder creation, output routing and real VectorCraft export using a controlled model fixture without paid generation.

While Projects is open, the file browser checks disk every two seconds, including nested folders. Select folders to navigate, select text files for a safe read-only preview, and use **Open folder** to open the saved directory in Windows Explorer. The preview refreshes when a selected file changes. The recent changes list shows additions, modifications, and removals observed during this browsing session; it is not a version-control history. Initial entries show the latest disk modification times. Scans show up to 1,000 entries and nine folder levels; previews support text files up to 200 KB. Links are not traversed, and HTML/scripts are displayed as text. Files may be briefly unavailable while an application saves them; the next scan retries.

**Completed Jobs** lists all saved completed work, newest first. Select a job to reopen its original deliverables, usage, tool results, and work-folder location without rerunning it. **View project files** on an AI job opens its folder in Projects. Job history stays in the existing local job journal across restarts; previews show the current files on disk rather than a historical snapshot. Demo history remains labeled.

## Office live view

**The Office Live** sidebar tab opens a larger office floor with the job queue, team, and activity feed. The same office remains available in **Overview**, with an **Open live view** shortcut. Both views share the same agents, pause/resume control, selection, and job progress. Switching views never starts another worker or resets work; the selected tab is saved across restarts.

## Appearance and integrations

### Text size

Open **Appearance → Text size** to increase all reading text from 100% to 200%. The slider, A−/A+ buttons, and Reset control update immediately. The value is saved with your workspace; larger sizes switch dense layouts to fewer columns.

### ArtCraft integrations

Open **Integrations**, choose an agent, and enable the applications that agent can use. All 13 screenshot apps are supported: PhotoCraft, VectorCraft, FilmCraft, LightCraft, PdfCraft, EffectCraft, DesignCraft, WordCraft, DeckCraft, GridCraft, CADCraft, SoundCraft, and FigCraft. Windows installations are detected under Program Files; **Locate CLI** supports other locations. **Open app** launches the installed desktop application.

Choose an **ArtCraft work folder** for app files. The installed PhotoCraft, VectorCraft, EffectCraft, WordCraft, and SoundCraft versions support native read/write-root confinement. The other eight installed versions expose MCP without those flags, so running their tools requires the explicitly labeled **Allow full local file access** option. Their file access cannot be confined to the chosen folder by these versions.

Choose **App task** or **Run tool**, select an agent, application, and advertised tool, then supply its JSON arguments. The tool description and argument schema come from the installed application. These jobs execute real MCP tools; their results and failures appear in job details and the office activity. To try a read-only action, choose `command_list` or `list_commands` with `{}`. App documents live in persistent headless sessions until Agent Office closes or the work folder/CLI changes; use the app's save/export tools to retain document changes. Opening the desktop app opens a separate UI session.

Natural-language jobs now use live OpenAI calls, including discovery and use of assigned apps. You can also queue a specific **App task** without a model call or AI key. Both kinds of jobs use the same main-process queue. An interrupted or timed-out action is reported as failed and is never retried automatically; check output files before rerunning it.

The adapter uses [ArtCraft's stdio MCP protocol](https://github.com/storytold/vectorcraft/blob/main/docs/mcp.md), fixed known executables, and argument arrays without a shell. The sandboxed renderer gets only specific integration methods through an isolated Electron preload. No arbitrary process execution endpoint is exposed. Application permissions, CLI locations, and the work folder are stored locally in `integrations.json` under Electron's user-data directory.

### Spotify

The player stays at the top of the workspace and shows the current Spotify title and artist, with previous, play/pause, next, refresh, and Open Spotify controls. It uses [Windows media sessions](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession), not Spotify Web API credentials. Open the Spotify desktop app and play a track once so it exposes a media session. Only a Spotify session is selected; other media players are never controlled. Unsupported controls are disabled. Metadata refreshes every five seconds.

This controls Spotify on this Windows PC, rather than remote Spotify Connect devices. It requires Windows media-session support and an installed Spotify desktop app. It does not sign in for you, access playlists, request API keys, or stream audio itself. Login and playback availability remain managed by Spotify. No playback is started automatically.

### Verification

`npm test` checks the engine, MCP framing/timeouts, app assignment enforcement, real-action queue behavior, safe result rendering, and text-size persistence. `node scripts/verify-artcraft.cjs` additionally performs read-only live capability and command-list calls against all 13 locally installed apps. `powershell.exe -NoProfile -NonInteractive -File electron/spotify.ps1 -Action status` checks Spotify's Windows media-session status without changing playback.

## Office zones and agents

- Eight color-coded zones: FORGE (orange), CONTENT (blue), SNS (pink), PRODUCTS (yellow), INFRA (green), BUSINESS (purple), GAMES (teal), and ARCHIVE (gray).
- Open **Zones** to create projects, move them between zones, and change their status. Active icons use solid borders, prototypes use dashed borders, completed icons have a gold checkmark, and paused icons are muted. Projects untouched for 7+ days get a pulsing red badge. Saving a project or working on a linked live job refreshes its timestamp. Stale badges refresh every minute, even with the office paused.
- Open **Appearance** for light, dark, or system theme and reduced motion. Preferences persist locally. Reduced motion also honors the operating system setting.
- Choose **Add agent** to set a name, role, home zone, specialty instructions, and color. Added agents get a desk and appear throughout the team views. In **Create a job**, select an additional teammate to include the specialist in a live workflow.
- Existing saved projects, jobs, and activity are preserved. Fresh zones start empty.

## Run the desktop app

Install Node.js 22.22.2 or newer (or Node.js 24.15+), then run:

```sh
npm install
npm start
```

Create the Windows installer with `npm run package` (output: `dist/Agent Office Setup 0.1.0.exe`). Use `npm run package:portable` if you also want a portable executable.

For browser development, use `npm run dev` and open http://127.0.0.1:4173. The browser and desktop app use separate local storage.

## Use it

- Create a job with a feature, research, or design workflow.
- Watch the active agent work and hand its actual deliverable to the next specialist. Stage timing depends on real API and tool execution.
- Select a desk, agent card, or job to inspect its state and results.
- Pause and resume the office. Jobs and activity persist across restarts.
- Use the sidebar to inspect all agents, filter jobs, and view the activity history.
- Select your profile at the bottom left to export workspace JSON without credentials.

The app must be open, but may be minimized, for work to execute. The main-process runner is independent of the current tab. Only one new-version app instance can own the live queue.

## Verification

`npm test` checks live file creation and specialist handoffs using controlled model responses, permissions, app-action approval, cancellation, limits, restart recovery, encrypted credential handling, safe result rendering, and UI behavior. The tests do not consume paid OpenAI tokens. `scripts/verify-secure-storage.cjs`, run with Electron, verifies the real Windows encryption facility using a non-secret test value. A real OpenAI generation check requires your API key and a user-created live job.

The Electron renderer has no Node integration, runs sandboxed with context isolation, blocks navigation and new windows, and uses a content security policy that prevents remote connections. Local desktop integrations execute in the main process through a fixed preload API.
