# TMA-Finance initial development status

This is an initial desktop implementation, not a completed production release. Version `0.1.0` identifies the development build. Existing branch instructions and release history are preserved. The project uses the approved app name, green colour and bills icon.

## Verified

- Five automated calculation/export test groups pass: UK/Scottish 2026/27 tax, National Insurance thresholds, recurring costs, budget aggregation, goal deadlines and CSV formula escaping.
- Renderer/main/preload JavaScript passes syntax checks.
- The Windows Electron window opened and the dashboard and UK tax page rendered with synthetic sample data.
- A Windows portable development EXE was built. The final branded package is rebuilt from the uploaded source; SHA-256 sidecars identify its exact bytes.
- A constrained preload bridge implements native file export/import. Renderer Node integration is disabled and context isolation/sandboxing are enabled.

## Launcher distribution verification

Launcher 1.14.2 publishes the checked Windows development ZIP and its version/date/icon metadata. The real launcher engine installed it into an isolated custom folder, its packaged renderer loaded with Node integration disabled, its disposable window closed, and uninstall removed only the test copy. No personal profile was used. A local sample measured about 0.9 seconds to readiness, 353 MB for the process family and 0.04 percent normalized idle CPU. CI enforces startup under 30 seconds, working set under 800 MB and idle CPU under 30 percent. These are regression ceilings, not universal performance promises. The initial feature/KB/tray/native-platform gaps remain documented.


## 0.1.1 startup and appearance update

The Windows 0.1.1 package is published through the shared launcher catalog. Its live download was streamed and verified against the catalog SHA-256. The Finance syntax/build/test job passed, and the launcher workflow passed its Finance build, package verification and Windows package/catalog publication steps. The desktop personal-workspace startup, green budget surface and green expense dialog were inspected using an isolated empty profile. Existing personal and sample records are preserved. See [Finance-KB1](docs/Finance-KB1.md) and [release notes](docs/RELEASE-NOTES.md). These checks do not close the broader acceptance gaps below.

## Incomplete original feature scope

Bank import remains deferred. Market-wide Top 100 data, full fundamental screening, financial-statement history/PEG/median earnings, intraday widgets, background schedules and custom news-sensitivity notifications are not implemented. Finnhub requests need a user key and suitable plan; they have not been verified with a paid provider account. Currency conversion uses daily published rates and still needs live verification in the delivered app environment. The tax tool is a planning estimate rather than a tax-return filing service.

## TMApps acceptance gaps

The following compulsory standards remain acceptance work; they are not claimed complete:

- macOS and Linux native builds/tests, signing, a standalone installer, and verification of future version upgrades. The current Windows ZIP install/launch/uninstall path is verified through the launcher.
- Themed tray/close-to-tray menu and native notification lifecycle/preferences.
- Persisted Grey/Black dark palettes, settings/KB search and settings performance explanations.
- In-app Help/KB articles, verified feature/bug/general issue destinations, reviewed crash-report drafts.
- The maintained, rendered and visually checked `KB Library.docx` with sanitized real app screenshots and stable `Finance-KB` article links.
- Broader workload performance testing. The current packaged Windows startup/idle path is now measured and guarded in launcher release CI; this does not establish every workload or computer.
- The other suite acceptance gaps above remain open; Windows launcher publication is verified.

The native Windows helper lost its target-window binding during further UI checking, so full CRUD, export-dialog, persistence and responsive UI acceptance remain unverified. Do not treat a successful packaging command or a source upload as passing these checks.

Source publishing review excludes caches, local profiles, API keys, logs, generated dependency trees and build-tool credentials. The packaged app contains synthetic sample records only; session keys and user records are not baked into its source.
