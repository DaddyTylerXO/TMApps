# Finance-KB2: Connect and switch market providers

Applies to TMA-Finance 0.1.4. Sources checked 22 October 2026.

## Connect providers independently

Open Settings & alerts > Your market connection. Each provider has its own card and Connect or Disconnect control. You can keep several connected at once. Keys stay in desktop-session memory and must be entered again after quitting. Connect does not fetch data or change any other connection. Yahoo personal access needs no key; choose Enable personal Yahoo. Shared Alpha Vantage is still awaiting backend deployment.

## Assign providers to jobs

Under Provider jobs choose a connection for market quotes, market and company news, search, company data and ratios, and price history. Save provider jobs. Only providers supporting each task appear. There is no automatic fallback: a disconnected or limited assigned provider shows an error. Changing assignments does not trigger requests. The three quote-only adapters remain quote-only.

## Set independent refresh timing

Under Quote checks & market alerts choose a refresh interval separately for each personal provider. Only its assigned quotes and news jobs run on that timer, while the app is open and visible. Search, company data and history load on demand. Alpha Vantage shared and personal quote refresh remain locked to 24 hours. A schedule of five checks per day means every 4 hours 48 minutes of open time; each check can make several API calls.

## Refresh one provider

Refresh quotes in Portfolio uses the quotes assignment. Refresh general news uses the news assignment. Each connection card also has Refresh this provider's quotes, which updates that provider's separate quote cache. It does not refresh another provider or replace displayed quotes unless assigned to the quotes job. Disconnect affects only the selected connection.

## Errors and quota limits

Check internet access, ticker coverage, key, permissions and quota. Alpha Vantage permits 25 standard free upstream requests per day per key across users and other apps. Daily quote cache entries and in-flight requests are reused in the running session, including manual repeats. The local cache resets on quitting; durable shared enforcement awaits deployment. No paid upgrade is purchased.


[Back to KB index](KB-INDEX.md)
