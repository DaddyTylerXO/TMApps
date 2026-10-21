# Finance-KB2: Market providers and connection errors

Applies to TMA-Finance 0.1.2 and later.

Open **Settings & alerts**, choose **Finnhub** or **Alpha Vantage** from **Market data provider**, enter that provider’s personal API key and choose **Connect provider**. Finnhub’s webhook signing secret is not a quote API key. You can switch back to a provider configured earlier in the same app session without entering that key again: select it and choose Connect provider with the key field empty.

The desktop process keeps keys in memory only. App data, JSON backups and CSV exports do not contain them. They must be entered again after quitting the app, unless an administrator has supplied a runtime environment preset. No provider keys are distributed with the app. Disconnect removes the selected session connection. A configured key is not proof that every endpoint is permitted by the account plan.

Requests run through a restricted desktop connection, rather than browser cross-origin fetch. A network/firewall error, rejected key, unavailable dataset or quota limit produces a specific message. Check internet access, the provider selected, the API-key field (rather than the webhook secret), and the account’s permissions. The app never disables TLS or browser security and never places API keys in renderer request URLs.

## Free tiers and quotas

Both providers have limited free personal offerings and paid features. The app does not buy subscriptions, enable paid plans or automatically upgrade accounts. Account subscriptions cannot be confirmed from an API-key screenshot.

Alpha Vantage’s standard free service permits 25 requests per day. Its standard quote endpoint provides daily quotes; real-time/15-minute-delayed US quotes are premium. This app locks automatic quote checks to 24 hours, caches each quote for 24 hours and other requests for 15 minutes, refreshes at most five symbols per click, and stops after a local session/day budget of 25 upstream calls. The provider’s actual account quota remains authoritative and includes other apps or devices. The cache and budget apply to the running desktop session and reset when the app quits. Reconnecting the same key in that session retains cached quotes and quota counts. The local budget is not a cross-device billing guarantee. With one shared key, all users share the same 25-request provider allowance; 25 users do not receive 25 requests each. The future server must enforce that budget and cache centrally, including across restarts. Separate personal accounts/keys use their own provider allowances. Its history view uses monthly observations rather than inventing a daily series.

Finnhub requests are cached for a minute and locally capped at 30 upstream requests per minute. This is the app’s conservative budget, not a claim about an account’s subscribed limit. Coverage and entitlement still depend on the provider plan.

## Shared preset access

The shared backend is prepared for later setup and is not deployed. Secure all-user access requires a hosted service holding provider keys, verified user sessions, quota controls and appropriate provider permission. A free personal key does not establish redistribution rights or free hosting. See [backend preparation](../backend/README.md).

Sources checked 21 October 2026: [Alpha Vantage free service](https://www.alphavantage.co/support/), [Finnhub terms](https://finnhub.io/terms-of-service), [Alpha Vantage terms](https://www.alphavantage.co/terms_of_service/).

[Back to app guide](../README.md)
