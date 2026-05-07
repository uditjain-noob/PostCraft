import json
from pathlib import Path

_STATIC_PATH = Path(__file__).parent.parent / "data" / "fo_universe.json"
_universe_cache: list | None = None

def _load_static() -> list:
    with open(_STATIC_PATH) as f:
        return json.load(f)

def _fetch_live_universe() -> list:
    from nsepython import fnolist
    tickers = fnolist()
    return [{"ticker": f"{t}.NS", "sector": "Unknown"} for t in tickers]

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
