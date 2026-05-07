import yfinance as yf
import pandas as pd
from data.cache import get_cache

def fetch_ohlcv(ticker: str, period: str = "1y") -> pd.DataFrame:
    cache = get_cache()
    key = f"ohlcv:{ticker}:{period}"
    cached = cache.get(key)
    if cached:
        df = pd.DataFrame(cached)
        date_col = next((c for c in ("Date", "index") if c in df.columns), None)
        if date_col:
            df = df.set_index(date_col)
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
