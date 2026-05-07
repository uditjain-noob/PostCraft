# NSE Swing Trader — MCP App Project Plan

> **Status:** Planning  
> **Universe:** F&O stocks (NSE)  
> **Interface:** FastMCP + Prefab UI (renders inside Claude)  
> **Primary user:** Personal → scalable to multi-user product

---

## 1. Vision

A conversational stock research tool for Indian F&O swing trading, built as an MCP App that renders a dynamic Prefab UI inside Claude. The user types a natural language query — or selects options from the UI — and gets back a context-aware view: a screened list of stocks, a single stock deep-dive, a sector-level news-to-impact map, or a combination. The UI adapts to what the query is asking for, rather than showing a fixed dashboard.

The core insight is that F&O stocks are the right universe for swing trading: they are the most liquid, beta-heavy, and technically cleaner names on NSE. The app leans into this by computing beta, momentum, and technical signals specifically against Nifty 50 as the benchmark — not generic global indices.

---

## 2. Goals & Non-Goals

### Goals (v1 — personal tool)

- Screen F&O stocks by beta, momentum, RSI, volume surge, and basic fundamentals
- Return a ranked, interactive stock list with key metrics per stock
- Deep-dive view per stock: price chart sparkline, technicals, signal breakdown
- News-to-sector mapper: given a macro/sector event, show which F&O stocks are likely impacted and in which direction
- All rendered as a Prefab UI inside Claude — not a separate web app
- Query-driven: the UI changes based on what the user asks

### Non-Goals (v1)

- Real-time tick data or intraday screener (daily EOD is sufficient for swing)
- Automated trade execution or broker integration
- Portfolio tracking or P&L accounting
- Options chain analysis (out of scope for now)
- Mobile-native app

### Later (v2+)

- Persistent watchlist dashboard with on-demand refresh
- Multi-user access with saved screens
- Broker API integration (Zerodha / Dhan) for one-click order placement
- Backtesting a signal combination against historical F&O data

---

## 3. User Interaction Model

The entry point is a natural language query inside Claude. The MCP server interprets the intent and calls the right tool, which returns a Prefab UI rendered inline.

### Example queries and what they return

| User query | UI rendered |
|---|---|
| "Show me high beta breakout setups today" | Stock list: beta-ranked F&O names with RSI, volume surge, EMA alignment |
| "Deep dive on TATAMOTORS" | Single stock view: sparkline, beta, RSI, support/resistance, signals |
| "IT sector is facing headwinds from US budget cuts — what does that mean for F&O stocks?" | Sector impact map: affected tickers, direction (positive/negative), beta-adjusted impact score |
| "Show me oversold high-beta names with strong fundamentals" | Filtered stock list: RSI < 35, beta > 1.2, ROE > 15%, volume above average |
| "What's setting up well for a 2-week swing?" | Top 10 ranked by composite swing score |

### UI modes (Prefab views)

**Mode 1 — Stock list view**
The default output for screener queries. A `DataTable` with columns for ticker, sector, beta, current price, RSI, volume ratio (vs 20-day avg), % from 52w high, EMA alignment signal, and composite swing score. Clicking a row calls the deep-dive tool.

**Mode 2 — Single stock deep-dive**
Triggered by clicking a row or naming a ticker. Shows: price sparkline (3 months), key metrics as `Metric` cards (beta, RSI, ATR, volume ratio), signal breakdown as `Badge` components (bullish/bearish/neutral per signal), and a plain-language summary of the setup.

**Mode 3 — Sector / news impact view**
Triggered when a macro event or sector theme is mentioned. Shows: affected sectors as a `RadarChart` or `BarChart`, a list of F&O tickers per sector ranked by beta-adjusted sensitivity, and a short AI-generated rationale for each direction call.

**Mode 4 — Composite swing scan (default daily view)**
Top 10–15 names ranked by a composite score combining beta, momentum, RSI recovery, and volume. This becomes the persistent daily dashboard in v2.

---

## 4. Signal Definition

All signals are computed on daily EOD data. The benchmark for beta is **Nifty 50** (`^NSEI`).

### 4.1 Beta
- Computed over a rolling 1-year window of daily returns
- Stock return vs Nifty 50 return, regression slope = beta
- High-beta threshold: β > 1.3
- Used to rank names by market sensitivity and filter the universe

### 4.2 Momentum
- 20-day and 60-day price return
- EMA alignment: price > EMA20 > EMA50 > EMA200 = bullish stack
- Distance from 52-week high (closer = stronger momentum)

### 4.3 RSI
- 14-day RSI
- Sweet spot for swing entries: RSI between 40–60 recovering from oversold, or RSI > 60 in a strong trend
- RSI < 30 flags oversold (potential reversal setup)
- RSI > 75 flags overbought (caution)

### 4.4 Volume surge
- Volume ratio = today's volume / 20-day average volume
- Ratio > 1.5 = notable, > 2.0 = strong surge
- Surge in direction of trend is bullish confirmation
- Surge against trend is a warning sign

### 4.5 Fundamental filters (secondary)
- P/E ratio (TTM): screen out names with extreme valuations
- ROE (5yr average): preference for businesses with ROE > 15%
- Debt-to-equity: flag highly leveraged names
- These are filters, not ranking signals — they reduce the universe, not score it

### 4.6 News / macro impact (sector-level)
- When a macro event or news item is provided, map it to affected NSE sectors
- Use a predefined sector sensitivity model (which sectors benefit / suffer from: rate changes, commodity prices, INR moves, US demand, monsoon, govt spending, etc.)
- Within the affected sector, rank F&O stocks by beta (higher beta = more impact)
- Sentiment direction (positive/negative) is determined by the event type + sector relationship
- AI (Claude itself via the MCP tool) generates the rationale

### 4.7 Composite swing score
A weighted score combining the above for ranking:

| Signal | Weight |
|---|---|
| Beta (vs Nifty) | 20% |
| Momentum (EMA alignment + distance from 52w high) | 25% |
| RSI position (recovery zone bonus) | 20% |
| Volume surge | 20% |
| Fundamental quality (ROE, D/E) | 15% |

Score is normalized 0–100. Names below 40 are filtered out before display.

---

## 5. Data Sources

### Primary: yfinance

- **Cost:** Free
- **What it gives:** Daily OHLCV for NSE stocks via `.NS` suffix (e.g. `RELIANCE.NS`), Nifty 50 via `^NSEI`, fundamentals (P/E, ROE, market cap) via `yf.Ticker().info`
- **Limitations:** No live tick data, slight delay on fundamentals, occasional gaps on smaller names
- **Why it's enough:** All signals are EOD-based. yfinance covers the entire F&O universe reliably.

### Secondary: NSEPython / NSE direct

- **Cost:** Free
- **What it gives:** Live NSE data, F&O stock list, sector classification
- **Use case:** Fetching the canonical list of F&O stocks, and live price for the session close
- **Note:** NSE blocks automated scraping intermittently — use as fallback, not primary

### News / macro context: Claude (built-in)

- For the news-to-sector impact tool, Claude's own knowledge handles the sector sensitivity mapping
- No external news API needed in v1 — the user provides the news/event as part of their query
- In v2, could integrate a financial news API (e.g. Benzinga, Finshots RSS) for automated event detection

### Paid APIs — evaluation

| API | Cost | Benefit over free | Verdict |
|---|---|---|---|
| Dhan API | Free for own account | Live data, order placement | Useful in v2 for execution |
| Zerodha Kite | Free for own account | High-quality OHLCV, live | Useful in v2 |
| Alpha Vantage | Freemium (25 req/day free) | Nothing yfinance doesn't cover for NSE | Not worth it |
| Polygon.io | Paid | US focus, poor NSE coverage | Skip |

**Decision for v1:** yfinance + NSEPython. No paid API needed. Revisit when adding live data or execution in v2.

---

## 6. Technical Architecture

```
User query (Claude chat)
        │
        ▼
 FastMCP Server (Python)
        │
   interprets intent
        │
   ┌────┴─────────────────────────┐
   │                              │
screen_stocks()           sector_impact()
deep_dive(ticker)         composite_scan()
        │
        ▼
  Data layer (Python)
  ┌─────────────────────┐
  │ yfinance            │  ← OHLCV, fundamentals
  │ NSEPython           │  ← F&O stock list, live price
  │ pandas / numpy      │  ← signal computation
  │ SQLite cache        │  ← avoid re-fetching same day's data
  └─────────────────────┘
        │
        ▼
  Prefab UI (PrefabApp)
  ┌─────────────────────────────────┐
  │ DataTable   (stock list)        │
  │ Metric      (key stats)         │
  │ Sparkline   (price trend)       │
  │ Badge       (signal status)     │
  │ BarChart    (sector impact)     │
  │ Slot        (dynamic swap)      │
  │ CallTool    (drill-down)        │
  └─────────────────────────────────┘
        │
        ▼
  Rendered inside Claude (MCP App)
```

### Key architectural decisions

**Caching:** All OHLCV data is cached in SQLite keyed by ticker + date. On any given day, a stock is only fetched once regardless of how many tool calls reference it. This keeps yfinance usage efficient and responses fast.

**Tool structure:** Each Prefab view maps to one primary MCP tool (`app=True`) and one or more helper tools called via `CallTool` from the UI. The entry tool sets up the shell; the helpers populate `Slot` components on interaction.

**Stateless server, stateful UI:** The server does not maintain session state. All UI state (selected stock, active filters, sort order) lives in Prefab's client-side state via `Rx` and `SetState`. The server only handles data computation.

**F&O universe list:** The canonical list of ~200 F&O stocks is fetched once from NSE (or maintained as a static list updated monthly) and stored locally. This is the input universe for every screen.

---

## 7. MCP Tools (planned)

### `swing_screen` (entry point, `app=True`)
Takes optional filter parameters (beta range, RSI range, sector, signal type). Returns the stock list view as a `PrefabApp`. Default call (no params) returns top 15 by composite swing score.

### `stock_deep_dive` (helper)
Takes a ticker symbol. Returns a `PrefabApp` with the single stock deep-dive view. Called via `CallTool` from a row click in the stock list.

### `sector_impact` (entry point, `app=True`)
Takes a news event or macro theme as a string. Returns the sector impact view — affected sectors, direction, and ranked F&O tickers per sector.

### `composite_scan` (entry point, `app=True`)
No parameters. Runs the full composite score across the F&O universe and returns the top 10–15 names. This will become the daily dashboard refresh tool in v2.

### `get_fo_universe` (utility, internal)
Returns the current list of NSE F&O stocks. Called internally by other tools. Not exposed as an entry point.

---

## 8. Prefab UI Components Mapping

| UI element | Prefab component | Used in |
|---|---|---|
| Stock results table | `DataTable` with sort + filter | Stock list view |
| Key metric cards (beta, RSI etc.) | `Metric` | Deep-dive view |
| Price trend (3 months) | `Sparkline` | Deep-dive view |
| Signal status (bullish/bearish) | `Badge` | Both views |
| Sector impact chart | `BarChart` | Sector impact view |
| Dynamic content swap on click | `Slot` + `CallTool` | Stock list → deep-dive |
| Filters (sector, beta range) | `Select`, `Slider` | Stock list view |
| Stock score ring | `Ring` | Composite scan view |
| Loading state | `Loader` | All views |
| Alerts (overbought, news warning) | `Alert` | Deep-dive view |
| Sector breakdown | `RadarChart` | Sector impact view |

---

## 9. Phased Delivery Plan

### Phase 1 — Core screener (personal, local)

- [ ] Set up FastMCP server skeleton with Prefab integration
- [ ] Build F&O universe fetcher + SQLite cache layer
- [ ] Implement beta, RSI, volume, momentum signal computation
- [ ] Build `swing_screen` tool with stock list Prefab view
- [ ] Build `stock_deep_dive` tool with single stock Prefab view
- [ ] Connect deep-dive via `CallTool` from stock list row click
- [ ] Test end-to-end inside Claude Desktop

**Deliverable:** A working MCP App that screens F&O stocks and shows a clickable list + deep-dive inside Claude.

### Phase 2 — Sector / news impact + composite scan

- [ ] Build sector sensitivity model (hardcoded v1, AI-generated rationale)
- [ ] Build `sector_impact` tool with sector-to-ticker impact Prefab view
- [ ] Build `composite_scan` tool with scored top-N view
- [ ] Add fundamental filters (P/E, ROE, D/E) to screener
- [ ] Refine composite score weights based on personal usage

**Deliverable:** Full query-driven tool that handles stock screens, deep-dives, and macro/sector impact queries.

### Phase 3 — Persistent dashboard + multi-user

- [ ] Add watchlist state: save selected stocks across sessions (SQLite or simple JSON)
- [ ] Build persistent daily dashboard view with on-demand refresh
- [ ] Add authentication layer for multi-user access
- [ ] Evaluate moving to a paid data source (Dhan/Zerodha) for live prices
- [ ] Productize: packaging, error handling, rate limiting, docs

**Deliverable:** A shareable product that multiple users can run via their own Claude setup.

---

## 10. Open Questions

1. **News API in v2:** When we move to automated news detection (rather than user-provided events), which source is best for Indian market news? Candidates: Finshots, Economic Times RSS, Benzinga India. Needs evaluation.

2. **F&O list maintenance:** NSE updates the F&O stock list periodically. Should the app fetch it live from NSE each session, or maintain a manually updated static file? (Static is more reliable given NSE's scraping restrictions.)

3. **Composite score weights:** The weights in section 4.7 are initial estimates. They should be validated against a short backtest — does a higher composite score actually correlate with better 2-week forward returns on NSE F&O names?

4. **Sector sensitivity model:** The news-to-sector mapping in v1 will be based on hardcoded rules (e.g. rate hike → negative for real estate, positive for banks). Should this be a maintained knowledge base, or generated dynamically by Claude per query?

5. **Claude Desktop vs claude.ai:** FastMCP + Prefab MCP Apps currently render best in Claude Desktop. As claude.ai MCP App support matures, deployment target may shift. Monitor Anthropic's MCP Apps rollout.

---

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| yfinance rate limits / blocks | Medium | SQLite cache; retry with backoff; fallback to NSEPython |
| NSE scraping blocks (for F&O list) | Medium | Maintain static F&O list updated monthly; NSEPython as backup |
| Signal quality poor on smaller F&O names | Low | F&O universe is already liquid — less of an issue than broader NSE |
| Prefab API changes breaking UI | Low | Pin `prefab-ui` version explicitly; test on version bumps |
| Composite score not predictive | Medium | Backtest before relying on it; treat as a filter not a guarantee |

---

*This document covers scope, signals, architecture, and phasing for the NSE Swing Trader MCP App. Next step: begin Phase 1 implementation once this plan is reviewed and approved.*