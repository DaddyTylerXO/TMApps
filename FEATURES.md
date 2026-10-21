# TMA-Cut 0.2.0 feature coverage

This maps the requested additions to working controls and explicit implementation limits. Features requiring an account, key, executable or model cannot be used until the user configures that dependency.

| Requested area | Where to use it | Status and limits |
| --- | --- | --- |
| Platform-labelled aspect ratios and icons | Canvas; all tool panels | 9:16 TikTok/Reels, 1:1 Instagram, 16:9 and 4:3 YouTube, 4:5 Instagram. Tools and timeline asset types have icons. |
| Undo and redo | Header; keyboard | Transactional history; at most 100 states and approximately 32 MB of serialized snapshots. |
| Fullscreen, resizable project, separate monitor | Project header; dividers | Fullscreen, live pop-out monitor and draggable project/tools dividers. Pop-out follows timeline changes and playback. |
| Timeline zoom, timecode and keybinds | Timeline; Settings | Zoom slider, buttons, Alt-wheel and editable/custom shortcut mappings. HH:MM:SS or HH:MM:SS:FF. |
| Fully organised toolbar and UI profiles | Toolbar handle; Settings | Dock to four edges, reorder tool buttons, hide tools, import/export workspace preferences. Source paths, executable paths and connection keys are excluded from UI profiles. |
| Auto captions and caption customisation | Captions; Settings | Timed local whisper.cpp recognition with user-supplied executable/model; manual/SRT editing, font, colour, outline, alignment, fade/pop animation. |
| Microsoft text to speech | Captions; Settings | Local installed Windows voices or configured Azure Speech. Separate audio files and track items align to caption starts. Cloud speech needs a resource/key. |
| Thumbnail/keyframe | Canvas; Export | Set a cover time and export a JPEG, including a sidecar option. Does **not** embed MP4 cover art or force platform/media-player thumbnails. |
| Grading, correction, HSL, curves and wheel | Adjust | Sliders, targeted colour ranges, midpoint tone graph, tint hue/strength wheel, named reusable colour profiles. Fast preview is approximate; accurate render applies full filters. |
| Filters and blurs | Adjust | Monochrome, warm, cool, vintage, cinematic, vivid; Gaussian, box and pixelation blur. |
| Upscaling | Export | To 4K using Lanczos, bicubic or nearest neighbour. No AI enhancement. |
| Audio mixing, mixer visibility, fades and noise reduction | Audio mixer | Per-item/track gain, mute, hide-from-mixer, fades and spectral noise reduction. |
| Voice over and audio extraction | Voice over button; Audio mixer | Local microphone recording; extracted audio saved as a separate WAV and track item. |
| Audio ducking / reducing when speech or another file plays | Audio mixer | Select a priority reference track. Export uses amplitude-driven sidechain compression. **No automatic human-speech classifier**; place speech on its own reference track. |
| Copyright music checker | Audio mixer; Connections | Optional fpcalc + AcoustID recording identification. Copyright verdict remains **unknown**; matches are not rights clearance and missing matches do not mean safe to use. |
| Grouping, splitting, cutting, copy/paste and merging | Timeline; right-click menu | Grouped selection; split at playhead; cut/copy/paste; merge selected composition into a new MP4 compound source. |
| Auto saving and backups | Settings; recovery prompt | On by default; configurable interval and per-project retention; atomic snapshots and project saves. Source files are not embedded. |
| Red bubble-style export progress | Export | Rounded red progress with measured remaining time after rendering begins. |
| Chroma key / green screen | Adjust | Automatic border-colour sampling, manual colour selection, fast keying and detailed keying with despill. Not AI person segmentation. |
| Saved asset directories | Library; Settings | Multiple quick-access folders and local asset references. |
| Slow motion and speed sections | Media | 0.1x–100x and section splitting. No optical-flow interpolation; later items retain their positions. |
| Naming, size and time estimates | Export | Filename and native destination dialog. Bitrate-based size estimate and clearly labelled rough CPU time range; GIF size is unpredictable. |
| Masks, detailed crop and crop styles | Adjust | Percentage edge crops; rectangle, square, circle, rounded rectangle and triangle. No freehand/vector mask authoring. |
| Tracking and smooth movement | Adjust | Smooth position/zoom key markers and a local patch matcher at 4 samples/sec, up to 120 seconds per operation. Review drift; not an AI semantic tracker. |
| Unlimited stacked tracks | Timeline | No fixed project track-count cap. CPU, RAM, decoder and OS/FFmpeg input limits still apply. Projects are limited to a 24-hour timeline. |
| Encoding choices and file types | Export; Settings | H.264/HEVC, VP9 WebM, ProRes MOV and WAV/MP3 mixed audio; software encoders only. Each format has an explanation. |
| Timeline notes | Timeline; context menu | Editable notes at the playhead, distinct colour/type icon. |
| Templates and TikTok split layouts | Templates | Named project templates, 50/50 split, adjustable top share, webcam/gameplay, picture-in-picture and platform layouts. Templates retain source references. |
| Favourites | Favourites; star controls | Media, fonts, TTS voices, transitions, filters and templates in sections. Media favourites are stored with the asset library. |
| Reusable intro and ending | Settings | Save a selected source and enable it for new projects. Sources must remain accessible. |
| Drag/drop import | Studio window | Import local video, image, GIF and audio files by dropping them. |
| Timeline context menus | All timeline assets | Editing, grouping, extraction, audio/colour tools, movement markers and deletion. |
| GIF creation | Export | 240–640px width, 1–60 fps, accurate rendered preview, no sound. |
| Plugin manager | Settings | Import, enable, disable and remove declarative colour/template preset packs. **Executable code, VSTs and native effect plugins are not supported.** |
| Local asset library | Library | Persistent references to common photos, videos, GIFs and sounds. |
| Linked account export | Export; Connections | Authorised-token uploads: YouTube private uploads and TikTok inbox drafts. Requires user-owned approved application/scopes; tokens can expire. TikTok publishing is completed in TikTok. Browser uploaders remain available. |
| New-project suggestions and first-run tour | New; first launch; Help | Platform presets plus blank option; suggestions configurable; local demo tour returns to new-project creation. |
| Dark/grey/black and scheduled transitions | Settings | Day/night times, theme choice and gradual change duration. |
| Performance optimisation and verification | Settings; tests | Lower preview scale, bounded undo, paused-frame invalidation, optional analytics and target-only media binaries. Every release runs the render/UI/performance test suite. |
| Asset colours/icons and selection highlighting | Timeline; Settings | Type colours, configurable colours/icons, selected borders, Ctrl/Command selection, drag selection box and groups. |
| FPS and video analytics | Timer; Settings | Optional project FPS and RGB histogram. Project FPS is not a measured playback performance counter. |
| Computer analytics | Settings | Optional app/process CPU and RAM. **GPU utilisation is unavailable**; the UI says so rather than estimating it. |
| Searchable help and KB Library | Settings; Help | Cut-KB1–16, optional KB search, Word/Markdown library uploaded to GitHub. |
| Feature, bug, issue and help buttons | Help | Links to the repository's actual default-branch issue templates and KB guides. |
| Built-in crash report and GitHub upload | Help; Connections | Local latest renderer/JavaScript error, reviewed editable draft, browser submission or authenticated issue upload with explicit confirmation. No silent reports; native failures may prevent a report from being written. |

## External integrations tested here

Local Microsoft Windows speech synthesis was tested against installed voices. Linked upload request construction and destination restrictions are tested with mock services. Real Azure, YouTube, TikTok, AcoustID and local Whisper recognition require the user's accounts/models; they were not exercised against live private accounts during development.
