# Finance-KB6: Twelve Data personal quote setup

Applies to TMA-Finance 0.1.4. Sources checked 22 October 2026.

## Set up

Create a Twelve Data account and obtain an API key. Select Twelve Data - personal key in Settings, paste it and choose Connect provider. The connection starts with manual refresh to reduce accidental usage.

## Data in this app

USD stock quotes with latest price, previous close, daily percentage movement and provider timestamp. This adapter is quote-only. The provider offers other datasets, but search, company ratios, news and history are not connected through this adapter.

## Advantages

An additional personal quote source and a free tier with 8 API credits per minute and 800 per day. Credits and permitted instruments depend on the endpoint and account plan.

## Limitations and costs

Free service is not unlimited and exchange/data entitlements vary. The app caps requests at 8 per minute in the running session and caches quotes for a minute. The provider daily allowance remains authoritative across devices. Non-USD results are rejected. Business free access lists internal non-display usage; external display or redistribution needs the appropriate rights. This is a personal-key option, not a shared preset.

[Twelve Data account and plans](https://twelvedata.com/pricing)
[Twelve Data documentation](https://twelvedata.com/docs)
[Twelve Data business rights](https://twelvedata.com/pricing-business)

[Back to KB index](KB-INDEX.md)
