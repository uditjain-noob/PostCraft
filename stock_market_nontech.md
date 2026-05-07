# NSE Swing Trader — Product Overview

> A research assistant for F&O swing trading on the Indian stock market.  
> Talks to you in plain language. Shows you what matters. Gets out of your way.

---

## What problem does this solve?

Swing trading F&O stocks on NSE involves a lot of manual work before you even make a decision:

- Scanning 200+ F&O names to find what's actually setting up
- Cross-checking technicals, volume, and beta one stock at a time
- Figuring out which sectors a piece of news actually moves — and by how much
- Keeping track of which names you were watching and why

Most tools either give you raw data and expect you to do all the thinking, or they give you oversimplified buy/sell signals with no transparency. This sits in between — it surfaces the right names with enough context to make your own call, fast.

---

## Who is this for?

Someone who understands swing trading on NSE F&O stocks. You know what beta means, you watch RSI and volume, you have a view on sectors. You don't need the tool to explain the market to you — you need it to cut through the noise and show you what's worth looking at today.

---

## The universe: F&O stocks only

The tool only looks at stocks that are part of the NSE F&O segment — roughly 200 names. This is a deliberate choice:

- These are the most liquid stocks on NSE
- They tend to have cleaner technical setups because large participants are active in them
- They are the natural home for swing trades where you want to be able to exit without slippage
- Beta is more meaningful in this universe — these names actually move with and against Nifty in predictable ways

Nifty 50 is the benchmark for all beta calculations. A stock with a beta of 1.5 moves roughly 1.5% for every 1% move in Nifty — on both sides.

---

## How you interact with it

You ask it something, and it shows you a result. The result is a live, clickable screen — not a wall of text.

You can be as specific or as broad as you want:

- *"What's setting up well for a swing this week?"* — gives you the top-ranked names right now
- *"Show me high-beta names that are oversold but fundamentally strong"* — filters the universe to match
- *"IT sector is getting hit by US spending cuts — which F&O stocks feel that most?"* — maps the news to specific names
- *"Tell me more about TATAMOTORS"* — pulls up a full breakdown of that one stock

The interface adapts to the question. A sector question gives you a sector view. A stock question gives you a stock view. A screener question gives you a ranked list.

---

## What the screener looks at

### Beta — how much does this stock amplify Nifty?

Beta is the foundation. A stock with beta 1.8 will move harder than Nifty in both directions — that's what makes it interesting for a swing, and also what makes sizing and stop placement critical. The tool uses a one-year rolling beta against Nifty 50 so it reflects current market behaviour, not stale correlations.

High-beta threshold used: **above 1.3**

---

### Momentum — is it going somewhere or going nowhere?

Momentum is assessed two ways:

**EMA alignment** — Is the price above its short-term average, which is above its medium-term average, which is above its long-term average? When all three are stacked in order (20 > 50 > 200), the stock is in a trending state. A clean trend is a better environment for a swing than a choppy sideways name.

**Distance from 52-week high** — Names that are closer to their 52-week high, but not extended, often have less resistance overhead. Names that have corrected significantly from their high but are showing early recovery signals are also flagged.

---

### RSI — is it in a tradeable zone?

RSI (14-day) is used to find names that are either:

- **Recovering from oversold** — RSI was below 30–35 and is now climbing back. This is the classic swing entry zone for trend-following trades.
- **In a strong trend** — RSI holding above 60 without being extremely overbought often signals sustained momentum.

Stocks with RSI above 75 are flagged as extended — not necessarily a sell, but a caution for new entries.

---

### Volume — is anyone actually participating?

A setup without volume is just a pattern. The tool compares today's volume to the stock's 20-day average. A ratio above 1.5x is notable; above 2x is a strong signal.

Volume surge in the direction of the move confirms the setup. Volume surge against the move (e.g. heavy volume on a down day in an otherwise rising stock) is flagged as a warning.

---

### Fundamentals — a quality filter, not a ranking signal

The tool does not try to make this a fundamental stock-picker. But it does filter out names that would make a swing trade unnecessarily risky from a balance sheet standpoint:

- **ROE (5-year average):** Prefers businesses that have consistently earned well on equity. Below 12–15% is a flag.
- **Debt-to-equity:** Highly leveraged companies can behave erratically in volatile markets. High D/E is flagged.
- **P/E:** Used to avoid structurally overvalued names where any bad news triggers outsized selling.

These are filters — they reduce the universe. They do not score or rank stocks.

---

### The composite swing score

Every stock that passes the fundamental filter gets a composite score out of 100, combining all the signals above. The weightings reflect what matters most for a short-to-medium term swing:

| Signal | Weight | Why |
|---|---|---|
| Momentum (EMA + 52w position) | 25% | Trend is the most reliable context for a swing |
| RSI zone | 20% | Entry timing within the trend |
| Volume surge | 20% | Confirms participation and conviction |
| Beta | 20% | Determines the opportunity size and risk |
| Fundamental quality | 15% | Reduces the chance of picking up a value trap |

Stocks scoring below 40 are not shown. The tool typically surfaces 10–15 names in a standard scan.

---

## The news and sector impact view

This is for when something is happening in the market and you want to know which F&O names it actually touches.

You describe the event or theme — a rate decision, a commodity price move, a sector-specific policy announcement, a global demand shift — and the tool maps it to NSE sectors and then to specific F&O stocks within those sectors.

**What it shows:**

- Which sectors are likely positively affected, which are negatively affected, and which are neutral
- Within each sector, which F&O stocks have the highest beta-adjusted sensitivity (i.e. which names will feel it most)
- A short plain-language rationale for each direction call

**Examples of events it can map:**

- RBI rate hike → negative for real estate and NBFCs, mixed for banks, neutral for IT
- Crude oil spike → negative for paints, airlines, tyres; positive for upstream oil companies
- Strong monsoon forecast → positive for agri, FMCG rural, fertilisers
- INR depreciation → positive for IT exporters, pharma; negative for importers
- US recession fears → negative for IT (revenue exposure), positive for domestic consumption names

The tool uses known sector-to-macro relationships as the base, then adds the specific beta ranking within the sector to tell you not just *which sector* but *which stocks within that sector* will move the most.

Beta stocks by definition do not get a lot of company-specific news — their moves are mostly market and sector driven. This view is designed for exactly that: understanding the sector and macro forces, then finding the highest-beta expression of that view within F&O.

---

## What a typical session looks like

**Morning, before market open:**

Ask for the composite swing scan. Review the top 10–15 names. Click into 2–3 that look interesting for a full breakdown. Check if any of them are in sectors with relevant news that morning.

**During a market event (RBI policy, budget, global macro):**

Ask the sector impact question. See which F&O names are most exposed. Cross-check the ones you were already watching.

**Mid-swing, stock you're already holding:**

Ask for a deep-dive on that ticker. Check if the technical signals have changed — is RSI still in trend, is volume holding, has EMA alignment broken.

**Building your watchlist:**

Use filters to narrow the universe to your preferred setup — a specific beta range, a specific RSI zone, a specific sector. Save the names you like.

---

## What it is not

- It is not a buy/sell signal generator. It surfaces setups; you make the call.
- It is not a real-time intraday tool. All data is end-of-day. It is designed for swing trades held over days to weeks, not intraday scalps.
- It does not predict price targets or returns. It scores the quality and strength of a setup, not the outcome.
- It does not manage your portfolio or track P&L. It is purely a research and screening tool.
- It does not replace your own analysis. It compresses the time it takes to get to the stocks worth looking at.

---

## Roadmap

### Now — core screener
The screener, deep-dive, and sector impact views. Query-driven. Works inside Claude.

### Next — daily dashboard
A persistent view of your selected stocks that you can refresh on demand. Saves your watchlist between sessions.

### Later — live data and execution
When the tool matures, the option to connect a broker account (Zerodha or Dhan) for live prices and one-click order placement from within the tool.

---

*This tool is for research and educational purposes. It does not constitute financial advice. All trading decisions remain yours.*