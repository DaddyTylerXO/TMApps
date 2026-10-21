# Shared market service: deployment preparation

This is a prepared adapter, **not a deployed or connected service**. The desktop defaults to **Alpha Vantage · shared (awaiting backend setup)** and also supports personal Finnhub and Alpha Vantage keys held in memory. Shared selection currently fails closed without making upstream calls. No credentials from user screenshots belong in this directory, environment examples, build outputs, logs or GitHub.

To give end users preset access without giving them the provider keys:

1. Obtain the providers’ written permission/licensing for the intended sharing and distribution. A personal free API key does not establish those rights. Finnhub expressly restricts redistribution; Alpha Vantage’s standard terms cover personal, non-commercial use.
2. Select an HTTPS backend host and store `FINNHUB_API_KEY` and/or `ALPHAVANTAGE_API_KEY` in its managed runtime secret store. Do not supply them as build variables to the desktop package. Hosting, data licences or larger quotas can cost money; no account or paid service has been created by this update.
3. Integrate `createMarketHandler` with verified TMApps app sessions. Supply an `authorize(request)` implementation that verifies the live session, Finance app access, expiry and revocation and returns `{userId}` only after success. Without that implementation, the handler fails closed with HTTP 503. The existing TMApps authentication service also needs actual deployment and app handoff integration.
4. Add durable per-user and global request budgets, shared caching with concurrent-request deduplication, a centrally enforced 24-hour per-symbol Alpha Vantage quote refresh lock, abuse limits, response-size limits and secret-redacted operational logging at the host. The in-memory adapter budgets alone are insufficient across server replicas or restarts. Reject over-budget requests rather than buying a larger plan.
5. Connect the desktop main process to the approved service URL using each user’s own protected app session. Ship only the public service URL in the app. Never ship a common access token or provider secret as a substitute for user authorization.
6. Verify user isolation, unauthenticated rejection, expiry/revocation, provider failures, quota exhaustion and downloaded desktop packages before enabling the preset service.

`market-handler.cjs` accepts fixed operations through the same allowlisted adapter as the desktop app. It does not offer arbitrary URL fetching. No endpoint, keys or sign-in credentials are preconfigured.

Official sources checked 21 October 2026:

- [Finnhub terms](https://finnhub.io/terms-of-service)
- [Alpha Vantage terms](https://www.alphavantage.co/terms_of_service/)
- [Alpha Vantage free service and limits](https://www.alphavantage.co/support/)

The screenshots show provider API keys and a Finnhub webhook signing secret, rather than an OAuth client ID/client secret pair. The webhook signing secret is not needed to request market quotes.

One shared Alpha Vantage free key has 25 upstream requests per day in total across all users and operations. Cached delivery can serve many users without another upstream call. Personal Alpha Vantage connections bypass the shared backend and use that user’s own provider account allowance. Keep shared and personal response caches isolated.
