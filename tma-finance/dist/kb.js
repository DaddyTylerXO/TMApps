export const kbArticles = [
  {
    id: "Finance-KB1",
    title: "Your workspace and the green interface",
    sections: [
      [
        "Personal workspace",
        "TMA-Finance opens your saved personal workspace. New workspaces start empty. Sample data is separate: open Settings & alerts and choose View demo, then Use personal to return. Reopening the app always opens your personal records.",
      ],
      [
        "Appearance and storage",
        "Panels and dialogs use the approved forest green colour. Records are stored on this device. Export JSON backups regularly; CSV exports are intended for analysis. Removing the app profile removes local records.",
      ],
    ],
    links: [],
  },
  {
    id: "Finance-KB2",
    title: "Connect and switch market providers",
    sections: [
      [
        "Connect providers independently",
        "Open Settings & alerts > Your market connection. Each provider has its own card and Connect or Disconnect control. You can keep several connected at once. Keys stay in desktop-session memory and must be entered again after quitting. Connect does not fetch data or change any other connection. Yahoo personal access needs no key; choose Enable personal Yahoo. Shared Alpha Vantage is still awaiting backend deployment.",
      ],
      [
        "Assign providers to jobs",
        "Under Provider jobs choose a connection for market quotes, market and company news, search, company data and ratios, and price history. Save provider jobs. Only providers supporting each task appear. There is no automatic fallback: a disconnected or limited assigned provider shows an error. Changing assignments does not trigger requests. The three quote-only adapters remain quote-only.",
      ],
      [
        "Set independent refresh timing",
        "Under Quote checks & market alerts choose a refresh interval separately for each personal provider. Only its assigned quotes and news jobs run on that timer, while the app is open and visible. Search, company data and history load on demand. Alpha Vantage shared and personal quote refresh remain locked to 24 hours. A schedule of five checks per day means every 4 hours 48 minutes of open time; each check can make several API calls.",
      ],
      [
        "Refresh one provider",
        "Refresh quotes in Portfolio uses the quotes assignment. Refresh general news uses the news assignment. Each connection card also has Refresh this provider's quotes, which updates that provider's separate quote cache. It does not refresh another provider or replace displayed quotes unless assigned to the quotes job. Disconnect affects only the selected connection.",
      ],
      [
        "Errors and quota limits",
        "Check internet access, ticker coverage, key, permissions and quota. Alpha Vantage permits 25 standard free upstream requests per day per key across users and other apps. Daily quote cache entries and in-flight requests are reused in the running session, including manual repeats. The local cache resets on quitting; durable shared enforcement awaits deployment. No paid upgrade is purchased.",
      ],
    ],
    links: [],
  },
  {
    id: "Finance-KB3",
    title: "Your local profile",
    sections: [
      [
        "Edit your details",
        "Select the profile circle at the top right or in the sidebar. Enter a display name and optional email, then Save. Cancel leaves saved details unchanged. Your name and initial appear in the sidebar.",
      ],
      [
        "Local profile privacy",
        "Details are stored with the current workspace and included in its JSON backup. This does not create an online account, verify an email, connect a bank or sign into the future shared market service. Personal and demo workspaces remain separate.",
      ],
    ],
    links: [],
  },
  {
    id: "Finance-KB4",
    title: "Alpha Vantage shared and personal access",
    sections: [
      [
        "Data available in TMA Finance",
        "Daily stock quotes, USD ticker search, company overview and available ratios, five years of monthly price observations, and general or company news. Each endpoint depends on account entitlement. Monthly history is not a daily or intraday chart. Standard free quotes are updated at the end of the trading day.",
      ],
      [
        "Default shared connection",
        "The shared option is selected by default but is awaiting backend setup. When enabled, users will not enter a provider key. The hosted service must hold the key, verify each user and enforce a central quota, cache and atomic refresh lock. Only Alpha Vantage is planned for shared access; there is no automatic switch to another shared provider.",
      ],
      [
        "Advantages",
        "One setup for users, no provider key distributed in the desktop app, consistent daily refresh behaviour, and the potential to serve the same cached quote to many users with one upstream request. Personal finance records do not need to be sent to obtain stock quotes.",
      ],
      [
        "Limitations",
        "The standard free allowance is 25 upstream requests per day per key across all users and operations, not 25 per user. Different symbols and additional datasets consume requests. Shared quota exhaustion or service downtime can affect everyone. A 24-hour lock reduces requests but cannot create unlimited coverage. Real-time and 15-minute delayed US data are premium. Hosting and redistribution permission are separate from a free personal key.",
      ],
      [
        "Use your own allowance",
        "Create your Alpha Vantage account, copy the API key, select Alpha Vantage - personal key in Settings, paste it and Connect provider. This uses your own account allowance instead of the future shared service. The 24-hour quote lock still applies. The app refreshes at most five symbols per action and counts up to 25 local upstream calls per UTC day during the session.",
      ],
      [
        "Independent jobs",
        "Choose shared or personal Alpha Vantage separately for each job in Provider jobs. Other providers can remain connected. Alpha refresh stays locked to 24 hours; do not treat news and search calls as free because quote refresh is locked.",
      ],
    ],
    links: [
      [
        "Alpha Vantage account and limits",
        "https://www.alphavantage.co/support/",
      ],
      [
        "Alpha Vantage documentation",
        "https://www.alphavantage.co/documentation/",
      ],
      ["Alpha Vantage terms", "https://www.alphavantage.co/terms_of_service/"],
    ],
  },
  {
    id: "Finance-KB5",
    title: "Finnhub personal setup and coverage",
    sections: [
      [
        "Set up",
        "Create a Finnhub account, obtain its API key, select Finnhub - personal key in Settings, paste the key and choose Connect provider. The webhook signing secret is a separate credential and is not required for quotes. No Finnhub shared connection is enabled.",
      ],
      [
        "Data in this app",
        "Quotes, USD company search, company profiles and available basic metrics, daily price candles, and general or company news. Endpoint access and data delay depend on the account and subscription.",
      ],
      [
        "Advantages and limitations",
        "Broad integration in TMA-Finance and configurable personal polling. History or metrics may be restricted by the provider plan. A free account does not guarantee every dataset. The app caches requests for a minute, refreshes at most 25 symbols per action and caps local requests at 30 per minute; these are app safeguards, not a statement of your provider allowance.",
      ],
      [
        "Cost and sharing",
        "Review the account plan before use. The app does not buy or upgrade plans. Provider terms restrict redistribution; a personal key does not authorize a shared public feed. Keep the key private and disconnect when finished.",
      ],
    ],
    links: [
      ["Finnhub account", "https://finnhub.io/"],
      ["Finnhub API documentation", "https://finnhub.io/docs/api"],
      ["Finnhub terms", "https://finnhub.io/terms-of-service"],
    ],
  },
  {
    id: "Finance-KB6",
    title: "Twelve Data personal quote setup",
    sections: [
      [
        "Set up",
        "Create a Twelve Data account and obtain an API key. Select Twelve Data - personal key in Settings, paste it and choose Connect provider. The connection starts with manual refresh to reduce accidental usage.",
      ],
      [
        "Data in this app",
        "USD stock quotes with latest price, previous close, daily percentage movement and provider timestamp. This adapter is quote-only. The provider offers other datasets, but search, company ratios, news and history are not connected through this adapter.",
      ],
      [
        "Advantages",
        "An additional personal quote source and a free tier with 8 API credits per minute and 800 per day. Credits and permitted instruments depend on the endpoint and account plan.",
      ],
      [
        "Limitations and costs",
        "Free service is not unlimited and exchange/data entitlements vary. The app caps requests at 8 per minute in the running session and caches quotes for a minute. The provider daily allowance remains authoritative across devices. Non-USD results are rejected. Business free access lists internal non-display usage; external display or redistribution needs the appropriate rights. This is a personal-key option, not a shared preset.",
      ],
    ],
    links: [
      ["Twelve Data account and plans", "https://twelvedata.com/pricing"],
      ["Twelve Data documentation", "https://twelvedata.com/docs"],
      [
        "Twelve Data business rights",
        "https://twelvedata.com/pricing-business",
      ],
    ],
  },
  {
    id: "Finance-KB7",
    title: "Financial Modeling Prep personal quote setup",
    sections: [
      [
        "Set up",
        "Create a Financial Modeling Prep account and obtain your API key. Select Financial Modeling Prep - personal key in Settings, paste the key and choose Connect provider. Refresh starts in manual mode.",
      ],
      [
        "Data in this app",
        "Quotes for supported US exchanges with price, daily percentage movement, previous close when supplied and timestamp. This adapter is quote-only. Statements, ratios, company search and news offered elsewhere by the provider are not connected through this adapter.",
      ],
      [
        "Advantages",
        "A personal alternative to Alpha Vantage. The Basic plan lists 250 calls per day and limited end-of-day, company and reference access.",
      ],
      [
        "Limitations and costs",
        "The quote endpoint, symbols and data freshness depend on account entitlement; free Basic does not guarantee real-time quotes or unrestricted symbols. The app uses a local 250-call UTC-day budget during the session and one-minute cache. Results outside supported US exchanges are rejected. Data display or redistribution requires the provider agreement. No FMP shared preset is enabled.",
      ],
    ],
    links: [
      [
        "FMP plans and account",
        "https://site.financialmodelingprep.com/developer/docs/pricing",
      ],
      [
        "FMP quote documentation",
        "https://site.financialmodelingprep.com/developer/docs/stable/quote",
      ],
    ],
  },
  {
    id: "Finance-KB8",
    title: "Marketstack personal end of day setup",
    sections: [
      [
        "Set up",
        "Create a Marketstack account, review its plan and copy the access key. Select Marketstack - personal key in Settings, paste it and choose Connect provider. Refresh starts in manual mode.",
      ],
      [
        "Data in this app",
        "End-of-day closing prices for supported US exchange tickers. The adapter requests the latest two available daily records in one ticker request and calculates the change between closes. Both records are required so missing movement is not reported as zero. Search, news, fundamentals and historical chart loading are not connected through this adapter.",
      ],
      [
        "Advantages",
        "A simple personal source for daily portfolio values, suitable when streaming data is unnecessary. The free tier lists 100 requests per month and one year of historical end-of-day data.",
      ],
      [
        "Limitations and costs",
        "100 requests are a small monthly allowance shared by everything using that account. The app applies a local 100-request UTC-month budget during the session and a one-minute cache; repeat requests after cache expiry can consume more of the month. Free use is listed as non-commercial. Intraday features require a suitable paid plan. This adapter remains end-of-day even if the account has extra entitlements. No Marketstack shared preset is enabled.",
      ],
    ],
    links: [
      ["Marketstack plans and account", "https://marketstack.com/pricing/"],
      [
        "Marketstack provider documentation",
        "https://www.postman.com/apilayer/apilayer/documentation/k0f6wqp/marketstack",
      ],
    ],
  },
  {
    id: "Finance-KB9",
    title: "Yahoo Finance personal research with yfinance",
    sections: [
      [
        "Setup and cost",
        "Open Settings & alerts and select Enable personal Yahoo on its connection card. No provider key or subscription is purchased. The Windows package bundles its own helper and Python runtime, so users do not install Python. yfinance is an unofficial open-source client; Yahoo data is intended for personal research use. It is not a shared preset, has no guaranteed allowance or availability, and can be throttled or changed by Yahoo.",
      ],
      [
        "Use existing investing pages",
        "Assign Yahoo to quotes, search, company data, history or news in Provider jobs. Quotes and portfolio values require USD coverage. Company profiles map available ratios; price charts load up to five years of daily unadjusted closes. Historical chart returns can contain split effects because prices are not auto-adjusted. Missing data remains unavailable. News links open their original sources.",
      ],
      [
        "Research components",
        "Open Yahoo research. Quotes for up to five tickers uses Tickers. History download uses download to request one year of daily unadjusted prices and offers a CSV export. Market summary uses Market. Sector and Industry use their Yahoo keys, such as technology or software-infrastructure. The US screener uses EquityQuery and screen with your minimum market-cap and maximum P/E bounds, returning at most 25 results. Annual statements show up to four periods, and corporate actions show recent dividends and splits. Reported currency and units may differ between companies; values are not converted.",
      ],
      [
        "Streaming",
        "Choose Live stream or Live stream using async connection, enter up to five USD tickers and Load Yahoo data. The app uses WebSocket or AsyncWebSocket. Updates appear in the research screen; they do not refresh another provider, overwrite portfolio quotes or trigger trading. Stop Yahoo stream, Disconnect Yahoo, closing the app, or the one-hour limit ends the connection. Empty or delayed streams can occur outside exchange hours.",
      ],
      [
        "Performance and request limits",
        "Yahoo starts in manual mode. Each request may start a local helper process and briefly use additional CPU and RAM. Five-minute caches and a ten-operation-per-minute app guard reduce repeated reads; batch operations can still make multiple upstream requests. Streaming uses sustained network and CPU while enabled. There is no guaranteed Yahoo quota, exchange feed entitlement or paid-service fallback.",
      ],
    ],
    links: [
      [
        "yfinance project and personal-use notice",
        "https://github.com/ranaroussi/yfinance",
      ],
      [
        "yfinance component reference",
        "https://ranaroussi.github.io/yfinance/reference/index.html",
      ],
    ],
  },
  {
    id: "Finance-KB10",
    title: "Read the API information sheet",
    sections: [
      [
        "Find the comparison",
        "Settings & alerts places the API information sheet above Provider jobs and Quote checks & market alerts. IMPORTANT appears in bold red text. Scroll the table horizontally for each provider and vertically for its features. Column headings open official provider pages.",
      ],
      [
        "Understand the feature cells",
        "Each cell separates App integration from Provider catalogue. Offered or plan dependent does not mean a feature is free, enabled in this app or licensed for redistribution. Not documented means unverified. The table covers data freshness, history, request limits, reference data, corporate actions, indicators, aggregates, flat files, WebSockets, snapshots, trades, quotes, statements and ratios. Hover or focus a question-mark button for a description, or activate it to open an explanation dialog.",
      ],
      [
        "Costs and shared rights",
        "A free app does not make market-data licences or hosting free. The app does not purchase or upgrade API subscriptions. Shared Alpha Vantage is selected by default but remains unavailable until authenticated hosting, durable shared quotas, caches and provider permission are ready. All users of one key share its allowance. Yahoo and the other personal connections do not silently turn into shared services.",
      ],
    ],
    links: [
      ["Alpha Vantage free tier", "https://www.alphavantage.co/support/"],
      ["Twelve Data individual plans", "https://twelvedata.com/pricing"],
      [
        "FMP plans",
        "https://site.financialmodelingprep.com/developer/docs/pricing",
      ],
      ["Marketstack plans", "https://marketstack.com/pricing/"],
    ],
  },
];
