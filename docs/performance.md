# Performance and every-update checks

Code-list refreshes run once per second only when the renderer is visible, unlocked, outside Settings and not editing an authenticator. Hidden/minimized/locked windows stop requesting codes. TOTP results are cached in the main process until the time step changes; HOTP results remain cached until a counter or account mutation. Caches clear on lock. The renderer shows at most 100 search matches; the encrypted vault accepts up to 2,000 accounts and 8 MB. Custom images are normalized to 64-pixel PNGs and bounded before native decoding.

Appearance scheduling uses one timeout at the next minute and a CSS colour transition, rather than a JavaScript animation loop. Desktop notifications are opt-in and occur only after backup/import. No code-expiry notifications run in the background. Auto-lock uses one lightweight main-process timer. Closing the mini window removes its renderer and reduces memory use.

## Reproducible synthetic vault benchmark

Run `pnpm test:performance`. The script creates and removes a temporary encrypted vault and records `build/performance.json`. No real accounts are accessed. On the local Windows x64 check for 0.4.0, 2,000 synthetic accounts measured approximately:

| Measurement | Result |
| --- | ---: |
| Password derivation / initial vault creation | 144 ms |
| Encrypted save | 7 ms |
| Cold code-list generation | 21 ms |
| Cached list, 95th percentile of 20 iterations | 0.85 ms |
| Benchmark Node process RSS | 66 MB |

RSS above is for the benchmark process, **not total Electron application memory**. Password derivation intentionally allocates about 64 MB of working memory. Hardware, operating system, runtime and account count change results. Do not compare small differences between unlike machines.

The release gate allows derivation below 10 seconds, save below 5 seconds, cold listing below 3 seconds and cached listing below 500 ms. These deliberately generous cross-platform ceilings catch catastrophic regressions; inspect recorded artifacts for gradual regressions. Every native release job runs this benchmark and uploads the measurements alongside application smoke screenshots. The smoke test also covers the compact window and shared lock behavior. Settings explains how extra windows, uploaded icons, scheduled colours and notifications affect resources.

## Application smoke measurements

The source/packaged smoke artifacts also include `runtime-performance.json`, with per-process CPU and memory measurements. A local Windows source smoke run with main Settings, a mini list of three fictional accounts and a hidden tray popup recorded about 214 MB combined private process memory and roughly 0.06% aggregate CPU during a short sample. This is an illustrative smoke measurement with hardware acceleration disabled, not a long-duration idle/power benchmark. Shared working-set figures must not be summed as unique physical memory. CI records its own native measurements for each update.

The published 0.4.0 native jobs passed all performance gates on 24 October 2026. Treat negative initial Electron CPU deltas, observed in one short local packaged sample, as invalid samples rather than physical CPU measurements; use repeated stable measurements for comparisons. Native OS/build and lifecycle evidence is recorded in [verification-0.4.0.md](verification-0.4.0.md).
