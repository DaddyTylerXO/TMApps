# Finance-KB2: Connect and switch market providers

Applies to TMA-Finance 0.1.3. Provider plans checked 21 October 2026.

## Choose your connection

Open Settings & alerts > Your market connection. Alpha Vantage - shared is the default. It is labelled awaiting backend setup and cannot fetch until the secure service is deployed. For personal access choose Alpha Vantage, Finnhub, Twelve Data, Financial Modeling Prep or Marketstack with personal key in its label.

## Set up a personal key

Create your own account on the chosen provider website, review its plan and obtain its API key. Select the matching provider, paste the key into Personal API key and choose Connect provider. The app checks a quote for followed or held symbols, or AAPL if none exist. Account quotas apply. A configured key does not prove every dataset is permitted.

## Key privacy and switching

Keys stay in desktop-session memory and are excluded from backups, source and release packages. After quitting, enter them again. Within a session, select an earlier personal provider and choose Connect provider with the key field blank to reuse its connection. Disconnect disables the selected connection. Shared selection never uploads a personal key.

## Refresh and errors

Alpha Vantage quote checks are locked to 24 hours, including manual repeat requests to the same quote in the running session. Extra parameters and concurrent requests cannot bypass that cache. Personal local caches reset after quitting; future shared enforcement must survive server restarts. Search, news and company data have their own cache and also consume quota. Network, key, plan and quota failures show an error. Do not paste a webhook signing secret into the API key field.

## Feature coverage

Alpha Vantage and Finnhub support quote refresh, search, company data, price history and news where the account permits. The three additional personal adapters currently refresh quotes only. Add a USD ticker through a holding or stock widget to track it. Missing or unsupported datasets show an error rather than synthetic data.


[Back to KB index](KB-INDEX.md)
