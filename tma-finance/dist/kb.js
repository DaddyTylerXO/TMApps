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
        "Choose your connection",
        "Open Settings & alerts > Your market connection. Alpha Vantage - shared is the default. It is labelled awaiting backend setup and cannot fetch until the secure service is deployed. For personal access choose Alpha Vantage, Finnhub, Twelve Data, Financial Modeling Prep or Marketstack with personal key in its label.",
      ],
      [
        "Set up a personal key",
        "Create your own account on the chosen provider website, review its plan and obtain its API key. Select the matching provider, paste the key into Personal API key and choose Connect provider. The app checks a quote for followed or held symbols, or AAPL if none exist. Account quotas apply. A configured key does not prove every dataset is permitted.",
      ],
      [
        "Key privacy and switching",
        "Keys stay in desktop-session memory and are excluded from backups, source and release packages. After quitting, enter them again. Within a session, select an earlier personal provider and choose Connect provider with the key field blank to reuse its connection. Disconnect disables the selected connection. Shared selection never uploads a personal key.",
      ],
      [
        "Refresh and errors",
        "Alpha Vantage quote checks are locked to 24 hours, including manual repeat requests to the same quote in the running session. Extra parameters and concurrent requests cannot bypass that cache. Personal local caches reset after quitting; future shared enforcement must survive server restarts. Search, news and company data have their own cache and also consume quota. Network, key, plan and quota failures show an error. Do not paste a webhook signing secret into the API key field.",
      ],
      [
        "Feature coverage",
        "Alpha Vantage and Finnhub support quote refresh, search, company data, price history and news where the account permits. The three additional personal adapters currently refresh quotes only. Add a USD ticker through a holding or stock widget to track it. Missing or unsupported datasets show an error rather than synthetic data.",
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
];
