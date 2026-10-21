# TMA-Finance initial development status

This is an initial desktop implementation, not a completed production release. Version `0.1.0` identifies the development build. Existing branch instructions and release history are preserved. The project uses the approved app name, green colour and bills icon.

## Verified

- Five automated calculation/export test groups pass: UK/Scottish 2026/27 tax, National Insurance thresholds, recurring costs, budget aggregation, goal deadlines and CSV formula escaping.
- Renderer/main/preload JavaScript passes syntax checks.
- The Windows Electron window opened and the dashboard and UK tax page rendered with synthetic sample data.
- A Windows portable development EXE was built. The final branded package is rebuilt from the uploaded source; SHA-256 sidecars identify its exact bytes.
- A constrained preload bridge implements native file export/import. Renderer Node integration is disabled and context isolation/sandboxing are enabled.

## Incomplete original feature scope

Bank import remains deferred. Market-wide Top 100 data, full fundamental screening, financial-statement history/PEG/median earnings, intraday widgets, background schedules and custom news-sensitivity notifications are not implemented. Finnhub requests need a user key and suitable plan; they have not been verified with a paid provider account. Currency conversion uses daily published rates and still needs live verification in the delivered app environment. The tax tool is a planning estimate rather than a tax-return filing service.

## TMApps acceptance gaps

The following compulsory standards remain acceptance work; they are not claimed complete:

- Packaged lifecycle/installation/update/uninstall checks, macOS and Linux native builds/tests, signing and installer distribution.
- Themed tray/close-to-tray menu and native notification lifecycle/preferences.
- Persisted Grey/Black dark palettes, settings/KB search and settings performance explanations.
- In-app Help/KB articles, verified feature/bug/general issue destinations, reviewed crash-report drafts.
- The maintained, rendered and visually checked `KB Library.docx` with sanitized real app screenshots and stable `Finance-KB` article links.
- Quantified startup/idle performance baseline and regression budgets. Startup/idle performance has **not** been measured; no performance pass is claimed.
- Published tested package URLs and verified launcher catalog integration.

The native Windows helper lost its target-window binding during further UI checking, so full CRUD, export-dialog, persistence and responsive UI acceptance remain unverified. Do not treat a successful packaging command or a source upload as passing these checks.

Source publishing review excludes caches, local profiles, API keys, logs, generated dependency trees and build-tool credentials. The packaged app contains synthetic sample records only; session keys and user records are not baked into its source.
