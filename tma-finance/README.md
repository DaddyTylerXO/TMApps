# TMA-Finance desktop

An Electron application for Windows with a GBP finance workspace and USD equity portfolio. Core finance tools work offline. No website deployment or local web server is required for the desktop application.

## Run

Open `release/TMA-Finance-0.1.0-Windows.exe`. This is a portable, unsigned development build. It stores its application profile in Electron’s `userData` directory, normally `%APPDATA%/TMA-Finance`. It is portable in the sense of requiring no installer; its data is not stored beside the executable.

The app opens in an explicitly labelled sample workspace. Select **Start my workspace** to enter your own data. Personal and sample workspaces are stored separately. Neither sample prices nor invented news are presented as current financial data.

For development with Node.js and pnpm (or npm):

```powershell
pnpm install
pnpm start
pnpm test
pnpm run check
pnpm run dist:win
```

If a package manager blocks Electron’s installation script, allow the `electron` build or run `node node_modules/electron/install.js`. `pnpm-workspace.yaml` includes the relevant build policy for pnpm 11. The lockfile pins the installed dependencies.

`preview:web` is an optional development preview of the renderer, not the product entry point. The desktop app loads packaged assets through its own `tma://app` protocol. Native file access is limited to explicit import/export dialogs through a sandboxed preload bridge. Remote scripts, Node integration in the renderer, unsolicited permissions and remote navigation in the desktop window are disabled. Source articles open in the default browser.

## Available features

- Monthly income and spending budgets, dated expenses, categories, notes, edits and deletion.
- Subscription costs, monthly/quarterly/yearly cycles, contract dates, renewal dates, notes and paused status. Monthly equivalents feed the budget automatically; annual subscriptions are allocated across months rather than charged entirely on renewal day.
- Dashboard widgets for monthly cash flow, category spending, savings, subscriptions and transactions; add, remove, reorder and select chart periods.
- Savings pots with targets, deadlines, contribution recording, progress and daily saving estimates; expired deadlines are shown explicitly.
- CSV export, JSON backup and validated backup import using native Windows Save/Open dialogs. `Ctrl+E` exports finance data. JSON includes holdings and alert preferences; the finance CSV uses GBP records only.
- UK sole trader tax estimate for 2026/27, including Scotland, the Personal Allowance taper and Class 4 National Insurance. Scope exclusions and HMRC source links appear in the calculator.
- Currency conversion using Frankfurter’s latest working-day central bank reference rates, with publication dates. These are daily reference rates, not streaming foreign-exchange quotes.
- Manual USD holdings, portfolio cost/value/return, watchlist, configurable stock widgets, quote ranking/filtering and company pages with metric explanations.
- Finnhub connection for session quotes, ticker search, company profiles, available fundamentals, general/company news and five-year daily candles where the subscription allows them.
- In-app stock price thresholds, large daily falls in followed stocks, manual/interval quote checks while open, and monthly spending comparisons.

## Data and provider setup

Records persist in the desktop profile’s local storage and are not synchronised. Export JSON backups regularly; CSV is for analysis rather than lossless restoration. Local storage is not an encrypted financial database. Removing the app profile removes saved records. API keys are held in renderer memory for the session and excluded from exports.

In **Settings & alerts**, enter your own Finnhub key. It is sent directly to `https://finnhub.io` in the `X-Finnhub-Token` header. You can instead enter clearly labelled manual USD quotes. Provider permissions, CORS, exchange coverage and rate limits may prevent requests. Quote checks are capped at 25 unique symbols per refresh, request sequentially and stop on the first provider error. Timestamps identify cached quotes. Price history and fundamentals are never fabricated when the provider is unavailable.

Core finance functions do not send personal records to an external service. Optional data requests send the chosen currencies or stock tickers to their data provider. Remote Google Fonts are optional for appearance; system fonts provide an offline fallback.

## Remaining roadmap

The original plan is broader than this initial desktop build. These items are not complete:

- Bank linking (deferred as requested), cloud accounts, sync and encrypted database storage.
- Market-wide Top 100 feed, rankings by market capitalisation, full advanced fundamental screening and non-USD holdings.
- Historical annual revenue, balance sheets, PEG and median earnings; their profile fields show unavailable until connected to suitable financial-statement data.
- A 24-hour intraday graph widget; the current chart is five-year daily history, subject to provider entitlement.
- Background checks when the app is closed, specified clock-time schedules, system push/email delivery, market-wide crash detection and news/data-change sensitivity rules. Current alerts run inside open app sessions only.
- Streaming exchange rates; the current converter uses dated daily reference rates.
- Full tax-return preparation or filing, other income, pension relief, student loans, payments on account and other Self Assessment adjustments.
- Code signing, automatic app updates, installer distribution and macOS/Linux packaging.

## Validation

`node --test tests/core.test.mjs` checks UK/Scottish tax bands and tapering, Class 4 boundaries, subscription normalisation/date filtering, monthly expense totals, saving deadlines and CSV formula escaping. JavaScript syntax checks pass. The desktop window and dashboard/tax layouts were inspected in Windows; full UI automation was limited by the native helper losing its window binding. Finnhub integration cannot be end-to-end verified without a user provider key. Currency conversion has an explicit unavailable/error state; the live endpoint still needs verification in the delivered desktop environment.

Tax sources checked on 21 October 2026:

- [HMRC Income Tax rates and allowances](https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past)
- [HMRC self-employed National Insurance](https://www.gov.uk/self-employed-national-insurance-rates)
- [Frankfurter API documentation](https://frankfurter.dev/v1/)
- [Finnhub API documentation](https://finnhub.io/docs/api)
