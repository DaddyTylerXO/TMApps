window.CUT_KB = [
  {
    "id": "Cut-KB1",
    "title": "Create a project and import media",
    "body": "Choose New and select Blank, TikTok or YouTube short, YouTube long form, YouTube classic, Instagram square, or Instagram portrait. The suggestion sets the aspect ratio and can be disabled in Settings. Import files or drop videos, audio, images and GIFs into Cut. MP4, MOV, MKV, WebM, AVI and common audio/image formats are supported when the bundled FFmpeg can decode them. Add a source more than once to create independent timeline items. Project files reference original sources; they do not contain the original media. Keep source files available when moving a project. The opening workflow offers recovery of the latest snapshot and a first-run demo tour.",
    "related": [
      "Cut-KB2",
      "Cut-KB9"
    ]
  },
  {
    "id": "Cut-KB2",
    "title": "Edit stacked timeline tracks",
    "body": "Add video, audio, or text tracks from the timeline toolbar. There is no fixed track-count limit, but practical capacity depends on CPU, RAM and source resolution. Select an item to highlight it. Ctrl or Command click selects multiple items; drag in empty track space to draw a selection box. Drag items to move them and drag their edges to trim. Source in/out and timeline start are also editable in Media. Split cuts at the playhead. Cut, copy and paste are available through shortcuts and the asset context menu. Group keeps related items selected together; ungroup separates them. Merge renders the selected items into a compound MP4 source and replaces the selection. Undo restores the prior edit; generated files remain in local storage.",
    "related": [
      "Cut-KB3",
      "Cut-KB10"
    ]
  },
  {
    "id": "Cut-KB3",
    "title": "Configure timecode zoom and shortcuts",
    "body": "Use the timeline zoom slider, plus/minus buttons, or Alt and the mouse wheel. Settings controls wheel zoom and editable keyboard bindings. Generic bindings include Mod Z undo, Mod Shift Z redo, Mod S save, Mod B split, Mod C copy, Mod X cut, Mod V paste, Mod G group, Delete remove, Space play, and arrow keys for frame stepping. Mod means Ctrl on Windows/Linux and Command on macOS. Custom bindings assign a named editor action to a key combination. Use browser key names such as Space, Equal, Minus, KeyB and F11. Shortcuts do not trigger while typing in text fields. Timecode can show HH:MM:SS or HH:MM:SS:FF. The FPS beside the timer is the project frame rate, not a measurement of decoder throughput.",
    "related": [
      "Cut-KB2",
      "Cut-KB4"
    ]
  },
  {
    "id": "Cut-KB4",
    "title": "Arrange the workspace and preview monitor",
    "body": "Drag the vertical divider to resize the tools and project display. Drag the horizontal divider to resize the project area and timeline. Settings provides numeric sizes, left/right/top/bottom toolbar docking and tool visibility. Drag toolbar buttons to reorder them. Fullscreen expands the project display; F11 can toggle the main application. Pop out opens a separate live monitor that can be moved to another screen. Edits and playback position are broadcast to that monitor. The canvas is a fast preview: colour processing, noise reduction and sidechain compression are approximated. Use Render accurate preview to inspect an FFmpeg render with final effects. Workspace profiles export/import toolbar, timeline and appearance preferences without stored connection keys.",
    "related": [
      "Cut-KB3",
      "Cut-KB13"
    ]
  },
  {
    "id": "Cut-KB5",
    "title": "Correct colour and save grading profiles",
    "body": "Select video or an image and open Adjust. Controls include brightness, contrast, saturation, sharpness, brilliance, clarity, highlights, shadows, whites, hue, red/green/blue balance, temperature and tint. HSL targets all colours or reds, greens, blues, yellows, cyans or magentas. The tone graph controls a midpoint between black and white, and the colour wheel controls a midtone tint hue and strength. Monochrome, warm, cool, vintage, cinematic and vivid filters are available. Save a named colour profile to reuse its adjustments; presets can be reapplied to future clips. These controls use FFmpeg colour filters and are not camera calibration or display management. Fast preview does not reproduce every grading operation; render an accurate preview before judging final colour.",
    "related": [
      "Cut-KB6",
      "Cut-KB13"
    ]
  },
  {
    "id": "Cut-KB6",
    "title": "Crop mask key and blur footage",
    "body": "Crop each edge by percentage in Adjust. Rectangle, square, circular, rounded rectangle and triangle masks are supported. Transform controls position, width, height, rotation and opacity. Chroma key can use a selected colour, automatic border-colour sampling, fast basic processing or detailed processing with green despill. Similarity and edge blend tune removal. Auto keying is a simple background-colour estimate and is not AI person segmentation. Gaussian, box and pixelation blur effects are available. Canvas background blur fills unused space with a blurred copy of base-track footage. Detailed keying, transparency and blur increase processing cost. Keying in fast preview is approximate; use an accurate render to assess edges.",
    "related": [
      "Cut-KB5",
      "Cut-KB7",
      "Cut-KB13"
    ]
  },
  {
    "id": "Cut-KB7",
    "title": "Animate movement track subjects and adjust speed",
    "body": "Set the playhead inside a clip and add a movement key marker. Each marker stores time, horizontal/vertical position and zoom. Smooth interpolation animates between markers. Local motion tracking samples a small image patch four times per second for up to two minutes and produces editable position markers. It works best with distinctive subjects and small movement. Cuts, occlusion or similar backgrounds can cause drift; inspect and correct the markers. It is not a semantic AI tracker. Speed supports 0.1x to 100x. The section speed tool splits at chosen timeline boundaries and applies the new speed only to that section. Frame conversion duplicates or drops frames; no AI interpolation is applied. Later items keep their existing timeline positions, so close gaps or overlaps as needed.",
    "related": [
      "Cut-KB2",
      "Cut-KB6"
    ]
  },
  {
    "id": "Cut-KB8",
    "title": "Mix audio record voice and reduce noise",
    "body": "The audio mixer shows track gain plus selectable clip controls. Set clip volume, fade-in/out duration, noise reduction, mute and mixer visibility. Hidden mixer entries can be shown again. Ducking uses a reference track: put speech or a priority sound on its own track and select that track as the sidechain for the background audio. Export applies a compressor that reacts to the reference signal; it does not classify whether the signal is a human voice. Extract audio creates a separate WAV source and audio item. Voice over records the selected microphone input through the operating system; press the button again to stop. Default audio settings apply to new media items. Noise reduction uses spectral filtering and may affect wanted sound when set too high.",
    "related": [
      "Cut-KB10",
      "Cut-KB14"
    ]
  },
  {
    "id": "Cut-KB9",
    "title": "Save projects recover edits and keep backups",
    "body": "Autosaving is on by default. Settings controls the snapshot interval and number of retained backups per project. Snapshots live under the app profile in autosaves and reference your original media paths. The next launch offers the latest recovery snapshot. Save creates or updates your chosen tmacut project file; it also creates a recovery snapshot when autosave is enabled. Original media is never embedded or deleted by backup rotation. Project identity separates backups from different projects. To move an edit, copy the project and source files together; opening offers to locate missing sources. Closing an unsaved edit asks before discarding it. Generated voice, extraction, preview and merge files use local profile storage and can grow over time.",
    "related": [
      "Cut-KB1",
      "Cut-KB15"
    ]
  },
  {
    "id": "Cut-KB10",
    "title": "Generate edit and style captions",
    "body": "Captions and text are timeline items whose text, start and duration can be edited. Import SRT subtitles or create captions manually. Choose fonts, text colour, outline colour/size, alignment, fade or pop animation. Automatic captions require a trusted local whisper.cpp CLI and a compatible ggml model selected in Settings. They are not bundled or downloaded automatically. Recognition extracts mono 16 kHz audio and returns timed captions aligned to the selected clip, including its speed. Review recognition mistakes before publishing. Microsoft text to speech can speak selected captions: Windows installed voices run locally, while Azure Speech requires a region/key and transfers text to Microsoft. Each speech result is a separate audio file on a dedicated track at the caption start. Speech duration is natural and may exceed the caption; trim or retime as needed.",
    "related": [
      "Cut-KB8",
      "Cut-KB14"
    ]
  },
  {
    "id": "Cut-KB11",
    "title": "Build templates intros and asset collections",
    "body": "Template layouts include TikTok 50/50, webcam above gameplay, TikTok picture-in-picture, YouTube facecam, and Instagram square. Select sources before applying a layout. A split-share slider changes the top source allocation. Named project templates retain track arrangement, source references and effects, so those sources must remain accessible. Save a selected source as an intro or ending in Settings and enable it for future projects. The local asset library stores references to commonly used videos, GIFs, photos and audio. Quick access folders can be added and removed. Favourites collect assets, fonts, Microsoft voices, filters, transitions and templates into sections. Preset-pack plugins may supply declarative colour profiles or templates; executable third-party code is not loaded.",
    "related": [
      "Cut-KB1",
      "Cut-KB4"
    ]
  },
  {
    "id": "Cut-KB12",
    "title": "Export video audio GIFs and thumbnails",
    "body": "Export supports MP4, MOV, MKV, WebM, GIF, WAV and MP3. The menu explains container differences. Choose an output filename and folder, resolution up to 4K, frame rate 24 to 144 fps, bitrate 5 to 100 Mbps, and software encoding options. Upscaling uses Lanczos, bicubic or nearest-neighbour sampling; it does not invent AI detail. GIF width is 240 to 640 pixels with 1 to 60 fps and no sound. Preview before confirming renders the chosen format. Estimates before export are approximate: video bitrate predicts size, while GIF size and CPU rendering time vary greatly. Progress shows measured remaining time after rendering begins. Set a thumbnail/keyframe in Canvas and export a JPEG separately or beside video. Embedded MP4 cover art is not written; media players and social platforms may choose their own preview until you upload a thumbnail.",
    "related": [
      "Cut-KB13",
      "Cut-KB14"
    ]
  },
  {
    "id": "Cut-KB13",
    "title": "Understand quality HDR and performance",
    "body": "Smart HDR detects PQ or HLG footage and tone maps it into BT.709 SDR. It does not generate native HDR output. 4K, 144 fps, slow encoding, multiple high-resolution layers, detailed masks, blur and recognition use more CPU and RAM. Choose half-scale fast preview, fewer active tracks, lower recognition threads or faster encoding to reduce load. Export currently uses software H.264/HEVC/VP9 or ProRes rather than hardware acceleration. Process CPU and RAM and an RGB histogram are optional. GPU utilisation is explicitly unavailable because the app cannot measure it consistently across operating systems. Frame stepping and timecode use project FPS. Source codecs that the browser cannot preview may still export through FFmpeg; render a compatible MP4 preview when needed.",
    "related": [
      "Cut-KB4",
      "Cut-KB5",
      "Cut-KB12"
    ]
  },
  {
    "id": "Cut-KB14",
    "title": "Connect services and check recording matches",
    "body": "Microsoft Azure Speech needs a Speech region and key. Windows installed Microsoft voices need no cloud key. YouTube and TikTok connections accept authorised access tokens from your developer application; scopes and platform approval remain your responsibility and tokens can expire. GitHub report uploads need an issue-write token. Stored keys use Electron safeStorage and are refused when a secure OS keychain is unavailable. Linked YouTube export uploads privately. TikTok sends a draft to your inbox for final review and publishing in TikTok. Browser upload pages remain available. No live account upload is performed until you confirm it. Recording identification can use fpcalc plus an AcoustID client key. It reports possible recording matches only: a match, missing match, or similarity score never determines copyright ownership, licence, fair use or platform clearance. Verify rights separately.",
    "related": [
      "Cut-KB8",
      "Cut-KB10",
      "Cut-KB12"
    ]
  },
  {
    "id": "Cut-KB15",
    "title": "Manage storage appearance and workspace profiles",
    "body": "Settings offers dark, toned grey and black themes, with optional day/night schedules and configurable gradual transitions. Timeline colours and icons can be adjusted or disabled. The workspace profile contains UI, toolbar and timeline preferences and excludes connection secrets and local source/executable paths. Default audio/video settings affect new items and projects. Storage scans calculate selected export and quick-access folders plus the app profile. Scans are on demand, skip symbolic links, and stop after 100,000 files or 20 directory levels. Changing a quick-access folder does not move or delete its files. Generated previews, speech, extracted WAVs and merged clips remain local assets; delete only files no longer referenced by saved projects. Desktop export notifications contain a generic completion message and the app icon; click to return to Cut and reveal the export, or dismiss using your operating system. Disable them in Appearance. Native notification styling and permission controls depend on the OS. Close window to tray keeps editing and processing available; use Quit TMA-Cut in the tray to exit. Disable close-to-tray in Appearance to quit with the window.",
    "related": [
      "Cut-KB4",
      "Cut-KB9"
    ]
  },
  {
    "id": "Cut-KB16",
    "title": "Find help report issues and review crashes",
    "body": "Settings search finds keywords and Cut-KB article numbers; KB search can be disabled. Help links to the KB Library, GitHub feature-request form, bug form, and general issue page. Captured renderer errors record the app version, OS and latest error details locally. Prepare crash report shows the latest details for review. Open a prefilled browser draft, or use Upload to GitHub Issues after connecting a token with issue-write permission. Confirm the upload after removing any private paths. The app never silently submits a report. Native operating-system failures may stop the app before a JavaScript report can be written. Reopen the last recovery snapshot if a crash interrupted editing. Include steps to reproduce, source codec, approximate project length, effect settings and whether the problem also occurs in an accurate rendered preview.",
    "related": [
      "Cut-KB9",
      "Cut-KB13"
    ]
  }
];
