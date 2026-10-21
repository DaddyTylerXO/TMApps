# Finance-KB8: Marketstack personal end of day setup

Applies to TMA-Finance 0.1.3. Provider plans checked 21 October 2026.

## Set up

Create a Marketstack account, review its plan and copy the access key. Select Marketstack - personal key in Settings, paste it and choose Connect provider. Refresh starts in manual mode.

## Data in this app

End-of-day closing prices for supported US exchange tickers. The adapter requests the latest two available daily records in one ticker request and calculates the change between closes. Both records are required so missing movement is not reported as zero. Search, news, fundamentals and historical chart loading are not connected through this adapter.

## Advantages

A simple personal source for daily portfolio values, suitable when streaming data is unnecessary. The free tier lists 100 requests per month and one year of historical end-of-day data.

## Limitations and costs

100 requests are a small monthly allowance shared by everything using that account. The app applies a local 100-request UTC-month budget during the session and a one-minute cache; repeat requests after cache expiry can consume more of the month. Free use is listed as non-commercial. Intraday features require a suitable paid plan. This adapter remains end-of-day even if the account has extra entitlements. No Marketstack shared preset is enabled.

[Marketstack plans and account](https://marketstack.com/pricing/)
[Marketstack provider documentation](https://www.postman.com/apilayer/apilayer/documentation/k0f6wqp/marketstack)

[Back to KB index](KB-INDEX.md)
