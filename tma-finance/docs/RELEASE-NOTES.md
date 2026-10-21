# TMA-Finance release notes

## 0.1.2 — 21 October 2026

- Move market requests to an allowlisted desktop connection, avoiding renderer cross-origin failures without weakening browser security.
- Default to shared Alpha Vantage (awaiting backend setup), with personal Alpha Vantage and Finnhub choices in the provider dropdown, provider-specific errors, cached requests and conservative local budgets. Alpha Vantage quote refresh is locked to 24 hours; standard quotes are daily and history uses monthly observations.
- Keep personal API keys in session memory in the main process; no real credentials are bundled, logged or exported.
- Make both profile icons open an editable, locally saved display name/email profile.
- Prepare a fail-closed shared backend adapter and operator guide for later hosting and licensing setup; no shared preset service is deployed.

Twelve automated test groups cover calculations, transport validation, response normalization, caching, quotas, error redaction and backend authorization defaults. The desktop profile dialog was observed opening; further native UI verification was limited after its test window became unavailable. No live provider request was made using the supplied credentials. The 24-hour quote cache and budget are session-local; central enforcement awaits backend deployment. See Finance-KB2 and Finance-KB3.

## 0.1.1 — 21 October 2026

- Open the personal workspace at startup, including upgrades that remembered demo mode.
- Keep demo mode as an explicit Settings preview for the current session; preserve both sets of records.
- Replace white app surfaces with the approved forest green palette, with readable light text, green controls and matching dialogs and desktop styling.
- Use a green empty-state chart ring and respect reduced-motion preferences.

Verified in the Windows desktop window: personal startup, green dashboard/budget surfaces and the green expense dialog. Existing calculation/export tests and syntax checks pass. The Finance-KB1 guide includes a sanitized real screenshot. Shared-launcher package and performance checks run in its release workflow; their result must be checked before claiming publication. This update adds no network polling or background task and retains the prior resource budgets.

The broader feature and suite acceptance gaps remain listed in [RELEASE-STATUS.md](../RELEASE-STATUS.md), including the still-missing Word KB library.
