# Finance-KB4: Alpha Vantage shared and personal access

Applies to TMA-Finance 0.1.4. Sources checked 22 October 2026.

## Data available in TMA Finance

Daily stock quotes, USD ticker search, company overview and available ratios, five years of monthly price observations, and general or company news. Each endpoint depends on account entitlement. Monthly history is not a daily or intraday chart. Standard free quotes are updated at the end of the trading day.

## Default shared connection

The shared option is selected by default but is awaiting backend setup. When enabled, users will not enter a provider key. The hosted service must hold the key, verify each user and enforce a central quota, cache and atomic refresh lock. Only Alpha Vantage is planned for shared access; there is no automatic switch to another shared provider.

## Advantages

One setup for users, no provider key distributed in the desktop app, consistent daily refresh behaviour, and the potential to serve the same cached quote to many users with one upstream request. Personal finance records do not need to be sent to obtain stock quotes.

## Limitations

The standard free allowance is 25 upstream requests per day per key across all users and operations, not 25 per user. Different symbols and additional datasets consume requests. Shared quota exhaustion or service downtime can affect everyone. A 24-hour lock reduces requests but cannot create unlimited coverage. Real-time and 15-minute delayed US data are premium. Hosting and redistribution permission are separate from a free personal key.

## Use your own allowance

Create your Alpha Vantage account, copy the API key, select Alpha Vantage - personal key in Settings, paste it and Connect provider. This uses your own account allowance instead of the future shared service. The 24-hour quote lock still applies. The app refreshes at most five symbols per action and counts up to 25 local upstream calls per UTC day during the session.

## Independent jobs

Choose shared or personal Alpha Vantage separately for each job in Provider jobs. Other providers can remain connected. Alpha refresh stays locked to 24 hours; do not treat news and search calls as free because quote refresh is locked.

[Alpha Vantage account and limits](https://www.alphavantage.co/support/)
[Alpha Vantage documentation](https://www.alphavantage.co/documentation/)
[Alpha Vantage terms](https://www.alphavantage.co/terms_of_service/)

[Back to KB index](KB-INDEX.md)
