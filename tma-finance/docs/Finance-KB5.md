# Finance-KB5: Finnhub personal setup and coverage

Applies to TMA-Finance 0.1.4. Sources checked 22 October 2026.

## Set up

Create a Finnhub account, obtain its API key, select Finnhub - personal key in Settings, paste the key and choose Connect provider. The webhook signing secret is a separate credential and is not required for quotes. No Finnhub shared connection is enabled.

## Data in this app

Quotes, USD company search, company profiles and available basic metrics, daily price candles, and general or company news. Endpoint access and data delay depend on the account and subscription.

## Advantages and limitations

Broad integration in TMA-Finance and configurable personal polling. History or metrics may be restricted by the provider plan. A free account does not guarantee every dataset. The app caches requests for a minute, refreshes at most 25 symbols per action and caps local requests at 30 per minute; these are app safeguards, not a statement of your provider allowance.

## Cost and sharing

Review the account plan before use. The app does not buy or upgrade plans. Provider terms restrict redistribution; a personal key does not authorize a shared public feed. Keep the key private and disconnect when finished.

[Finnhub account](https://finnhub.io/)
[Finnhub API documentation](https://finnhub.io/docs/api)
[Finnhub terms](https://finnhub.io/terms-of-service)

[Back to KB index](KB-INDEX.md)
