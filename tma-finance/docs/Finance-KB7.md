# Finance-KB7: Financial Modeling Prep personal quote setup

Applies to TMA-Finance 0.1.3. Provider plans checked 21 October 2026.

## Set up

Create a Financial Modeling Prep account and obtain your API key. Select Financial Modeling Prep - personal key in Settings, paste the key and choose Connect provider. Refresh starts in manual mode.

## Data in this app

Quotes for supported US exchanges with price, daily percentage movement, previous close when supplied and timestamp. This adapter is quote-only. Statements, ratios, company search and news offered elsewhere by the provider are not connected through this adapter.

## Advantages

A personal alternative to Alpha Vantage. The Basic plan lists 250 calls per day and limited end-of-day, company and reference access.

## Limitations and costs

The quote endpoint, symbols and data freshness depend on account entitlement; free Basic does not guarantee real-time quotes or unrestricted symbols. The app uses a local 250-call UTC-day budget during the session and one-minute cache. Results outside supported US exchanges are rejected. Data display or redistribution requires the provider agreement. No FMP shared preset is enabled.

[FMP plans and account](https://site.financialmodelingprep.com/developer/docs/pricing)
[FMP quote documentation](https://site.financialmodelingprep.com/developer/docs/stable/quote)

[Back to KB index](KB-INDEX.md)
