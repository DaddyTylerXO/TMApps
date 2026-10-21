# Performance checks for each update

The release workflow runs `pnpm test` before packaging on Windows x64, macOS Intel, macOS Apple silicon and Linux x64. This includes real short-video rendering and a 2,000-item / 40-track model test with a five-second validation budget and a 32 MB serialized undo-history budget. Source desktop smoke checks render real demo footage, layered video and captions with renderer isolation enabled.

Local Windows development results for 0.2.0: 2,000 items validated in approximately 56 ms; undo history stayed around 30.5 MB under its limit. Short real-render tests covered grading, HSL, masks, speed, key markers, ducking, mixed audio, transparency, 4K/144fps and all export containers. These are regression fixtures, not a promise that every computer can preview 2,000 active 4K layers.

Paused preview redraws only when invalidated. Removed items release preview decoders. Preview scale can be reduced, recognition threads are configurable, analytics are opt-in, and folder scans are on demand. Only the target platform/architecture's FFprobe binary is retained in each package. Generated previews, speech and compound files use local profile storage and are retained because saved projects can reference them.

Before publishing a future update: run the entire suite, inspect the native smoke screenshot, review CPU/RAM with representative source files, and rerun relevant real-render cases for changed filters. Record new measurements and any limits here. Hardware GPU utilisation and hardware encoding remain unavailable rather than being represented by synthetic values.
