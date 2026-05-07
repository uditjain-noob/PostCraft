# NSE Swing Trader — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all 14 MCP data tools with full unit tests and a mini Prefab test UI for each, so every tool can be individually invoked and verified in `fastmcp dev apps` before the LLM agent is wired up in Phase 2.

**Architecture:** FastMCP server with `@swing_tool` decorator pattern. Each tool lives in its own file, owns its prompt instructions in its docstring, and has a corresponding `app=True` test UI wrapper that renders its raw output as formatted JSON in Prefab. Signal computation is in `signals/`, external API calls go through cacheable wrappers in `data/`.

**Tech Stack:** Python 3.11+, FastMCP ≥ 3.2, prefab-ui (pinned), yfinance ≥ 0.2.40, pandas, numpy, NSEPython, httpx, feedparser, pytest, pytest-mock

---

## File Map

```
PostCraft/
├── config.py                      # loads config.toml at call time
├── config.toml                    # LLM/weights/filters/cache — fill before running
├── requirements.txt
├── server.py                      # FastMCP + GenerativeUI + registers all tools
├── data/
│   ├── __init__.py
│   ├── cache.py                   # SQLite cache (get/set/TTL)
│   ├── fetch.py                   # yfinance wrappers (OHLCV, info, calendar, actions)
│   └── fo_universe.json           # static F&O fallback list
├── signals/
│   ├── __init__.py
│   ├── beta.py                    # rolling 1yr beta vs Nifty
│   ├── rsi.py                     # 14-day RSI
│   ├── momentum.py                # EMA alignment, 20d/60d return, 52w position
│   ├── volume.py                  # volume ratio vs 20-day avg
│   └── composite.py               # weighted composite score (reads weights from config)
├── tools/
│   ├── __init__.py
│   ├── decorators.py              # @swing_tool, TOOL_PROMPTS dict, build_system_prompt()
│   ├── market_context.py          # get_market_context()
│   ├── universe.py                # get_fo_universe()
│   ├── screener.py                # screen_stocks(), get_composite_scan()
│   ├── deep_dive.py               # get_stock_deep_dive()
│   ├── technical_levels.py        # get_technical_levels()
│   ├── peer_comparison.py         # get_peer_comparison()
│   ├── options_data.py            # get_options_data()
│   ├── fii_dii_flow.py            # get_fii_dii_flow()
│   ├── delivery_data.py           # get_delivery_data()
│   ├── corporate_actions.py       # get_corporate_actions()
│   ├── sector_rotation.py         # get_sector_rotation_map()
│   ├── news_feed.py               # get_news_feed()
│   └── sector_impact.py           # analyze_sector_impact()
├── ui/
│   └── test_ui.py                 # app=True Prefab wrappers for every tool
└── tests/
    ├── test_cache.py
    ├── test_fetch.py
    ├── test_signals.py
    ├── test_decorators.py
    ├── test_market_context.py
    ├── test_universe.py
    ├── test_screener.py
    ├── test_deep_dive.py
    ├── test_technical_levels.py
    ├── test_peer_comparison.py
    ├── test_options_data.py
    ├── test_fii_dii_flow.py
    ├── test_delivery_data.py
    ├── test_corporate_actions.py
    ├── test_sector_rotation.py
    ├── test_news_feed.py
    └── test_sector_impact.py
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `requirements.txt`
- Create: `config.toml`
- Create: `config.py`
- Create: `.gitignore`
- Create: all `__init__.py` files

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p data signals tools ui tests
touch data/__init__.py signals/__init__.py tools/__init__.py tests/__init__.py
```

- [ ] **Step 2: Write `requirements.txt`**

```
fastmcp>=3.2.0
prefab-ui==0.1.0
yfinance>=0.2.40
pandas>=2.0.0
numpy>=1.26.0
nsepython>=2.9.0
httpx>=0.27.0
feedparser>=6.0.11
pytest>=8.0.0
pytest-mock>=3.12.0
```

- [ ] **Step 3: Write `config.toml`**

```toml
# Fill llm section before running. Everything else has working defaults.

[llm]
model    = ""
api_key  = ""
base_url = ""

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

- [ ] **Step 4: Write `config.py`**

```python
import tomllib
from pathlib import Path

def get_config() -> dict:
    path = Path(__file__).parent / "config.toml"
    with open(path, "rb") as f:
        return tomllib.load(f)
```

- [ ] **Step 5: Write `.gitignore`**

```
.cache/
__pycache__/
*.pyc
.env
config.local.toml
.superpowers/
```

- [ ] **Step 6: Install dependencies**

```bash
pip install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 7: Commit**

```bash
git add requirements.txt config.toml config.py .gitignore data/__init__.py signals/__init__.py tools/__init__.py tests/__init__.py ui/
git commit -m "feat: project scaffold, config, and directory structure"
```

---

## Task 2: SQLite Cache Layer

**Files:**
- Create: `data/cache.py`
- Create: `tests/test_cache.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_cache.py
import pytest, time
from data.cache import Cache

@pytest.fixture
def cache(tmp_path):
    return Cache(str(tmp_path / "test.db"), ttl_hours=1)

def test_miss_returns_none(cache):
    assert cache.get("missing_key") is None

def test_set_then_get_returns_value(cache):
    cache.set("key1", {"ticker": "RELIANCE", "beta": 1.6})
    result = cache.get("key1")
    assert result == {"ticker": "RELIANCE", "beta": 1.6}

def test_expired_entry_returns_none(cache):
    short = Cache(str(cache.db_path) + "_short.db", ttl_hours=0)
    short.set("key2", {"x": 1})
    time.sleep(0.01)
    assert short.get("key2") is None

def test_overwrite_updates_value(cache):
    cache.set("key3", {"v": 1})
    cache.set("key3", {"v": 2})
    assert cache.get("key3") == {"v": 2}

def test_handles_list_value(cache):
    cache.set("list_key", [1, 2, 3])
    assert cache.get("list_key") == [1, 2, 3]
```

- [ ] **Step 2: Run test to confirm failure**

```bash
pytest tests/test_cache.py -v
```
Expected: `ImportError: cannot import name 'Cache'`

- [ ] **Step 3: Write `data/cache.py`**

```python
import sqlite3, json
from datetime import datetime, timedelta
from pathlib import Path

class Cache:
    def __init__(self, db_path: str, ttl_hours: int = 8):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.ttl = timedelta(hours=ttl_hours)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        self.conn.commit()

    def get(self, key: str):
        row = self.conn.execute(
            "SELECT value, expires_at FROM cache WHERE key = ?", (key,)
        ).fetchone()
        if row and datetime.fromisoformat(row[1]) > datetime.utcnow():
            return json.loads(row[0])
        return None

    def set(self, key: str, value):
        expires = (datetime.utcnow() + self.ttl).isoformat()
        self.conn.execute(
            "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
            (key, json.dumps(value, default=str), expires)
        )
        self.conn.commit()

_instance: Cache | None = None

def get_cache() -> Cache:
    global _instance
    if _instance is None:
        from config import get_config
        cfg = get_config()
        _instance = Cache(cfg["cache"]["sqlite_path"], cfg["cache"]["ttl_hours"])
    return _instance
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
pytest tests/test_cache.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add data/cache.py tests/test_cache.py
git commit -m "feat: SQLite cache layer with TTL"
```

---

## Task 3: yfinance Fetch Wrappers

**Files:**
- Create: `data/fetch.py`
- Create: `tests/test_fetch.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_fetch.py
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from data.fetch import fetch_ohlcv, fetch_info, fetch_calendar, fetch_actions

@pytest.fixture(autouse=True)
def no_cache(monkeypatch):
    monkeypatch.setattr("data.fetch.get_cache", lambda: MagicMock(get=lambda k: None, set=lambda k, v: None))

def make_ohlcv():
    dates = pd.date_range("2025-01-01", periods=5)
    return pd.DataFrame({
        "Open": [100]*5, "High": [105]*5,
        "Low": [98]*5, "Close": [102.0, 103, 101, 104, 105],
        "Volume": [1000000]*5
    }, index=dates)

def test_fetch_ohlcv_returns_dataframe():
    with patch("yfinance.download", return_value=make_ohlcv()):
        df = fetch_ohlcv("RELIANCE.NS", period="1mo")
    assert isinstance(df, pd.DataFrame)
    assert "Close" in df.columns
    assert len(df) == 5

def test_fetch_ohlcv_raises_on_empty():
    with patch("yfinance.download", return_value=pd.DataFrame()):
        with pytest.raises(ValueError, match="No data"):
            fetch_ohlcv("INVALID.NS", period="1mo")

def test_fetch_info_returns_dict():
    mock_ticker = MagicMock()
    mock_ticker.info = {"trailingPE": 22.5, "returnOnEquity": 0.18}
    with patch("yfinance.Ticker", return_value=mock_ticker):
        info = fetch_info("RELIANCE.NS")
    assert info["trailingPE"] == 22.5

def test_fetch_calendar_returns_dict():
    mock_ticker = MagicMock()
    mock_ticker.calendar = {"Earnings Date": ["2026-06-15"]}
    with patch("yfinance.Ticker", return_value=mock_ticker):
        cal = fetch_calendar("RELIANCE.NS")
    assert "Earnings Date" in cal

def test_fetch_actions_returns_list_or_empty():
    mock_ticker = MagicMock()
    mock_ticker.actions = pd.DataFrame()
    with patch("yfinance.Ticker", return_value=mock_ticker):
        result = fetch_actions("RELIANCE.NS")
    assert result == {}
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_fetch.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Write `data/fetch.py`**

```python
import yfinance as yf
import pandas as pd
from data.cache import get_cache

def fetch_ohlcv(ticker: str, period: str = "1y") -> pd.DataFrame:
    cache = get_cache()
    key = f"ohlcv:{ticker}:{period}"
    cached = cache.get(key)
    if cached:
        df = pd.DataFrame(cached)
        df.index = pd.to_datetime(df.index)
        return df
    df = yf.download(ticker, period=period, progress=False, auto_adjust=True)
    if df.empty:
        raise ValueError(f"No data for {ticker}")
    cache.set(key, df.reset_index().to_dict(orient="records"))
    return df

def fetch_info(ticker: str) -> dict:
    cache = get_cache()
    key = f"info:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached
    info = yf.Ticker(ticker).info
    cache.set(key, info)
    return info

def fetch_calendar(ticker: str) -> dict:
    try:
        cal = yf.Ticker(ticker).calendar
        if cal is None:
            return {}
        if hasattr(cal, "to_dict"):
            return {k: [str(v) for v in vals] for k, vals in cal.items()}
        return cal
    except Exception:
        return {}

def fetch_actions(ticker: str) -> dict | list:
    try:
        actions = yf.Ticker(ticker).actions
        if actions is None or actions.empty:
            return {}
        return actions.reset_index().to_dict(orient="records")
    except Exception:
        return {}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
pytest tests/test_fetch.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add data/fetch.py tests/test_fetch.py
git commit -m "feat: yfinance fetch wrappers with cache integration"
```

---

## Task 4: F&O Universe — Static JSON + Live Loader

**Files:**
- Create: `data/fo_universe.json` (sample — first 10 of ~200 real tickers)
- Create: `tools/universe.py`
- Create: `tests/test_universe.py`

- [ ] **Step 1: Create `data/fo_universe.json`**

```json
[
  {"ticker": "RELIANCE.NS", "sector": "Energy"},
  {"ticker": "TCS.NS", "sector": "IT"},
  {"ticker": "INFY.NS", "sector": "IT"},
  {"ticker": "HDFCBANK.NS", "sector": "Banking"},
  {"ticker": "ICICIBANK.NS", "sector": "Banking"},
  {"ticker": "TATAMOTORS.NS", "sector": "Auto"},
  {"ticker": "MARUTI.NS", "sector": "Auto"},
  {"ticker": "AXISBANK.NS", "sector": "Banking"},
  {"ticker": "WIPRO.NS", "sector": "IT"},
  {"ticker": "BAJFINANCE.NS", "sector": "NBFC"},
  {"ticker": "SBIN.NS", "sector": "Banking"},
  {"ticker": "HINDUNILVR.NS", "sector": "FMCG"},
  {"ticker": "NESTLEIND.NS", "sector": "FMCG"},
  {"ticker": "TITAN.NS", "sector": "Consumer"},
  {"ticker": "LTIM.NS", "sector": "IT"},
  {"ticker": "HCLTECH.NS", "sector": "IT"},
  {"ticker": "ADANIENT.NS", "sector": "Conglomerate"},
  {"ticker": "ADANIPORTS.NS", "sector": "Infrastructure"},
  {"ticker": "ONGC.NS", "sector": "Energy"},
  {"ticker": "COALINDIA.NS", "sector": "Commodities"}
]
```

> Note: Expand this to the full ~200 F&O stocks before production use. Current list is enough for unit testing all tools.

- [ ] **Step 2: Write failing tests**

```python
# tests/test_universe.py
import pytest
from unittest.mock import patch
from tools.universe import get_fo_universe

def test_returns_list_of_dicts():
    result = get_fo_universe()
    assert isinstance(result, list)
    assert len(result) > 0
    assert "ticker" in result[0]
    assert "sector" in result[0]

def test_tickers_have_ns_suffix():
    result = get_fo_universe()
    assert all(r["ticker"].endswith(".NS") for r in result)

def test_falls_back_to_static_on_nsepython_error():
    with patch("tools.universe._fetch_live_universe", side_effect=Exception("NSE blocked")):
        result = get_fo_universe()
    assert len(result) > 0

def test_live_fetch_result_is_used_when_available():
    live = [{"ticker": "LIVE.NS", "sector": "Test"}]
    with patch("tools.universe._fetch_live_universe", return_value=live):
        result = get_fo_universe()
    assert result[0]["ticker"] == "LIVE.NS"
```

- [ ] **Step 3: Run to confirm failure**

```bash
pytest tests/test_universe.py -v
```
Expected: `ImportError`

- [ ] **Step 4: Write `tools/universe.py`**

```python
import json
from pathlib import Path
from tools.decorators import swing_tool

_STATIC_PATH = Path(__file__).parent.parent / "data" / "fo_universe.json"
_universe_cache: list | None = None

def _load_static() -> list:
    with open(_STATIC_PATH) as f:
        return json.load(f)

def _fetch_live_universe() -> list:
    from nsepython import fnolist
    tickers = fnolist()
    return [{"ticker": f"{t}.NS", "sector": "Unknown"} for t in tickers]

@swing_tool
def get_fo_universe() -> list:
    """
    WHEN: Call if you need the full list of NSE F&O stocks,
          or before running a broad screen.
    RETURNS: list of dicts with ticker (.NS suffix) and sector.
    Fetches live from NSEPython, falls back to bundled static list.
    Result is cached for the session.
    """
    global _universe_cache
    if _universe_cache is not None:
        return _universe_cache
    try:
        _universe_cache = _fetch_live_universe()
    except Exception:
        _universe_cache = _load_static()
    return _universe_cache
```

- [ ] **Step 5: Run tests — confirm pass**

```bash
pytest tests/test_universe.py -v
```
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add data/fo_universe.json tools/universe.py tests/test_universe.py
git commit -m "feat: F&O universe loader with NSEPython + static fallback"
```

---

## Task 5: Signal — Beta

**Files:**
- Create: `signals/beta.py`
- Create: `tests/test_signals.py` (start this file here, append in later tasks)

- [ ] **Step 1: Write failing test**

```python
# tests/test_signals.py
import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch
from signals.beta import compute_beta

def make_series(values):
    return pd.Series(values, index=pd.date_range("2024-01-01", periods=len(values), freq="D"))

def make_ohlcv(closes):
    s = make_series(closes)
    return pd.DataFrame({"Close": s, "Volume": [1e6]*len(closes)})

def test_beta_of_identical_series_is_one():
    prices = [100 + i for i in range(252)]
    with patch("signals.beta.fetch_ohlcv", side_effect=[make_ohlcv(prices), make_ohlcv(prices)]):
        b = compute_beta("STOCK.NS")
    assert abs(b - 1.0) < 0.01

def test_beta_of_double_returns_is_two():
    bench = [100 + i for i in range(252)]
    stock = [100 + 2*i for i in range(252)]
    with patch("signals.beta.fetch_ohlcv", side_effect=[make_ohlcv(stock), make_ohlcv(bench)]):
        b = compute_beta("STOCK.NS")
    assert abs(b - 2.0) < 0.05

def test_beta_returns_float():
    prices = list(range(100, 352))
    with patch("signals.beta.fetch_ohlcv", side_effect=[make_ohlcv(prices), make_ohlcv(prices)]):
        b = compute_beta("STOCK.NS")
    assert isinstance(b, float)
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_signals.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Write `signals/beta.py`**

```python
import numpy as np
import pandas as pd
from data.fetch import fetch_ohlcv

def compute_beta(ticker: str, benchmark: str = "^NSEI") -> float:
    stock_df = fetch_ohlcv(ticker, period="1y")
    bench_df = fetch_ohlcv(benchmark, period="1y")
    stock_ret = stock_df["Close"].pct_change().dropna()
    bench_ret = bench_df["Close"].pct_change().dropna()
    combined = pd.concat([stock_ret, bench_ret], axis=1).dropna()
    combined.columns = ["stock", "bench"]
    cov = np.cov(combined["stock"], combined["bench"])
    bench_var = cov[1, 1]
    return float(cov[0, 1] / bench_var) if bench_var != 0 else 1.0
```

- [ ] **Step 4: Run — confirm pass**

```bash
pytest tests/test_signals.py -v
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add signals/beta.py tests/test_signals.py
git commit -m "feat: beta signal computation vs Nifty 50"
```

---

## Task 6: Signals — RSI, Momentum, Volume, Composite

**Files:**
- Create: `signals/rsi.py`
- Create: `signals/momentum.py`
- Create: `signals/volume.py`
- Create: `signals/composite.py`
- Modify: `tests/test_signals.py` (append tests)

- [ ] **Step 1: Append tests to `tests/test_signals.py`**

```python
from signals.rsi import compute_rsi
from signals.momentum import compute_ema, ema_alignment, momentum_20d, pct_from_52w_high
from signals.volume import compute_volume_ratio
from signals.composite import compute_composite_score

# RSI
def test_rsi_overbought_range():
    closes = make_series([100 + i*0.5 for i in range(50)])  # steady uptrend
    rsi = compute_rsi(closes)
    assert 60 < rsi <= 100

def test_rsi_oversold_range():
    closes = make_series([100 - i*0.5 for i in range(50)])  # steady downtrend
    rsi = compute_rsi(closes)
    assert 0 <= rsi < 40

def test_rsi_neutral_range():
    import math
    closes = make_series([100 + math.sin(i) * 2 for i in range(50)])
    rsi = compute_rsi(closes)
    assert 30 <= rsi <= 70

# Momentum
def test_ema_bullish_alignment():
    # Sustained uptrend produces bullish EMA stack
    closes = make_series([50 + i*0.3 for i in range(300)])
    assert ema_alignment(closes) == "bullish"

def test_ema_bearish_alignment():
    closes = make_series([300 - i*0.3 for i in range(300)])
    assert ema_alignment(closes) == "bearish"

def test_momentum_20d_positive_uptrend():
    closes = make_series([100 + i for i in range(30)])
    assert momentum_20d(closes) > 0

def test_pct_from_52w_high_at_high_is_zero():
    closes = make_series([100.0] * 252)
    assert abs(pct_from_52w_high(closes)) < 0.01

# Volume
def test_volume_ratio_surge():
    vols = pd.Series([1_000_000] * 19 + [3_000_000])
    assert compute_volume_ratio(vols) == pytest.approx(3.0, rel=0.05)

def test_volume_ratio_normal():
    vols = pd.Series([1_000_000] * 20)
    assert compute_volume_ratio(vols) == pytest.approx(1.0, rel=0.01)

# Composite
def test_composite_score_in_range():
    score = compute_composite_score(
        beta=1.5, rsi=52, volume_ratio=1.8,
        ema_signal="bullish", momentum_20d_val=5.0,
        pct_from_52w_high_val=-8.0, roe=0.18, de_ratio=0.5
    )
    assert 0 <= score <= 100

def test_composite_low_quality_scores_below_40():
    score = compute_composite_score(
        beta=0.5, rsi=80, volume_ratio=0.5,
        ema_signal="bearish", momentum_20d_val=-15.0,
        pct_from_52w_high_val=-40.0, roe=0.05, de_ratio=3.0
    )
    assert score < 40
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
pytest tests/test_signals.py -v
```
Expected: RSI/momentum/volume/composite tests fail with ImportError.

- [ ] **Step 3: Write `signals/rsi.py`**

```python
import pandas as pd

def compute_rsi(closes: pd.Series, period: int = 14) -> float:
    delta = closes.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, float("inf"))
    rsi = 100 - (100 / (1 + rs))
    return float(rsi.iloc[-1])
```

- [ ] **Step 4: Write `signals/momentum.py`**

```python
import pandas as pd

def compute_ema(closes: pd.Series, period: int) -> pd.Series:
    return closes.ewm(span=period, adjust=False).mean()

def ema_alignment(closes: pd.Series) -> str:
    price = float(closes.iloc[-1])
    ema20 = float(compute_ema(closes, 20).iloc[-1])
    ema50 = float(compute_ema(closes, 50).iloc[-1])
    ema200 = float(compute_ema(closes, 200).iloc[-1])
    if price > ema20 > ema50 > ema200:
        return "bullish"
    if price < ema20 < ema50 < ema200:
        return "bearish"
    return "neutral"

def momentum_20d(closes: pd.Series) -> float:
    if len(closes) < 21:
        return 0.0
    return float((closes.iloc[-1] / closes.iloc[-21] - 1) * 100)

def momentum_60d(closes: pd.Series) -> float:
    if len(closes) < 61:
        return 0.0
    return float((closes.iloc[-1] / closes.iloc[-61] - 1) * 100)

def pct_from_52w_high(closes: pd.Series) -> float:
    window = min(252, len(closes))
    high = closes.rolling(window).max().iloc[-1]
    return float((closes.iloc[-1] / high - 1) * 100) if high > 0 else 0.0
```

- [ ] **Step 5: Write `signals/volume.py`**

```python
import pandas as pd

def compute_volume_ratio(volumes: pd.Series, window: int = 20) -> float:
    avg = volumes.rolling(window).mean().iloc[-1]
    current = float(volumes.iloc[-1])
    return float(current / avg) if avg and avg > 0 else 0.0
```

- [ ] **Step 6: Write `signals/composite.py`**

```python
from config import get_config

def compute_composite_score(
    beta: float,
    rsi: float,
    volume_ratio: float,
    ema_signal: str,
    momentum_20d_val: float,
    pct_from_52w_high_val: float,
    roe: float,
    de_ratio: float,
) -> float:
    w = get_config()["weights"]

    ema_score = {"bullish": 100.0, "neutral": 50.0, "bearish": 0.0}.get(ema_signal, 50.0)
    mom_score = min(100.0, max(0.0, 50.0 + momentum_20d_val * 2))
    pos_score = min(100.0, max(0.0, 100.0 + pct_from_52w_high_val * 2))
    momentum = ema_score * 0.4 + mom_score * 0.3 + pos_score * 0.3

    if 40 <= rsi <= 60:
        rsi_score = 80.0 + (50 - abs(rsi - 50)) * 0.4
    elif rsi < 40:
        rsi_score = max(0.0, rsi * 1.5)
    else:
        rsi_score = max(0.0, 100.0 - (rsi - 60) * 2.5)

    vol_score = min(100.0, volume_ratio * 50)
    beta_score = min(100.0, max(0.0, (beta - 0.5) * 50))
    fund_score = 100.0 if (roe >= 0.12 and de_ratio <= 1.5) else (30.0 if roe >= 0.08 else 0.0)

    score = (
        momentum   * w["momentum"] +
        rsi_score  * w["rsi"] +
        vol_score  * w["volume"] +
        beta_score * w["beta"] +
        fund_score * w["fundamental"]
    )
    return round(min(100.0, max(0.0, score)), 1)
```

- [ ] **Step 7: Run all signal tests — confirm pass**

```bash
pytest tests/test_signals.py -v
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add signals/rsi.py signals/momentum.py signals/volume.py signals/composite.py tests/test_signals.py
git commit -m "feat: RSI, momentum, volume, and composite score signals"
```

---

## Task 7: @swing_tool Decorator

**Files:**
- Create: `tools/decorators.py`
- Create: `tests/test_decorators.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_decorators.py
from tools.decorators import swing_tool, TOOL_PROMPTS, build_system_prompt

def test_decorator_registers_docstring():
    TOOL_PROMPTS.clear()

    @swing_tool
    def my_tool() -> dict:
        """WHEN: Call this for testing. RETURNS: empty dict."""
        return {}

    assert "my_tool" in TOOL_PROMPTS
    assert "WHEN: Call this for testing" in TOOL_PROMPTS["my_tool"]

def test_decorated_function_still_callable():
    @swing_tool
    def add(a: int, b: int) -> int:
        """WHEN: test. RETURNS: sum."""
        return a + b

    assert add(2, 3) == 5

def test_build_system_prompt_contains_tool_instructions():
    TOOL_PROMPTS.clear()

    @swing_tool
    def tool_a() -> dict:
        """WHEN: Call A. RETURNS: dict."""
        return {}

    prompt = build_system_prompt()
    assert "## tool_a" in prompt
    assert "WHEN: Call A" in prompt
    assert "research assistant" in prompt

def test_tool_without_docstring_is_not_registered():
    initial_count = len(TOOL_PROMPTS)

    @swing_tool
    def no_doc():
        pass

    assert len(TOOL_PROMPTS) == initial_count
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_decorators.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Write `tools/decorators.py`**

```python
import inspect
from typing import Callable

TOOL_PROMPTS: dict[str, str] = {}

MAIN_PROMPT = """You are a research assistant for NSE F&O swing trading.
Your job is to gather complete information about potential
swing trade setups before a trader commits capital.

Be thorough. Be curious. Surface what the trader needs —
including reasons NOT to take a trade.

Tool instructions are provided below. Follow them exactly.
Accumulate all risk_flags from every tool call and always
include them in the final UI.
Only call generate_prefab_ui when you have a complete picture."""

def swing_tool(fn: Callable) -> Callable:
    doc = inspect.cleandoc(fn.__doc__ or "")
    if doc:
        TOOL_PROMPTS[fn.__name__] = doc
    return fn

def build_system_prompt() -> str:
    instructions = "\n\n".join(
        f"## {name}\n{instruction}"
        for name, instruction in TOOL_PROMPTS.items()
    )
    return f"{MAIN_PROMPT}\n\n---\n\n{instructions}"
```

- [ ] **Step 4: Run — confirm pass**

```bash
pytest tests/test_decorators.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/decorators.py tests/test_decorators.py
git commit -m "feat: @swing_tool decorator with modular prompt assembly"
```

---

## Task 8: Tool — get_market_context

**Files:**
- Create: `tools/market_context.py`
- Create: `tests/test_market_context.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_market_context.py
import pytest
import pandas as pd
from unittest.mock import patch
from tools.market_context import get_market_context

def make_df(closes, n=30):
    import numpy as np
    return pd.DataFrame({
        "Close": pd.Series(closes, index=pd.date_range("2025-01-01", periods=len(closes))),
        "Volume": [1e6] * len(closes)
    })

BULLISH_NIFTY = [20000 + i * 50 for i in range(180)]  # 6mo uptrend
FLAT_VIX      = [14.0] * 30
CRUDE_UP      = [75.0, 76.0, 77.0, 78.0, 79.0]
DXY_DOWN      = [104.0, 103.5, 103.0, 102.5, 102.0]

@pytest.fixture
def mock_fetch(monkeypatch):
    def _fetch(ticker, period="1y"):
        if "NSEI" in ticker:
            return make_df(BULLISH_NIFTY)
        if "VIX" in ticker:
            return make_df(FLAT_VIX)
        if "CL=" in ticker:
            return make_df(CRUDE_UP)
        if "DX-Y" in ticker:
            return make_df(DXY_DOWN)
        return make_df([100]*30)
    monkeypatch.setattr("tools.market_context.fetch_ohlcv", _fetch)

def test_returns_required_keys(mock_fetch):
    result = get_market_context()
    for key in ["regime", "vix", "vix_trend", "nifty_close",
                "nifty_ema_alignment", "crude_direction", "dxy_direction", "risk_flags"]:
        assert key in result

def test_bullish_regime_with_low_vix(mock_fetch):
    result = get_market_context()
    assert result["regime"] == "bullish"
    assert result["risk_flags"] == []

def test_risk_off_when_vix_high(monkeypatch):
    high_vix = [22.0] * 30
    def _fetch(ticker, period="1y"):
        if "NSEI" in ticker: return make_df(BULLISH_NIFTY)
        if "VIX" in ticker:  return make_df(high_vix)
        return make_df([100]*5)
    monkeypatch.setattr("tools.market_context.fetch_ohlcv", _fetch)
    result = get_market_context()
    assert result["regime"] == "risk_off"
    assert any("VIX" in f["label"] for f in result["risk_flags"])

def test_vix_value_is_float(mock_fetch):
    result = get_market_context()
    assert isinstance(result["vix"], float)
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_market_context.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Write `tools/market_context.py`**

```python
from tools.decorators import swing_tool
from data.fetch import fetch_ohlcv
from signals.momentum import compute_ema, ema_alignment

@swing_tool
def get_market_context() -> dict:
    """
    WHEN: Call this first, before any other tool, on every query without exception.
    RETURNS: regime (bullish|cautious|risk_off), vix, vix_trend,
             nifty_ema_alignment, nifty_close, crude_direction,
             dxy_direction, risk_flags.
    IF regime is risk_off (VIX > 20 or Nifty below EMA50):
      Apply beta_max=1.5 and ema_alignment=True in all subsequent
      screen_stocks() calls. Flag all surfaced setups as higher-risk.
    """
    nifty  = fetch_ohlcv("^NSEI",    period="6mo")
    vix_df = fetch_ohlcv("^VIX",     period="1mo")
    crude  = fetch_ohlcv("CL=F",     period="5d")
    dxy    = fetch_ohlcv("DX-Y.NYB", period="5d")

    nifty_close = float(nifty["Close"].iloc[-1])
    nifty_ema50 = float(compute_ema(nifty["Close"], 50).iloc[-1])
    nifty_signal = ema_alignment(nifty["Close"])

    vix = float(vix_df["Close"].iloc[-1])
    vix_prev = float(vix_df["Close"].iloc[-5]) if len(vix_df) >= 5 else vix
    vix_trend = "rising" if vix > vix_prev else "falling"

    crude_dir = "up" if float(crude["Close"].iloc[-1]) > float(crude["Close"].iloc[0]) else "down"
    dxy_dir   = "up" if float(dxy["Close"].iloc[-1])   > float(dxy["Close"].iloc[0])   else "down"

    risk_flags = []
    if vix > 20:
        risk_flags.append({
            "label": "Elevated VIX",
            "detail": f"VIX at {vix:.1f} — above 20. Market in fear. Apply strict filters.",
            "severity": "high"
        })
    if nifty_close < nifty_ema50:
        risk_flags.append({
            "label": "Nifty Below EMA50",
            "detail": "Index below medium-term average — downtrend in progress.",
            "severity": "high"
        })

    if vix > 20 or nifty_close < nifty_ema50:
        regime = "risk_off"
    elif vix > 15 or nifty_signal == "neutral":
        regime = "cautious"
    else:
        regime = "bullish"

    return {
        "regime": regime,
        "vix": round(vix, 2),
        "vix_trend": vix_trend,
        "nifty_close": round(nifty_close, 2),
        "nifty_ema_alignment": nifty_signal,
        "crude_direction": crude_dir,
        "dxy_direction": dxy_dir,
        "risk_flags": risk_flags,
    }
```

- [ ] **Step 4: Run — confirm pass**

```bash
pytest tests/test_market_context.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/market_context.py tests/test_market_context.py
git commit -m "feat: get_market_context tool with regime detection"
```

---

## Task 9: Tools — screen_stocks + get_composite_scan

**Files:**
- Create: `tools/screener.py`
- Create: `tests/test_screener.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_screener.py
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from tools.screener import screen_stocks, get_composite_scan

UNIVERSE = [
    {"ticker": "RELIANCE.NS", "sector": "Energy"},
    {"ticker": "TCS.NS",      "sector": "IT"},
    {"ticker": "INFY.NS",     "sector": "IT"},
]

def make_ohlcv(n=300, trend="up"):
    base = 100
    closes = [base + (i if trend == "up" else -i) * 0.3 for i in range(n)]
    vols = [1_500_000] * n
    return pd.DataFrame({
        "Close": pd.Series(closes, index=pd.date_range("2024-01-01", periods=n)),
        "Volume": vols,
        "High": [c * 1.02 for c in closes],
        "Low":  [c * 0.98 for c in closes],
    })

def make_info():
    return {"trailingPE": 18.0, "returnOnEquity": 0.20, "debtToEquity": 0.4}

@pytest.fixture(autouse=True)
def mock_deps(monkeypatch):
    monkeypatch.setattr("tools.screener.get_fo_universe", lambda: UNIVERSE)
    monkeypatch.setattr("tools.screener.fetch_ohlcv", lambda t, period="1y": make_ohlcv())
    monkeypatch.setattr("tools.screener.fetch_info", lambda t: make_info())
    monkeypatch.setattr("tools.screener.compute_beta", lambda t: 1.6)

def test_screen_stocks_returns_list():
    result = screen_stocks()
    assert isinstance(result, list)

def test_screen_stocks_fields_present():
    result = screen_stocks()
    if result:
        row = result[0]
        for field in ["ticker", "sector", "beta", "rsi", "vol_ratio", "ema_signal", "composite_score"]:
            assert field in row

def test_filter_by_sector():
    result = screen_stocks(sector="IT")
    assert all(r["sector"] == "IT" for r in result)

def test_composite_scan_returns_top_n():
    result = get_composite_scan(top_n=2)
    assert len(result) <= 2

def test_results_sorted_by_score_descending():
    result = screen_stocks()
    scores = [r["composite_score"] for r in result]
    assert scores == sorted(scores, reverse=True)
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_screener.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Write `tools/screener.py`**

```python
from tools.decorators import swing_tool
from tools.universe import get_fo_universe
from data.fetch import fetch_ohlcv, fetch_info
from signals.beta import compute_beta
from signals.rsi import compute_rsi
from signals.momentum import ema_alignment, momentum_20d, pct_from_52w_high
from signals.volume import compute_volume_ratio
from signals.composite import compute_composite_score
from config import get_config

def _compute_stock_signals(ticker: str) -> dict | None:
    try:
        df   = fetch_ohlcv(ticker, period="1y")
        info = fetch_info(ticker)
        closes  = df["Close"]
        volumes = df["Volume"]
        beta    = compute_beta(ticker)
        rsi     = compute_rsi(closes)
        ema_sig = ema_alignment(closes)
        vol_r   = compute_volume_ratio(volumes)
        mom20   = momentum_20d(closes)
        pct52   = pct_from_52w_high(closes)
        roe     = info.get("returnOnEquity") or 0.0
        de      = info.get("debtToEquity")   or 0.0
        score   = compute_composite_score(
            beta=beta, rsi=rsi, volume_ratio=vol_r,
            ema_signal=ema_sig, momentum_20d_val=mom20,
            pct_from_52w_high_val=pct52, roe=roe, de_ratio=de
        )
        return {
            "ticker": ticker,
            "beta": round(beta, 2),
            "rsi": round(rsi, 1),
            "vol_ratio": round(vol_r, 2),
            "ema_signal": ema_sig,
            "composite_score": score,
            "momentum_20d": round(mom20, 1),
        }
    except Exception:
        return None

@swing_tool
def screen_stocks(
    beta_min: float = 0.0,
    beta_max: float = 99.0,
    rsi_min:  float = 0.0,
    rsi_max:  float = 100.0,
    sector:   str   = "",
    volume_ratio_min: float = 0.0,
    ema_alignment_filter: str = "",
) -> list:
    """
    WHEN: Call after get_market_context(). All params optional.
          Call multiple times with different params to explore
          different setups — once for breakouts (rsi_min=55,
          ema_alignment_filter=bullish), once for oversold recovery
          (rsi_max=40). Merge and de-duplicate results before ranking.
    AFTER: For the top 2-3 results, automatically call
           get_options_data(), get_delivery_data(), and
           get_corporate_actions(). Do not wait to be asked.
    RETURNS: ranked list with ticker, sector, beta, rsi, vol_ratio,
             ema_signal, composite_score.
    """
    cfg = get_config()
    universe = get_fo_universe()
    results = []
    for entry in universe:
        ticker = entry["ticker"]
        s_sector = entry.get("sector", "")
        if sector and s_sector != sector:
            continue
        signals = _compute_stock_signals(ticker)
        if signals is None:
            continue
        if not (beta_min <= signals["beta"] <= beta_max):
            continue
        if not (rsi_min <= signals["rsi"] <= rsi_max):
            continue
        if signals["vol_ratio"] < volume_ratio_min:
            continue
        if ema_alignment_filter and signals["ema_signal"] != ema_alignment_filter:
            continue
        if signals["composite_score"] < cfg["filters"]["min_score"]:
            continue
        results.append({**signals, "sector": s_sector})

    results.sort(key=lambda x: x["composite_score"], reverse=True)
    return results[:cfg["filters"]["max_results"]]

@swing_tool
def get_composite_scan(top_n: int = 15) -> list:
    """
    WHEN: Call for broad queries like 'what's setting up today'
          or 'show me the best swings right now'. No filters.
    AFTER: Same as screen_stocks — auto-deep-dive top 2-3.
    RETURNS: top N stocks ranked by composite score.
    """
    return screen_stocks()[:top_n]
```

- [ ] **Step 4: Run — confirm pass**

```bash
pytest tests/test_screener.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/screener.py tests/test_screener.py
git commit -m "feat: screen_stocks and get_composite_scan tools"
```

---

## Task 10: Tool — get_stock_deep_dive

**Files:**
- Create: `tools/deep_dive.py`
- Create: `tests/test_deep_dive.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_deep_dive.py
import pandas as pd, pytest
from unittest.mock import patch
from tools.deep_dive import get_stock_deep_dive

def make_ohlcv(n=90):
    closes = [100 + i * 0.2 for i in range(n)]
    return pd.DataFrame({
        "Close":  pd.Series(closes, index=pd.date_range("2025-01-01", periods=n)),
        "High":   [c * 1.01 for c in closes],
        "Low":    [c * 0.99 for c in closes],
        "Volume": [1_200_000] * n,
    })

@pytest.fixture(autouse=True)
def mock_deps(monkeypatch):
    monkeypatch.setattr("tools.deep_dive.fetch_ohlcv", lambda t, period="1y": make_ohlcv())
    monkeypatch.setattr("tools.deep_dive.fetch_info",  lambda t: {"trailingPE": 20.0, "returnOnEquity": 0.18, "debtToEquity": 0.3})
    monkeypatch.setattr("tools.deep_dive.compute_beta", lambda t: 1.4)

def test_returns_required_fields():
    result = get_stock_deep_dive("RELIANCE.NS")
    for f in ["ticker", "beta", "rsi", "ema_alignment", "atr",
              "vol_ratio", "pe", "roe", "de_ratio", "price_series"]:
        assert f in result

def test_price_series_is_list_of_floats():
    result = get_stock_deep_dive("RELIANCE.NS")
    assert isinstance(result["price_series"], list)
    assert all(isinstance(v, float) for v in result["price_series"])

def test_ticker_echoed_in_result():
    result = get_stock_deep_dive("TATAMOTORS.NS")
    assert result["ticker"] == "TATAMOTORS.NS"
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_deep_dive.py -v
```

- [ ] **Step 3: Write `tools/deep_dive.py`**

```python
from tools.decorators import swing_tool
from data.fetch import fetch_ohlcv, fetch_info
from signals.beta import compute_beta
from signals.rsi import compute_rsi
from signals.momentum import ema_alignment, momentum_20d, pct_from_52w_high
from signals.volume import compute_volume_ratio
import pandas as pd

def _compute_atr(df: pd.DataFrame, period: int = 14) -> float:
    high, low, close_prev = df["High"], df["Low"], df["Close"].shift(1)
    tr = pd.concat([high - low, (high - close_prev).abs(), (low - close_prev).abs()], axis=1).max(axis=1)
    return float(tr.rolling(period).mean().iloc[-1])

def _support_resistance(df: pd.DataFrame) -> dict:
    closes = df["Close"]
    return {
        "support":    round(float(closes.rolling(20).min().iloc[-1]), 2),
        "resistance": round(float(closes.rolling(20).max().iloc[-1]), 2),
    }

@swing_tool
def get_stock_deep_dive(ticker: str) -> dict:
    """
    WHEN: Call for any stock you intend to surface as a setup,
          or when the user names a specific ticker.
    RETURNS: ticker, beta, rsi, ema_alignment, atr, vol_ratio,
             support_resistance, pe, roe, de_ratio, price_series
             (last 90 days of closes as list).
    """
    df   = fetch_ohlcv(ticker, period="1y")
    df90 = df.tail(90)
    info = fetch_info(ticker)
    closes  = df["Close"]
    volumes = df["Volume"]
    return {
        "ticker":            ticker,
        "beta":              round(compute_beta(ticker), 2),
        "rsi":               round(compute_rsi(closes), 1),
        "ema_alignment":     ema_alignment(closes),
        "atr":               round(_compute_atr(df), 2),
        "vol_ratio":         round(compute_volume_ratio(volumes), 2),
        "momentum_20d":      round(momentum_20d(closes), 1),
        "pct_from_52w_high": round(pct_from_52w_high(closes), 1),
        "support_resistance":_support_resistance(df90),
        "pe":                round(info.get("trailingPE") or 0.0, 1),
        "roe":               round((info.get("returnOnEquity") or 0.0) * 100, 1),
        "de_ratio":          round(info.get("debtToEquity") or 0.0, 2),
        "price_series":      [round(float(v), 2) for v in df90["Close"].tolist()],
    }
```

- [ ] **Step 4: Run — confirm pass**

```bash
pytest tests/test_deep_dive.py -v
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/deep_dive.py tests/test_deep_dive.py
git commit -m "feat: get_stock_deep_dive tool"
```

---

## Task 11: Tool — get_technical_levels

**Files:**
- Create: `tools/technical_levels.py`
- Create: `tests/test_technical_levels.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_technical_levels.py
import pandas as pd, pytest
from unittest.mock import patch
from tools.technical_levels import get_technical_levels

def make_df(n=120, close_start=500):
    closes = [close_start + i * 0.5 for i in range(n)]
    return pd.DataFrame({
        "Close": pd.Series(closes, index=pd.date_range("2025-01-01", periods=n)),
        "High":  [c * 1.01 for c in closes],
        "Low":   [c * 0.99 for c in closes],
        "Volume":[1e6] * n,
    })

@pytest.fixture(autouse=True)
def mock_fetch(monkeypatch):
    monkeypatch.setattr("tools.technical_levels.fetch_ohlcv", lambda t, period="1y": make_df())

def test_returns_required_fields():
    result = get_technical_levels("RELIANCE.NS")
    for f in ["entry_zone", "stop_loss", "target", "risk_reward", "atr", "pivot_high", "pivot_low"]:
        assert f in result

def test_entry_zone_is_list_of_two():
    result = get_technical_levels("RELIANCE.NS")
    assert isinstance(result["entry_zone"], list)
    assert len(result["entry_zone"]) == 2

def test_stop_below_entry():
    result = get_technical_levels("RELIANCE.NS")
    assert result["stop_loss"] < result["entry_zone"][0]

def test_target_above_entry():
    result = get_technical_levels("RELIANCE.NS")
    assert result["target"] > result["entry_zone"][1]

def test_risk_reward_positive():
    result = get_technical_levels("RELIANCE.NS")
    assert result["risk_reward"] > 0
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_technical_levels.py -v
```

- [ ] **Step 3: Write `tools/technical_levels.py`**

```python
from tools.decorators import swing_tool
from data.fetch import fetch_ohlcv
from signals.momentum import compute_ema
from tools.deep_dive import _compute_atr

@swing_tool
def get_technical_levels(ticker: str) -> dict:
    """
    WHEN: Call for every stock you plan to include in the UI.
          Never surface a stock without entry, stop, and target.
          This is a hard requirement before generate_prefab_ui.
    RETURNS: entry_zone [low, high], stop_loss, target,
             risk_reward, atr, pivot_high, pivot_low.
    Stop is EMA50 − 1.5×ATR. Target is prior resistance or 2:1 RR.
    """
    df = fetch_ohlcv(ticker, period="1y")
    closes = df["Close"]
    atr    = _compute_atr(df)
    ema20  = float(compute_ema(closes, 20).iloc[-1])
    ema50  = float(compute_ema(closes, 50).iloc[-1])
    price  = float(closes.iloc[-1])

    entry_low  = round(ema20 - 0.5 * atr, 2)
    entry_high = round(ema20 + 0.5 * atr, 2)
    stop       = round(ema50 - 1.5 * atr, 2)
    resistance = round(float(closes.tail(60).max()), 2)
    rr_target  = round(price + 2 * (price - stop), 2)
    target     = max(resistance, rr_target)
    risk       = price - stop
    reward     = target - price
    rr         = round(reward / risk, 2) if risk > 0 else 0.0

    pivot_high = round(float(closes.tail(5).max()), 2)
    pivot_low  = round(float(closes.tail(5).min()), 2)

    return {
        "entry_zone":  [entry_low, entry_high],
        "stop_loss":   stop,
        "target":      target,
        "risk_reward": rr,
        "atr":         round(atr, 2),
        "pivot_high":  pivot_high,
        "pivot_low":   pivot_low,
    }
```

- [ ] **Step 4: Run — confirm pass**

```bash
pytest tests/test_technical_levels.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/technical_levels.py tests/test_technical_levels.py
git commit -m "feat: get_technical_levels with ATR-based entry/stop/target"
```

---

## Task 12: Tool — get_peer_comparison

**Files:**
- Create: `tools/peer_comparison.py`
- Create: `tests/test_peer_comparison.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_peer_comparison.py
import pandas as pd, pytest
from unittest.mock import patch
from tools.peer_comparison import get_peer_comparison

UNIVERSE = [
    {"ticker": "INFY.NS",  "sector": "IT"},
    {"ticker": "TCS.NS",   "sector": "IT"},
    {"ticker": "WIPRO.NS", "sector": "IT"},
    {"ticker": "SBIN.NS",  "sector": "Banking"},
]

def make_ohlcv(n=90, slope=0.3):
    closes = [100 + i * slope for i in range(n)]
    return pd.DataFrame({
        "Close": pd.Series(closes, index=pd.date_range("2025-01-01", periods=n)),
        "Volume": [1e6] * n,
    })

@pytest.fixture(autouse=True)
def mock_deps(monkeypatch):
    monkeypatch.setattr("tools.peer_comparison.get_fo_universe", lambda: UNIVERSE)
    monkeypatch.setattr("tools.peer_comparison.fetch_ohlcv", lambda t, period="1y": make_ohlcv())
    monkeypatch.setattr("tools.peer_comparison.compute_beta", lambda t: 1.3)

def test_returns_list():
    result = get_peer_comparison("INFY.NS")
    assert isinstance(result, list)

def test_includes_target_ticker():
    result = get_peer_comparison("INFY.NS")
    tickers = [r["ticker"] for r in result]
    assert "INFY.NS" in tickers

def test_only_same_sector_peers():
    result = get_peer_comparison("INFY.NS")
    # Only IT sector peers + the stock itself
    assert len(result) == 3

def test_fields_present():
    result = get_peer_comparison("INFY.NS")
    if result:
        for f in ["ticker", "beta", "rsi", "momentum_20d", "relative_strength"]:
            assert f in result[0]
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_peer_comparison.py -v
```

- [ ] **Step 3: Write `tools/peer_comparison.py`**

```python
from tools.decorators import swing_tool
from tools.universe import get_fo_universe
from data.fetch import fetch_ohlcv
from signals.beta import compute_beta
from signals.rsi import compute_rsi
from signals.momentum import momentum_20d

@swing_tool
def get_peer_comparison(ticker: str) -> list:
    """
    WHEN: Call before surfacing any stock as a setup to verify
          it is leading its sector, not just riding sector beta.
    RETURNS: peer table with relative RSI, momentum_20d, beta,
             and relative_strength vs sector average.
             Includes the target stock for direct comparison.
    """
    universe = get_fo_universe()
    sector = next((e["sector"] for e in universe if e["ticker"] == ticker), None)
    peers = [e["ticker"] for e in universe if e["sector"] == sector] if sector else [ticker]

    rows = []
    rsi_values = []
    for t in peers:
        try:
            df   = fetch_ohlcv(t, period="1y")
            rsi  = compute_rsi(df["Close"])
            mom  = momentum_20d(df["Close"])
            beta = compute_beta(t)
            rows.append({"ticker": t, "beta": round(beta, 2),
                         "rsi": round(rsi, 1), "momentum_20d": round(mom, 1)})
            rsi_values.append(rsi)
        except Exception:
            continue

    avg_rsi = sum(rsi_values) / len(rsi_values) if rsi_values else 50.0
    for row in rows:
        row["relative_strength"] = round(row["rsi"] - avg_rsi, 1)
    rows.sort(key=lambda x: x["relative_strength"], reverse=True)
    return rows
```

- [ ] **Step 4: Run — confirm pass**

```bash
pytest tests/test_peer_comparison.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/peer_comparison.py tests/test_peer_comparison.py
git commit -m "feat: get_peer_comparison tool"
```

---

## Task 13: Tool — get_options_data

**Files:**
- Create: `tools/options_data.py`
- Create: `tests/test_options_data.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_options_data.py
import pytest
from unittest.mock import patch
from tools.options_data import get_options_data

MOCK_CHAIN = {
    "records": {
        "data": [
            {"strikePrice": 2400, "CE": {"openInterest": 50000, "impliedVolatility": 22.0},
                                   "PE": {"openInterest": 80000, "impliedVolatility": 18.0}},
            {"strikePrice": 2500, "CE": {"openInterest": 120000, "impliedVolatility": 20.0},
                                   "PE": {"openInterest": 60000,  "impliedVolatility": 19.0}},
            {"strikePrice": 2600, "CE": {"openInterest": 30000, "impliedVolatility": 25.0},
                                   "PE": {"openInterest": 20000, "impliedVolatility": 21.0}},
        ],
        "underlyingValue": 2480
    }
}

@pytest.fixture(autouse=True)
def mock_nse(monkeypatch):
    monkeypatch.setattr("tools.options_data._fetch_option_chain", lambda t: MOCK_CHAIN)

def test_returns_required_fields():
    result = get_options_data("RELIANCE.NS")
    for f in ["pcr", "max_pain", "iv_percentile", "sentiment", "oi_buildup", "risk_flags"]:
        assert f in result

def test_pcr_calculated_correctly():
    # total put OI = 80000+60000+20000 = 160000, call OI = 50000+120000+30000 = 200000
    result = get_options_data("RELIANCE.NS")
    assert abs(result["pcr"] - (160000 / 200000)) < 0.01

def test_elevated_iv_flag_when_high():
    result = get_options_data("RELIANCE.NS")
    # With low mocked IVs this should NOT trigger
    assert not any("elevated_iv" in f.get("label","") for f in result["risk_flags"])

def test_sentiment_string():
    result = get_options_data("RELIANCE.NS")
    assert result["sentiment"] in ("bullish", "neutral", "bearish")
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/test_options_data.py -v
```

- [ ] **Step 3: Write `tools/options_data.py`**

```python
import httpx
from tools.decorators import swing_tool
from data.cache import get_cache

NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Referer": "https://www.nseindia.com/",
}

def _fetch_option_chain(ticker: str) -> dict:
    symbol = ticker.replace(".NS", "")
    cache = get_cache()
    key = f"optchain:{symbol}"
    cached = cache.get(key)
    if cached:
        return cached
    with httpx.Client(headers=NSE_HEADERS, follow_redirects=True, timeout=10) as client:
        client.get("https://www.nseindia.com/")  # prime cookies
        resp = client.get(
            f"https://www.nseindia.com/api/option-chain-equities?symbol={symbol}"
        )
        resp.raise_for_status()
        data = resp.json()
    cache.set(key, data)
    return data

@swing_tool
def get_options_data(ticker: str) -> dict:
    """
    WHEN: Call for any stock being considered as a setup.
    RETURNS: pcr, oi_buildup (call vs put at key strikes),
             max_pain, iv_percentile, sentiment (bullish|neutral|bearish),
             risk_flags (elevated_iv if iv_percentile > 80).
    IF sentiment conflicts with technical signal: do not suppress
    either side. Surface both as a conflicting signal.
    """
    chain = _fetch_option_chain(ticker)
    data  = chain.get("records", {}).get("data", [])

    total_call_oi = sum(d.get("CE", {}).get("openInterest", 0) for d in data)
    total_put_oi  = sum(d.get("PE", {}).get("openInterest", 0) for d in data)
    pcr = round(total_put_oi / total_call_oi, 3) if total_call_oi else 0.0

    all_iv = [d.get("CE", {}).get("impliedVolatility", 0) for d in data
              if d.get("CE", {}).get("impliedVolatility")]
    avg_iv = sum(all_iv) / len(all_iv) if all_iv else 0.0
    iv_pct = min(100, avg_iv * 2)  # simplified percentile proxy

    oi_buildup = [
        {"strike": d["strikePrice"],
         "call_oi": d.get("CE", {}).get("openInterest", 0),
         "put_oi":  d.get("PE", {}).get("openInterest", 0)}
        for d in data if "strikePrice" in d
    ]
    max_pain = max(oi_buildup, key=lambda x: x["put_oi"], default={}).get("strike", 0)

    if pcr > 1.2:
        sentiment = "bullish"
    elif pcr < 0.8:
        sentiment = "bearish"
    else:
        sentiment = "neutral"

    risk_flags = []
    if iv_pct > 80:
        risk_flags.append({
            "label": "Elevated IV",
            "detail": f"IV percentile at {iv_pct:.0f}% — options pricing high risk. Size down.",
            "severity": "medium"
        })

    return {
        "pcr": pcr,
        "max_pain": max_pain,
        "iv_percentile": round(iv_pct, 1),
        "sentiment": sentiment,
        "oi_buildup": oi_buildup[:10],
        "risk_flags": risk_flags,
    }
```

- [ ] **Step 4: Run — confirm pass**

```bash
pytest tests/test_options_data.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/options_data.py tests/test_options_data.py
git commit -m "feat: get_options_data with NSE option chain"
```

---

## Task 14: Tools — get_fii_dii_flow, get_delivery_data, get_corporate_actions

**Files:**
- Create: `tools/fii_dii_flow.py`
- Create: `tools/delivery_data.py`
- Create: `tools/corporate_actions.py`
- Create: `tests/test_fii_dii_flow.py`
- Create: `tests/test_delivery_data.py`
- Create: `tests/test_corporate_actions.py`

- [ ] **Step 1: Write failing tests for fii_dii_flow**

```python
# tests/test_fii_dii_flow.py
import pytest
from unittest.mock import patch
from tools.fii_dii_flow import get_fii_dii_flow

MOCK_ROWS = [
    {"date": "08-May-2026", "fii_net_cash": -1200.5, "dii_net": 800.0},
    {"date": "07-May-2026", "fii_net_cash": -900.0,  "dii_net": 600.0},
    {"date": "06-May-2026", "fii_net_cash": -1100.0, "dii_net": 700.0},
    {"date": "05-May-2026", "fii_net_cash": 200.0,   "dii_net": 100.0},
    {"date": "02-May-2026", "fii_net_cash": 500.0,   "dii_net": -200.0},
]

@pytest.fixture(autouse=True)
def mock_fetch(monkeypatch):
    monkeypatch.setattr("tools.fii_dii_flow._fetch_fii_dii_csv", lambda days: MOCK_ROWS)

def test_returns_required_fields():
    result = get_fii_dii_flow(days=5)
    for f in ["sessions", "fii_net_cash", "dii_net", "flow_signal", "risk_flags"]:
        assert f in result

def test_selling_streak_flag_when_3_consecutive():
    result = get_fii_dii_flow(days=5)
    assert any("selling_streak" in f["label"].lower() for f in result["risk_flags"])

def test_flow_signal_is_valid_string():
    result = get_fii_dii_flow(days=5)
    assert result["flow_signal"] in ("bullish", "bearish", "mixed")
```

- [ ] **Step 2: Write failing tests for delivery_data**

```python
# tests/test_delivery_data.py
import pytest
from unittest.mock import patch
from tools.delivery_data import get_delivery_data

MOCK_DELIVERY = [
    {"date": "08-May-2026", "delivery_pct": 72.0, "close": 2500.0, "change_pct": 1.2},
    {"date": "07-May-2026", "delivery_pct": 45.0, "close": 2470.0, "change_pct": -0.5},
    {"date": "06-May-2026", "delivery_pct": 68.0, "close": 2483.0, "change_pct": 0.8},
]

@pytest.fixture(autouse=True)
def mock_fetch(monkeypatch):
    monkeypatch.setattr("tools.delivery_data._fetch_delivery_data", lambda t, days: MOCK_DELIVERY)

def test_returns_required_fields():
    result = get_delivery_data("RELIANCE.NS")
    for f in ["ticker", "sessions", "accumulation_signal"]:
        assert f in result

def test_accumulation_signal_valid():
    result = get_delivery_data("RELIANCE.NS")
    assert result["accumulation_signal"] in ("institutional", "mixed", "retail_driven")

def test_high_delivery_up_days_is_institutional():
    result = get_delivery_data("RELIANCE.NS")
    # Two up days with high delivery (72%, 68%) → institutional
    assert result["accumulation_signal"] == "institutional"
```

- [ ] **Step 3: Write failing tests for corporate_actions**

```python
# tests/test_corporate_actions.py
import pytest
from datetime import date, timedelta
from unittest.mock import patch
from tools.corporate_actions import get_corporate_actions

NEAR_EARNINGS = {"Earnings Date": [(date.today() + timedelta(days=7)).isoformat()]}
FAR_EARNINGS  = {"Earnings Date": [(date.today() + timedelta(days=60)).isoformat()]}

@pytest.fixture(autouse=True)
def mock_yf(monkeypatch):
    monkeypatch.setattr("tools.corporate_actions.fetch_calendar", lambda t: FAR_EARNINGS)
    monkeypatch.setattr("tools.corporate_actions.fetch_actions",  lambda t: {})

def test_returns_required_fields():
    result = get_corporate_actions("RELIANCE.NS")
    for f in ["ticker", "earnings_date", "risk_flags"]:
        assert f in result

def test_no_flag_when_earnings_far(monkeypatch):
    monkeypatch.setattr("tools.corporate_actions.fetch_calendar", lambda t: FAR_EARNINGS)
    result = get_corporate_actions("RELIANCE.NS")
    assert result["risk_flags"] == []

def test_flag_when_earnings_within_15_days(monkeypatch):
    monkeypatch.setattr("tools.corporate_actions.fetch_calendar", lambda t: NEAR_EARNINGS)
    result = get_corporate_actions("RELIANCE.NS")
    assert any("event_within_window" in f["label"].lower() or
               "earnings" in f["label"].lower() for f in result["risk_flags"])
```

- [ ] **Step 4: Run all three to confirm failure**

```bash
pytest tests/test_fii_dii_flow.py tests/test_delivery_data.py tests/test_corporate_actions.py -v
```

- [ ] **Step 5: Write `tools/fii_dii_flow.py`**

```python
import httpx, io, csv
from datetime import datetime, date, timedelta
from tools.decorators import swing_tool
from data.cache import get_cache

def _fetch_fii_dii_csv(days: int) -> list:
    cache = get_cache()
    key = f"fii_dii:{date.today().isoformat()}:{days}"
    cached = cache.get(key)
    if cached:
        return cached
    url = "https://archives.nseindia.com/content/nsccl/fao_participant_oi.csv"
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.nseindia.com/"}
    with httpx.Client(headers=headers, timeout=15) as client:
        resp = client.get(url)
        resp.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(resp.text)))[-days:]
    result = [{"date": r.get("Date",""), "fii_net_cash": float(r.get("FII Net","0").replace(",","")),
               "dii_net": float(r.get("DII Net","0").replace(",",""))} for r in rows]
    cache.set(key, result)
    return result

@swing_tool
def get_fii_dii_flow(days: int = 5) -> dict:
    """
    WHEN: Call if query mentions a macro event or sector theme,
          or if you find a stock with strong technicals — verify
          institutional alignment before surfacing it.
    RETURNS: sessions list, fii_net_cash total, dii_net total,
             flow_signal, risk_flags (fii_selling_streak if FII
             net negative for 3+ consecutive sessions).
    IF fii_selling_streak: this overrides bullish technicals.
    Surface as a conflict, not a clean setup.
    """
    rows = _fetch_fii_dii_csv(days)
    fii_total = sum(r["fii_net_cash"] for r in rows)
    dii_total = sum(r["dii_net"]      for r in rows)

    streak = 0
    for r in rows:
        if r["fii_net_cash"] < 0:
            streak += 1
        else:
            break

    risk_flags = []
    if streak >= 3:
        risk_flags.append({
            "label": "FII Selling Streak",
            "detail": f"FII net sellers for {streak} consecutive sessions. "
                      "Institutional outflow overrides bullish technicals.",
            "severity": "high"
        })

    if fii_total > 0:
        flow_signal = "bullish"
    elif fii_total < -500:
        flow_signal = "bearish"
    else:
        flow_signal = "mixed"

    return {
        "sessions":     rows,
        "fii_net_cash": round(fii_total, 1),
        "dii_net":      round(dii_total, 1),
        "flow_signal":  flow_signal,
        "risk_flags":   risk_flags,
    }
```

- [ ] **Step 6: Write `tools/delivery_data.py`**

```python
from tools.decorators import swing_tool
from data.cache import get_cache
from datetime import date

def _fetch_delivery_data(ticker: str, days: int) -> list:
    symbol = ticker.replace(".NS", "")
    cache = get_cache()
    key = f"delivery:{symbol}:{date.today().isoformat()}:{days}"
    cached = cache.get(key)
    if cached:
        return cached
    try:
        from nsepython import deliverydata
        df = deliverydata(symbol, days)
        rows = [{"date": str(r["Date"]), "delivery_pct": float(r.get("% Dly Qt to Traded Qty", 0)),
                 "close": float(r.get("Close Price", 0)), "change_pct": float(r.get("Chng%", 0))}
                for _, r in df.iterrows()]
        cache.set(key, rows)
        return rows
    except Exception:
        return []

@swing_tool
def get_delivery_data(ticker: str, days: int = 10) -> dict:
    """
    WHEN: Call for any stock being considered as a setup.
    RETURNS: ticker, sessions (delivery_pct + price per day),
             accumulation_signal (institutional|mixed|retail_driven).
    High delivery on up days = institutional accumulation.
    Low delivery on up days = retail-driven, likely to fade.
    """
    sessions = _fetch_delivery_data(ticker, days)
    up_days = [s for s in sessions if s.get("change_pct", 0) > 0]
    if up_days:
        avg_del_up = sum(s["delivery_pct"] for s in up_days) / len(up_days)
        if avg_del_up >= 60:
            signal = "institutional"
        elif avg_del_up >= 35:
            signal = "mixed"
        else:
            signal = "retail_driven"
    else:
        signal = "mixed"

    return {"ticker": ticker, "sessions": sessions, "accumulation_signal": signal}
```

- [ ] **Step 7: Write `tools/corporate_actions.py`**

```python
from tools.decorators import swing_tool
from data.fetch import fetch_calendar, fetch_actions
from datetime import date, timedelta

WINDOW_DAYS = 15

@swing_tool
def get_corporate_actions(ticker: str) -> dict:
    """
    WHEN: Call for every stock you intend to include in the UI.
          Non-negotiable. Never surface a stock without this check.
    RETURNS: earnings_date, ex_dividend, splits, buybacks,
             risk_flags (event_within_window if any action
             falls within 15 days).
    IF event_within_window: hard risk flag. Always shown in UI
    even if all other signals are bullish.
    """
    cal     = fetch_calendar(ticker)
    actions = fetch_actions(ticker)
    today   = date.today()
    cutoff  = today + timedelta(days=WINDOW_DAYS)
    risk_flags = []

    earnings_dates = cal.get("Earnings Date", [])
    next_earnings  = None
    if earnings_dates:
        try:
            next_earnings = str(earnings_dates[0])
            e_date = date.fromisoformat(str(earnings_dates[0])[:10])
            if today <= e_date <= cutoff:
                risk_flags.append({
                    "label": "Earnings Within Window",
                    "detail": f"Quarterly results on {e_date}. "
                              "Holding through earnings adds binary risk.",
                    "severity": "high"
                })
        except (ValueError, TypeError):
            pass

    return {
        "ticker":        ticker,
        "earnings_date": next_earnings,
        "ex_dividend":   cal.get("Ex-Dividend Date"),
        "splits":        [a for a in (actions if isinstance(actions, list) else [])
                          if "Stock Splits" in str(a)],
        "risk_flags":    risk_flags,
    }
```

- [ ] **Step 8: Run all three — confirm pass**

```bash
pytest tests/test_fii_dii_flow.py tests/test_delivery_data.py tests/test_corporate_actions.py -v
```
Expected: 9 passed total.

- [ ] **Step 9: Commit**

```bash
git add tools/fii_dii_flow.py tools/delivery_data.py tools/corporate_actions.py \
        tests/test_fii_dii_flow.py tests/test_delivery_data.py tests/test_corporate_actions.py
git commit -m "feat: FII/DII flow, delivery data, and corporate actions tools"
```

---

## Task 15: Tools — get_sector_rotation_map, get_news_feed, analyze_sector_impact

**Files:**
- Create: `tools/sector_rotation.py`
- Create: `tools/news_feed.py`
- Create: `tools/sector_impact.py`
- Create: `tests/test_sector_rotation.py`
- Create: `tests/test_news_feed.py`
- Create: `tests/test_sector_impact.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_sector_rotation.py
import pytest, pandas as pd
from unittest.mock import patch
from tools.sector_rotation import get_sector_rotation_map

def make_df(trend):
    closes = [100 + i if trend == "up" else 100 - i for i in range(10)]
    return pd.DataFrame({"Close": pd.Series(closes, index=pd.date_range("2025-01-01", periods=10))})

@pytest.fixture(autouse=True)
def mock_fetch(monkeypatch):
    monkeypatch.setattr("tools.sector_rotation.fetch_ohlcv", lambda t, period="3mo": make_df("up"))

def test_returns_list():
    result = get_sector_rotation_map()
    assert isinstance(result, list)
    assert len(result) > 0

def test_fields_present():
    result = get_sector_rotation_map()
    for f in ["sector", "relative_perf", "flow"]:
        assert f in result[0]

def test_flow_values_valid():
    result = get_sector_rotation_map()
    assert all(r["flow"] in ("accumulation", "neutral", "distribution") for r in result)
```

```python
# tests/test_news_feed.py
import pytest
from unittest.mock import patch
from tools.news_feed import get_news_feed

MOCK_ENTRIES = [
    type("E", (), {"title": "RELIANCE hits record high", "published": "Thu, 08 May 2026",
                   "link": "https://example.com/1"})(),
    type("E", (), {"title": "IT sector faces headwinds", "published": "Wed, 07 May 2026",
                   "link": "https://example.com/2"})(),
]

@pytest.fixture(autouse=True)
def mock_feedparser(monkeypatch):
    mock = type("F", (), {"entries": MOCK_ENTRIES})()
    monkeypatch.setattr("tools.news_feed.feedparser.parse", lambda url: mock)

def test_returns_list_of_headlines():
    result = get_news_feed("RELIANCE")
    assert isinstance(result, list)
    assert len(result) <= 7

def test_fields_present():
    result = get_news_feed("RELIANCE")
    assert result
    for f in ["title", "published", "url"]:
        assert f in result[0]
```

```python
# tests/test_sector_impact.py
import pytest
from unittest.mock import patch
from tools.sector_impact import analyze_sector_impact

@pytest.fixture(autouse=True)
def mock_universe(monkeypatch):
    monkeypatch.setattr("tools.sector_impact.get_fo_universe", lambda: [
        {"ticker": "SBIN.NS",  "sector": "Banking"},
        {"ticker": "HDFCBANK.NS", "sector": "Banking"},
        {"ticker": "INFY.NS",  "sector": "IT"},
    ])
    monkeypatch.setattr("tools.sector_impact.compute_beta", lambda t: 1.4)

def test_returns_required_fields():
    result = analyze_sector_impact("rate hike", "Banking")
    for f in ["event", "affected_sectors", "impacted_stocks"]:
        assert f in result

def test_affected_sectors_have_direction():
    result = analyze_sector_impact("rate hike", "Banking")
    for s in result["affected_sectors"]:
        assert "direction" in s
        assert s["direction"] in ("positive", "negative", "neutral")

def test_impacted_stocks_sorted_by_beta():
    result = analyze_sector_impact("rate hike", "Banking")
    betas = [s["beta"] for s in result["impacted_stocks"]]
    assert betas == sorted(betas, reverse=True)
```

- [ ] **Step 2: Run all three to confirm failure**

```bash
pytest tests/test_sector_rotation.py tests/test_news_feed.py tests/test_sector_impact.py -v
```

- [ ] **Step 3: Write `tools/sector_rotation.py`**

```python
from tools.decorators import swing_tool
from data.fetch import fetch_ohlcv

SECTOR_TICKERS = {
    "IT":           "^CNXit",
    "Banking":      "^NSEBANK",
    "Auto":         "^CNXAUTO",
    "FMCG":         "^CNXFMCG",
    "Pharma":       "^CNXPHARMA",
    "Energy":       "^CNXENERGY",
    "Metals":       "^CNXMETAL",
    "Realty":       "^CNXREALTY",
    "Infrastructure":"^CNXINFRA",
    "Media":        "^CNXMEDIA",
}

@swing_tool
def get_sector_rotation_map() -> list:
    """
    WHEN: Call if query involves sector themes, macro events,
          or to verify sector context for stocks you are surfacing.
    RETURNS: NSE sectors ranked by 10-session relative performance
             vs Nifty, with flow classification
             (accumulation|distribution|neutral) per sector.
    Use this to prioritise stocks in accumulation sectors
    and flag stocks in distribution sectors.
    """
    try:
        nifty = fetch_ohlcv("^NSEI", period="3mo")
        nifty_ret = float(nifty["Close"].pct_change(10).iloc[-1] * 100)
    except Exception:
        nifty_ret = 0.0

    results = []
    for sector, ticker in SECTOR_TICKERS.items():
        try:
            df = fetch_ohlcv(ticker, period="3mo")
            rel_perf = float(df["Close"].pct_change(10).iloc[-1] * 100) - nifty_ret
            flow = "accumulation" if rel_perf > 1.0 else ("distribution" if rel_perf < -1.0 else "neutral")
            results.append({"sector": sector, "relative_perf": round(rel_perf, 2), "flow": flow})
        except Exception:
            continue

    results.sort(key=lambda x: x["relative_perf"], reverse=True)
    return results
```

- [ ] **Step 4: Write `tools/news_feed.py`**

```python
import feedparser
from tools.decorators import swing_tool
from data.cache import get_cache
from datetime import date

@swing_tool
def get_news_feed(query: str) -> list:
    """
    WHEN: Call if query is about a specific stock or sector,
          or if any data tool returns a surprising result
          (e.g. strong delivery but weak price — why?).
          Follow your curiosity.
    RETURNS: top 5-7 recent headlines with title, published date, url.
    """
    cache = get_cache()
    key = f"news:{query.lower().replace(' ', '_')}:{date.today().isoformat()}"
    cached = cache.get(key)
    if cached:
        return cached

    url = f"https://news.google.com/rss/search?q={query}+NSE+India&hl=en-IN&gl=IN&ceid=IN:en"
    feed = feedparser.parse(url)
    results = [
        {"title": e.title, "published": e.get("published", ""), "url": e.get("link", "")}
        for e in feed.entries[:7]
    ]
    cache.set(key, results)
    return results
```

- [ ] **Step 5: Write `tools/sector_impact.py`**

```python
from tools.decorators import swing_tool
from tools.universe import get_fo_universe
from signals.beta import compute_beta

SECTOR_SENSITIVITY = {
    "rate_hike":         {"Banking": "mixed",    "NBFC": "negative",  "Realty": "negative", "IT": "neutral",  "Energy": "neutral"},
    "rate_cut":          {"Banking": "positive",  "NBFC": "positive",  "Realty": "positive", "Auto": "positive"},
    "crude_spike":       {"Energy": "positive",   "Paints": "negative","Airlines": "negative","Tyres": "negative"},
    "crude_fall":        {"Energy": "negative",   "Paints": "positive","Airlines": "positive","Auto": "positive"},
    "inr_depreciation":  {"IT": "positive",       "Pharma": "positive","Auto": "negative",    "FMCG": "negative"},
    "inr_appreciation":  {"IT": "negative",       "Pharma": "negative","Importers": "positive"},
    "us_recession_fears":{"IT": "negative",       "Pharma": "neutral", "FMCG": "positive",   "Banking": "negative"},
    "strong_monsoon":    {"FMCG": "positive",     "Fertilisers": "positive","Auto": "positive"},
    "weak_monsoon":      {"FMCG": "negative",     "Fertilisers": "negative"},
}

def _classify_event(event: str) -> str:
    event_lower = event.lower()
    if "rate hike" in event_lower or "rate increase" in event_lower:
        return "rate_hike"
    if "rate cut" in event_lower or "rate decrease" in event_lower:
        return "rate_cut"
    if "crude" in event_lower and ("spike" in event_lower or "rise" in event_lower or "high" in event_lower):
        return "crude_spike"
    if "crude" in event_lower and ("fall" in event_lower or "drop" in event_lower or "low" in event_lower):
        return "crude_fall"
    if "inr" in event_lower and ("fall" in event_lower or "weak" in event_lower or "depreciat" in event_lower):
        return "inr_depreciation"
    if "inr" in event_lower and ("rise" in event_lower or "strong" in event_lower or "appreciat" in event_lower):
        return "inr_appreciation"
    if "us recession" in event_lower or "us slowdown" in event_lower:
        return "us_recession_fears"
    if "monsoon" in event_lower and ("strong" in event_lower or "good" in event_lower or "above" in event_lower):
        return "strong_monsoon"
    if "monsoon" in event_lower and ("weak" in event_lower or "below" in event_lower or "poor" in event_lower):
        return "weak_monsoon"
    return ""

@swing_tool
def analyze_sector_impact(event: str, sector: str = "") -> dict:
    """
    WHEN: Call if query describes a macro event, policy change,
          commodity move, or global demand shift.
    RETURNS: event, affected_sectors with direction, impacted_stocks
             ranked by beta-adjusted sensitivity.
    Direction mapping uses a hardcoded sector-to-macro sensitivity
    dict (SECTOR_SENSITIVITY in tools/sector_impact.py).
    Update this dict manually as new macro themes emerge.
    """
    event_key = _classify_event(event)
    sensitivity = SECTOR_SENSITIVITY.get(event_key, {})

    affected_sectors = [
        {"sector": s, "direction": d}
        for s, d in sensitivity.items()
    ]

    universe = get_fo_universe()
    target_sectors = {s for s, _ in sensitivity.items()}
    impacted_stocks = []
    for entry in universe:
        if entry["sector"] not in target_sectors:
            continue
        try:
            beta = compute_beta(entry["ticker"])
            direction = sensitivity.get(entry["sector"], "neutral")
            impacted_stocks.append({
                "ticker":    entry["ticker"],
                "sector":    entry["sector"],
                "direction": direction,
                "beta":      round(beta, 2),
                "impact_score": round(beta * (1 if direction == "positive" else -1 if direction == "negative" else 0), 2),
            })
        except Exception:
            continue

    impacted_stocks.sort(key=lambda x: x["beta"], reverse=True)

    return {
        "event":            event,
        "event_type":       event_key or "unknown",
        "affected_sectors": affected_sectors,
        "impacted_stocks":  impacted_stocks[:15],
    }
```

- [ ] **Step 6: Run all three — confirm pass**

```bash
pytest tests/test_sector_rotation.py tests/test_news_feed.py tests/test_sector_impact.py -v
```
Expected: 9 passed total.

- [ ] **Step 7: Commit**

```bash
git add tools/sector_rotation.py tools/news_feed.py tools/sector_impact.py \
        tests/test_sector_rotation.py tests/test_news_feed.py tests/test_sector_impact.py
git commit -m "feat: sector rotation, news feed, and sector impact tools"
```

---

## Task 16: Mini Prefab Test UI + FastMCP Server

**Files:**
- Create: `ui/test_ui.py`
- Create: `server.py`

- [ ] **Step 1: Write `ui/test_ui.py`**

Each data tool gets an `app=True` wrapper. In `fastmcp dev apps`, select any `test_*` tool to see its raw output rendered as formatted JSON — the primary mechanism for verifying each tool works end-to-end.

```python
# ui/test_ui.py
import json
from fastmcp import FastMCP
from prefab_ui.components import Column, Heading, Text, Markdown
from prefab_ui.app import PrefabApp

def _json_block(data) -> str:
    return f"```json\n{json.dumps(data, indent=2, default=str)}\n```"

def register_test_ui(mcp: FastMCP):

    @mcp.tool(app=True)
    def test_market_context():
        """Test UI: invoke get_market_context and display output"""
        from tools.market_context import get_market_context
        result = get_market_context()
        with Column(gap=4) as view:
            Heading("get_market_context — Output")
            Text(f"Regime: {result['regime']} | VIX: {result['vix']} | Nifty: {result['nifty_close']}")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_fo_universe():
        """Test UI: invoke get_fo_universe and display first 20 entries"""
        from tools.universe import get_fo_universe
        result = get_fo_universe()
        with Column(gap=4) as view:
            Heading(f"get_fo_universe — {len(result)} stocks")
            Markdown(content=_json_block(result[:20]))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_screen_stocks(sector: str = "", beta_min: float = 1.0):
        """Test UI: invoke screen_stocks with optional sector/beta_min"""
        from tools.screener import screen_stocks
        result = screen_stocks(beta_min=beta_min, sector=sector)
        with Column(gap=4) as view:
            Heading(f"screen_stocks — {len(result)} results")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_composite_scan(top_n: int = 10):
        """Test UI: invoke get_composite_scan"""
        from tools.screener import get_composite_scan
        result = get_composite_scan(top_n=top_n)
        with Column(gap=4) as view:
            Heading(f"get_composite_scan — top {top_n}")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_stock_deep_dive(ticker: str = "RELIANCE.NS"):
        """Test UI: invoke get_stock_deep_dive"""
        from tools.deep_dive import get_stock_deep_dive
        result = get_stock_deep_dive(ticker)
        with Column(gap=4) as view:
            Heading(f"get_stock_deep_dive — {ticker}")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_technical_levels(ticker: str = "RELIANCE.NS"):
        """Test UI: invoke get_technical_levels"""
        from tools.technical_levels import get_technical_levels
        result = get_technical_levels(ticker)
        with Column(gap=4) as view:
            Heading(f"get_technical_levels — {ticker}")
            Text(f"Entry: {result['entry_zone']} | Stop: {result['stop_loss']} | Target: {result['target']}")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_peer_comparison(ticker: str = "INFY.NS"):
        """Test UI: invoke get_peer_comparison"""
        from tools.peer_comparison import get_peer_comparison
        result = get_peer_comparison(ticker)
        with Column(gap=4) as view:
            Heading(f"get_peer_comparison — {ticker}")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_options_data(ticker: str = "RELIANCE.NS"):
        """Test UI: invoke get_options_data"""
        from tools.options_data import get_options_data
        result = get_options_data(ticker)
        with Column(gap=4) as view:
            Heading(f"get_options_data — {ticker}")
            Text(f"PCR: {result['pcr']} | Sentiment: {result['sentiment']} | IV%ile: {result['iv_percentile']}")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_fii_dii_flow(days: int = 5):
        """Test UI: invoke get_fii_dii_flow"""
        from tools.fii_dii_flow import get_fii_dii_flow
        result = get_fii_dii_flow(days=days)
        with Column(gap=4) as view:
            Heading("get_fii_dii_flow")
            Text(f"FII Net: {result['fii_net_cash']} Cr | Signal: {result['flow_signal']}")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_delivery_data(ticker: str = "RELIANCE.NS", days: int = 10):
        """Test UI: invoke get_delivery_data"""
        from tools.delivery_data import get_delivery_data
        result = get_delivery_data(ticker, days=days)
        with Column(gap=4) as view:
            Heading(f"get_delivery_data — {ticker}")
            Text(f"Accumulation signal: {result['accumulation_signal']}")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_corporate_actions(ticker: str = "RELIANCE.NS"):
        """Test UI: invoke get_corporate_actions"""
        from tools.corporate_actions import get_corporate_actions
        result = get_corporate_actions(ticker)
        with Column(gap=4) as view:
            Heading(f"get_corporate_actions — {ticker}")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_sector_rotation():
        """Test UI: invoke get_sector_rotation_map"""
        from tools.sector_rotation import get_sector_rotation_map
        result = get_sector_rotation_map()
        with Column(gap=4) as view:
            Heading("get_sector_rotation_map")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_news_feed(query: str = "RELIANCE NSE"):
        """Test UI: invoke get_news_feed"""
        from tools.news_feed import get_news_feed
        result = get_news_feed(query)
        with Column(gap=4) as view:
            Heading(f"get_news_feed — '{query}'")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)

    @mcp.tool(app=True)
    def test_sector_impact(event: str = "rate hike", sector: str = "Banking"):
        """Test UI: invoke analyze_sector_impact"""
        from tools.sector_impact import analyze_sector_impact
        result = analyze_sector_impact(event, sector)
        with Column(gap=4) as view:
            Heading(f"analyze_sector_impact — '{event}'")
            Markdown(content=_json_block(result))
        return PrefabApp(view=view)
```

- [ ] **Step 2: Write `server.py`**

```python
from fastmcp import FastMCP
from fastmcp.apps.generative import GenerativeUI

mcp = FastMCP("NSE Swing Trader")
mcp.add_provider(GenerativeUI())

# Register all data tools
from tools.market_context   import get_market_context
from tools.universe         import get_fo_universe
from tools.screener         import screen_stocks, get_composite_scan
from tools.deep_dive        import get_stock_deep_dive
from tools.technical_levels import get_technical_levels
from tools.peer_comparison  import get_peer_comparison
from tools.options_data     import get_options_data
from tools.fii_dii_flow     import get_fii_dii_flow
from tools.delivery_data    import get_delivery_data
from tools.corporate_actions import get_corporate_actions
from tools.sector_rotation  import get_sector_rotation_map
from tools.news_feed        import get_news_feed
from tools.sector_impact    import analyze_sector_impact

DATA_TOOLS = [
    get_market_context, get_fo_universe, screen_stocks, get_composite_scan,
    get_stock_deep_dive, get_technical_levels, get_peer_comparison,
    get_options_data, get_fii_dii_flow, get_delivery_data,
    get_corporate_actions, get_sector_rotation_map, get_news_feed,
    analyze_sector_impact,
]
for tool_fn in DATA_TOOLS:
    mcp.tool()(tool_fn)

# Register mini test UI wrappers
from ui.test_ui import register_test_ui
register_test_ui(mcp)

if __name__ == "__main__":
    mcp.run()
```

- [ ] **Step 3: Verify server starts**

```bash
python server.py
```
Expected: Server starts with no import errors. Ctrl+C to stop.

- [ ] **Step 4: Launch fastmcp dev apps and verify all test UIs are present**

```bash
fastmcp dev apps server.py
```
Expected: Browser opens. You should see 14 `test_*` tools listed. Select `test_market_context` — it should call the tool and render the JSON output. Repeat for 2-3 others to confirm the pattern works.

- [ ] **Step 5: Run full test suite**

```bash
pytest tests/ -v
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add ui/test_ui.py server.py
git commit -m "feat: mini Prefab test UI for all tools + FastMCP server"
```

---

## Self-Review Checklist

Spec coverage:
- ✅ All 14 data tools implemented with docstrings as prompt instructions
- ✅ @swing_tool decorator collects docstrings into TOOL_PROMPTS
- ✅ build_system_prompt() assembles prompt from tool registry
- ✅ SQLite cache with TTL
- ✅ yfinance wrappers with cache integration
- ✅ F&O universe with live fetch + static fallback
- ✅ All 5 signals: beta, RSI, momentum, volume, composite
- ✅ Composite score reads weights from config.toml at call time
- ✅ config.toml with empty LLM fields (fill before Phase 2)
- ✅ Mini Prefab test UI for every tool via fastmcp dev apps
- ✅ FastMCP server registers all tools

Not in this plan (Phase 2):
- swing_trader app tool (LLM agent + generative UI)
- build_system_prompt() wired into agent loop
- GenerativeUI provider used fo
r swing_trader (registered in server.py but unused until Phase 2)
