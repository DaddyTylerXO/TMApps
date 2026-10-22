# Finance-KB9: Yahoo Finance personal research with yfinance

Applies to TMA-Finance 0.1.4. Sources checked 22 October 2026.

## Setup and cost

Open Settings & alerts and select Enable personal Yahoo on its connection card. No provider key or subscription is purchased. The Windows package bundles its own helper and Python runtime, so users do not install Python. yfinance is an unofficial open-source client; Yahoo data is intended for personal research use. It is not a shared preset, has no guaranteed allowance or availability, and can be throttled or changed by Yahoo.

## Use existing investing pages

Assign Yahoo to quotes, search, company data, history or news in Provider jobs. Quotes and portfolio values require USD coverage. Company profiles map available ratios; price charts load up to five years of daily unadjusted closes. Historical chart returns can contain split effects because prices are not auto-adjusted. Missing data remains unavailable. News links open their original sources.

## Research components

Open Yahoo research. Quotes for up to five tickers uses Tickers. History download uses download to request one year of daily unadjusted prices and offers a CSV export. Market summary uses Market. Sector and Industry use their Yahoo keys, such as technology or software-infrastructure. The US screener uses EquityQuery and screen with your minimum market-cap and maximum P/E bounds, returning at most 25 results. Annual statements show up to four periods, and corporate actions show recent dividends and splits. Reported currency and units may differ between companies; values are not converted.

## Streaming

Choose Live stream or Live stream using async connection, enter up to five USD tickers and Load Yahoo data. The app uses WebSocket or AsyncWebSocket. Updates appear in the research screen; they do not refresh another provider, overwrite portfolio quotes or trigger trading. Stop Yahoo stream, Disconnect Yahoo, closing the app, or the one-hour limit ends the connection. Empty or delayed streams can occur outside exchange hours.

## Performance and request limits

Yahoo starts in manual mode. Each request may start a local helper process and briefly use additional CPU and RAM. Five-minute caches and a ten-operation-per-minute app guard reduce repeated reads; batch operations can still make multiple upstream requests. Streaming uses sustained network and CPU while enabled. There is no guaranteed Yahoo quota, exchange feed entitlement or paid-service fallback.

[yfinance project and personal-use notice](https://github.com/ranaroussi/yfinance)
[yfinance component reference](https://ranaroussi.github.io/yfinance/reference/index.html)

[Back to KB index](KB-INDEX.md)
