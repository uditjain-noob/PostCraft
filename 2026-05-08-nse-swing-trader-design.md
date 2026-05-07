# NSE Swing Trader — Design Spec
**Date:** 2026-05-08  
**Status:** Approved for implementation  
**Stack:** FastMCP + Prefab Generative UI  
**Demo target:** `fastmcp dev apps`

---

## 1. Problem

Swing trading F&O stocks on NSE requires cross-referencing technicals, volume, beta, institutional flow, options sentiment, corporate actions, and macro context before committing capital. No single tool surfaces all of this together. This tool does.

---

## 2. What We Are Building

A FastMCP server with one entry point — a natural language query. An LLM agent receives the query, calls data tools in an agentic loop (multiple times, in any order, following what it discovers), collects a complete picture, and generates a Prefab UI entirely from scratch. The UI renders in `fastmcp dev apps` locally, and in Claude Desktop / claude.ai for full deployment.

The LLM decides what data to gather, how deep to go, and how to present it. The code provides data, caching, signal computation, and three non-negotiable layout rules. Everything else is the model's call.

---

## 3. Architecture

```
User query → swing_trader(query)   ← one tool, app=True
                    ↓
        LLM Agent (model + key from config, not hardcoded)
        
        Agentic loop — tool calling:
        ├── Calls data tools in any order, multiple times
        ├── Follows what it discovers (curious, not scripted)
        ├── Accumulates risk_flags from every tool
        └── Stops when it has a complete picture
                    ↓
        generate_prefab_ui(code, data)
        ├── code: LLM-written Python using Prefab components
        ├── data: all collected results as globals in sandbox
        └── Renders progressively as tokens stream
                    ↓
        PrefabApp — live in fastmcp dev apps / Claude Desktop
```

### Prompt Architecture — Modular

The main system prompt is small and stable. Each tool owns its behavioral instructions in its docstring. A `@swing_tool` decorator collects these at registration time and assembles the full prompt programmatically at call time.

```python
MAIN_PROMPT = """
You are a research assistant for NSE F&O swing trading.
Your job is to gather complete information about potential
swing trade setups before a trader commits capital.

Be thorough. Be curious. Surface what the trader needs —
including reasons NOT to take a trade.

Tool instructions are provided below. Follow them exactly.
Accumulate all risk_flags from every tool call and always
include them in the final UI.
Only call generate_prefab_ui when you have a complete picture.
"""

def build_system_prompt() -> str:
    tool_instructions = "\n\n".join(
        f"## {name}\n{instruction}"
        for name, instruction in TOOL_PROMPTS.items()
    )
    return f"{MAIN_PROMPT}\n\n---\n\n{tool_instructions}"
```

Adding a new tool automatically adds its instructions to the prompt. No changes needed anywhere else.

### Agent Loop Constraints

- Max 12 tool call rounds before forcing render with collected data
- Timeout: 45 seconds
- On limit hit: render with whatever is collected, surface a note that context is partial

---

## 4. Tool Inventory

### App Tool (1)

**`swing_trader(query: str)`** — `app=True`  
The only user-facing entry point. Builds system prompt, creates LLM client from config, runs agentic tool-calling loop, calls `generate_prefab_ui` with all collected data. Returns `PrefabApp`.

### Data Tools (14)

Each registered with `@swing_tool`. Docstring = prompt instruction. All return plain Python dicts/lists safe for Pyodide sandbox injection.

---

**`get_market_context()`**
```
WHEN: Call this first, before any other tool, on every query without exception.
RETURNS: regime (bullish|cautious|risk_off), vix, vix_trend,
         nifty_ema_alignment, nifty_close, sgx_nifty_direction,
         crude_direction, dxy_direction, risk_flags.
IF regime is risk_off (VIX > 20 or Nifty below EMA50):
  Apply beta_max=1.5 and ema_alignment=True in all subsequent
  screen_stocks() calls. Flag all surfaced setups as higher-risk.
```
Sources: yfinance (`^NSEI`, `^VIX`, `CL=F`, `DX-Y.NYB`)

---

**`get_fo_universe()`**
```
WHEN: Call if you need the full list of NSE F&O stocks,
      or before running a broad screen.
RETURNS: list of tickers with sector tags.
Fetches live from NSEPython, falls back to bundled static list.
Result is cached for the session.
```
Sources: NSEPython → static fallback JSON

---

**`screen_stocks(beta_min, beta_max, rsi_min, rsi_max, sector, volume_ratio_min, ema_alignment)`**
```
WHEN: Call after get_market_context(). All params optional.
      Call multiple times with different params to explore
      different setups — e.g. once for breakouts (rsi > 55,
      ema_alignment=True), once for oversold recovery (rsi < 40).
      Merge and de-duplicate results before ranking.
AFTER: For the top 2-3 results, automatically call
       get_options_data(), get_delivery_data(), and
       get_corporate_actions(). Do not wait to be asked.
RETURNS: ranked list with ticker, sector, beta, rsi, vol_ratio,
         ema_signal, composite_score. Score uses weights from config.
```
Sources: yfinance OHLCV + fundamentals, SQLite cache

---

**`get_composite_scan(top_n: int = 15)`**
```
WHEN: Call for broad queries like "what's setting up today"
      or "show me the best swings right now". No filters.
AFTER: Same as screen_stocks — auto-deep-dive top 2-3.
RETURNS: top N stocks ranked by composite score.
```
Sources: yfinance, SQLite cache

---

**`get_stock_deep_dive(ticker: str)`**
```
WHEN: Call for any stock you intend to surface as a setup,
      or when the user names a specific ticker.
RETURNS: 90-day OHLCV summary, beta, rsi, ema_alignment,
         atr, vol_ratio, support_resistance, pe, roe, de_ratio.
```
Sources: yfinance

---

**`get_technical_levels(ticker: str)`**
```
WHEN: Call for every stock you plan to include in the UI.
      Never surface a stock without entry, stop, and target.
      This is a hard requirement before generate_prefab_ui.
RETURNS: entry_zone [low, high], stop_loss, target,
         risk_reward, atr, pivot_high, pivot_low.
Stop is EMA50 − 1.5×ATR. Target is prior resistance or 2:1 RR.
```
Sources: yfinance OHLCV (computed, no external API)

---

**`get_peer_comparison(ticker: str)`**
```
WHEN: Call before surfacing any stock as a setup to verify
      it is leading its sector, not just riding sector beta.
RETURNS: peer table with relative RSI, momentum_20d,
         beta, and relative_strength vs sector average.
         Includes the target stock for direct comparison.
```
Sources: yfinance, F&O universe list

---

**`get_options_data(ticker: str)`**
```
WHEN: Call for any stock being considered as a setup.
RETURNS: pcr, oi_buildup (call vs put at key strikes),
         max_pain, iv_percentile, sentiment (bullish|neutral|bearish),
         risk_flags (elevated_iv if iv_percentile > 80).
IF sentiment conflicts with technical signal: do not suppress
either side. Surface both as a conflicting signal.
```
Sources: NSE option chain API (direct HTTP, cached daily)

---

**`get_fii_dii_flow(days: int = 5)`**
```
WHEN: Call if query mentions a macro event or sector theme,
      or if you find a stock with strong technicals — verify
      institutional alignment before surfacing it.
RETURNS: fii_net_cash, fii_net_fo, dii_net, flow_signal,
         risk_flags (fii_selling_streak if FII net negative
         for 3+ consecutive sessions).
IF fii_selling_streak: this overrides bullish technicals.
Surface as a conflict, not a clean setup.
```
Sources: NSE FII/DII activity report (daily CSV from nseindia.com/reports/fii-dii)
and NSE participant-wise OI CSV (separate download, shows FII F&O positioning)

---

**`get_delivery_data(ticker: str, days: int = 10)`**
```
WHEN: Call for any stock being considered as a setup.
RETURNS: delivery_pct per session alongside price direction,
         accumulation_signal (institutional|mixed|retail_driven).
High delivery on up days = institutional accumulation.
Low delivery on up days = retail-driven, likely to fade.
```
Sources: NSE bhav copy via NSEPython

---

**`get_corporate_actions(ticker: str)`**
```
WHEN: Call for every stock you intend to include in the UI.
      Non-negotiable. Never surface a stock without this check.
RETURNS: earnings_date, ex_dividend, splits, buybacks,
         risk_flags (event_within_window if any action
         falls within 15 days).
IF event_within_window: hard risk flag. Always shown in UI
even if all other signals are bullish.
```
Sources: yfinance `.calendar`, `.actions`

---

**`get_sector_rotation_map()`**
```
WHEN: Call if query involves sector themes, macro events,
      or if you want to verify the sector context for
      stocks you are surfacing.
RETURNS: NSE sectors ranked by 10-session relative performance
         vs Nifty, with flow classification
         (accumulation|distribution|neutral) per sector.
Use this to prioritise stocks in accumulation sectors
and flag stocks in distribution sectors.
```
Sources: yfinance sector index tickers

---

**`get_news_feed(query: str)`**
```
WHEN: Call if query is about a specific stock or sector,
      or if any data tool returns a surprising result
      (e.g. strong delivery but weak price — why?).
      Follow your curiosity.
RETURNS: top 5-7 recent headlines with dates and sources.
```
Sources: Google News RSS / Economic Times RSS

---

**`analyze_sector_impact(event: str, sector: str)`**
```
WHEN: Call if query describes a macro event, policy change,
      commodity move, or global demand shift.
RETURNS: affected sectors with direction (positive|negative|neutral),
         ranked F&O tickers per sector by beta-adjusted sensitivity,
         LLM-generated rationale per direction call.
The rationale is generated by an internal LLM call using
the configured model. Direction mapping uses a hardcoded
sector-to-macro sensitivity dict in Phase 1 (e.g. rate_hike →
{real_estate: negative, banks: mixed, it: neutral}). This dict
lives in tools/sector_impact.py and is updated manually as needed.
```
Sources: LLM call (model + key from config) + hardcoded sector sensitivity dict (Phase 1)

---

## 5. Signal Computation

All computed from daily EOD OHLCV. Benchmark: Nifty 50 (`^NSEI`).

| Signal | Method |
|---|---|
| Beta | Rolling 1-year daily return regression vs Nifty 50 |
| Momentum | 20d and 60d price return + EMA alignment (20 > 50 > 200) |
| RSI | 14-day RSI |
| Volume surge | Today's volume / 20-day average volume |
| Fundamentals | P/E TTM, ROE 5yr avg, D/E ratio (filters, not scoring) |
| Composite score | Weighted sum, normalised 0–100, scores < 40 filtered out |

Composite weights are read from `config.toml` at call time — not hardcoded.

---

## 6. Prefab UI — Fully Generative

The LLM writes all Prefab Python code. No templates, no component patterns prescribed by the server code.

**Three non-negotiable rules:**

1. **Market context is always the first element rendered.** The trader needs regime, VIX, and Nifty trend before reading any setup.

2. **Risk flags are always rendered at full width, never buried or collapsed.** A corporate action warning or FII selling streak must be impossible to miss.

3. **Any stock surfaced as a setup must have its trade plan rendered with it.** Entry zone, stop loss, target. The LLM must call `get_technical_levels` for every stock it intends to surface — this must happen before `generate_prefab_ui` is called, not after.

Everything else — component choice, layout, section order, visual weight, depth of information — is the LLM's decision based on what it collected and what the query asked for.

The LLM has access to `search_prefab_components(query)` to discover available components. It should use this rather than assuming what's available.

---

## 7. Configuration

```toml
# config.toml — committed to repo with empty values
# Fill before running. Reloaded at every tool call.

[llm]
model    = ""   # e.g. "claude-opus-4-7", "gpt-4o" — set before running
api_key  = ""   # or set LLM_API_KEY env var
base_url = ""   # for OpenAI-compatible endpoints; empty = Anthropic default

[weights]
momentum    = 0.25
rsi         = 0.20
volume      = 0.20
beta        = 0.20
fundamental = 0.15

[filters]
min_score        = 40
max_results      = 15
default_beta_min = 1.3

[cache]
sqlite_path = ".cache/nse_data.db"
ttl_hours   = 8
```

---

## 8. Data Sources

| Source | What it provides | Reliability |
|---|---|---|
| yfinance | OHLCV, fundamentals, corporate actions, global indices | High — primary source |
| NSEPython | F&O universe list, delivery data | Medium — NSE blocks intermittently |
| NSE direct HTTP | Option chain, participant-wise OI, FII/DII flow | Medium — cache aggressively |
| SQLite | Daily cache for all OHLCV fetches | Local — always available |
| Google News / ET RSS | News headlines | Low dependency — best-effort |
| Bundled static JSON | F&O universe fallback | Always available |

---

## 9. Phased Delivery

### Phase 1 — Demo-ready (current scope)
- FastMCP server with all 14 data tools + `swing_trader` app tool
- Signal computation: beta, RSI, momentum, volume, composite score
- SQLite cache layer
- `config.toml` for LLM model/key/weights
- Generative UI via `GenerativeUI` provider
- Demo via `fastmcp dev apps`
- EOD data only

### Phase 2 — Live deployment
- Claude Desktop / claude.ai connection
- Live price overlay on EOD base
- Watchlist persistence (SQLite)
- Broker API integration (Zerodha / Dhan) for live prices

### Phase 3 — Multi-user product
- Authentication layer
- Shared watchlists
- News API integration (automated event detection)
- Backtesting signal combinations against historical F&O data

---

## 10. Key Risks

| Risk | Mitigation |
|---|---|
| NSE scraping blocked | Static F&O list fallback; aggressive SQLite caching |
| yfinance rate limits | Cache all OHLCV by ticker+date; retry with backoff |
| LLM generates invalid Prefab code | Pyodide sandbox catches errors; server logs code for debugging |
| Composite score not predictive | Treat as filter not guarantee; backtest in Phase 3 |
| Prefab API breaking changes | Pin `prefab-ui` version explicitly in requirements.txt |
| LLM model not configured | config.toml validation at server start with clear error message |

---

## 11. Project Structure (Phase 1)

```
PostCraft/
├── server.py                  # FastMCP server + swing_trader app tool
├── tools/
│   ├── __init__.py
│   ├── decorators.py          # @swing_tool, TOOL_PROMPTS, build_system_prompt
│   ├── market_context.py
│   ├── universe.py
│   ├── screener.py
│   ├── deep_dive.py
│   ├── technical_levels.py
│   ├── peer_comparison.py
│   ├── options_data.py
│   ├── fii_dii_flow.py
│   ├── delivery_data.py
│   ├── corporate_actions.py
│   ├── sector_rotation.py
│   ├── news_feed.py
│   └── sector_impact.py
├── signals/
│   ├── __init__.py
│   ├── beta.py
│   ├── momentum.py
│   ├── rsi.py
│   ├── volume.py
│   └── composite.py
├── data/
│   ├── cache.py               # SQLite cache layer
│   ├── fo_universe.json       # Static F&O universe fallback
│   └── fetch.py               # yfinance + NSEPython wrappers
├── config.toml                # LLM model/key/weights — fill before running
└── requirements.txt
```
