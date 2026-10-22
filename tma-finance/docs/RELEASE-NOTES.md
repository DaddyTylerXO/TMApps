# TMA-Finance release notes

## 0.1.4 - 22 October 2026

- Add optional personal Yahoo Finance access through bundled yfinance 1.7.0, without an API key or external Python installation. Connect existing quote, search, profile, ratios, daily history and news pages. Add batch quotes, daily-history CSV download, market/sector/industry views, US equity screening, statements, actions and manually controlled sync/async streaming in Yahoo research.
- Keep multiple personal providers connected, with independent schedules and per-task assignments. Connecting or changing assignments triggers no data calls. A task uses its assigned provider without automatic fallback; provider quote caches stay separate. Alpha Vantage remains the only shared default, awaiting backend setup, with its 24-hour lock.
- Add the Settings API information sheet above job assignments and quote checks, with bold red IMPORTANT text, app-versus-provider coverage, source links and accessible explanations. Update the KB to ten articles.
- Pass 25 JavaScript test groups and seven Python worker test groups. Live Yahoo checks cover quotes, batch/history downloads, markets, sectors, industries, screening, statements, actions, search and news. Correct missing numeric values in sector/industry responses before JSON serialization. Streaming lifecycle is tested synthetically; continuous live-market delivery is not claimed verified.
- Bundle dependency licences and keep user/cache data out of packages. Existing missing Word render, native UI capture and cross-platform acceptance gaps remain open.


## 0.1.3 - 21 October 2026

- Add personal quote adapters for Twelve Data, Financial Modeling Prep and Marketstack, alongside personal Alpha Vantage and Finnhub. Alpha Vantage remains the only shared default. New personal adapters start in manual refresh mode and explicitly limit coverage to quotes.
- Add eight offline searchable in-app KB articles and matching Markdown provider guides, including setup, data coverage, default shared advantages and limitations. The Word library draft could not pass its required render review because LibreOffice is unavailable, so it is not distributed.

- Close quote-refresh bypasses through concurrent requests and irrelevant cache-busting parameters. Requests for the same key, provider and normalized quote share one in-flight fetch and then the 24-hour cache.
- Test repeated shared refreshes, personal-key injection, reconnects, precise cache expiry, response isolation and central-policy rejection. Twenty automated test groups pass.
- Fail closed in the prepared backend until both session authorization and a central policy handler are supplied. Production enforcement must use durable atomic quotas, shared caching and concurrent-request coordination across server instances and restarts. Shared service remains undeployed; no live multi-user enforcement is claimed.



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
