# Changelog

## 0.2.0

- Replace the sequential clip strip with independently timed video, image, audio, caption and note items on expandable tracks. Add selection boxes, grouped selection, split, cut, copy/paste, compound merging, speed sections and editable movement markers.
- Add platform-labelled aspect ratios, icon-labelled tools, editable keyboard shortcuts, timeline zoom, frame timecodes, docking/reordering, resize dividers and a live pop-out project monitor.
- Add colour correction, HSL, tone curve, tint wheel, named grading presets, filters, cropping, shape masks, chroma key, blur effects, transitions and local patch-based motion tracking.
- Add an audio mixer, fades, spectral noise reduction, sidechain ducking, extracted WAV files and microphone voice-over recording.
- Add manual/SRT/local whisper.cpp captions and caption styling, with Microsoft installed Windows voices or Azure Speech generating separate aligned audio files.
- Add local asset folders, persistent favourites, reusable project templates, split-screen layouts, intro/ending sources, declarative preset-pack plugins and searchable settings.
- Add default-on recovery snapshots, bounded backup retention, workspace profile import/export, theme scheduling, optional CPU/RAM and RGB histogram displays, first-run demo and reviewed GitHub report uploads.
- Add MP4/MOV/MKV/WebM/GIF/WAV/MP3 output, GIF preview, JPEG thumbnail sidecars, software encoding/upscaling settings, approximate size/time estimates, red rounded render progress, private YouTube uploads and TikTok inbox drafts with user-provided authorised tokens.
- Include the Word KB Library and in-app Cut-KB1 through Cut-KB16 guides. Add render, privacy, UI and performance regression tests; stop paused-preview repainting and prune other platforms' FFprobe binaries from installers.

Limitations and setup requirements are recorded in `FEATURES.md` and the KB Library. Recording identification does not establish copyright permission; GPU utilisation is not available; plugin support is for declarative packs; thumbnail files are sidecars; tracking is a basic local matcher. No cloud credentials or recognition model is bundled.
