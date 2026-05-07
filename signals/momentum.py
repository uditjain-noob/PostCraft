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
