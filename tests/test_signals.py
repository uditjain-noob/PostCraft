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
    assert abs(b - 2.0) < 0.1

def test_beta_returns_float():
    prices = list(range(100, 352))
    with patch("signals.beta.fetch_ohlcv", side_effect=[make_ohlcv(prices), make_ohlcv(prices)]):
        b = compute_beta("STOCK.NS")
    assert isinstance(b, float)

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
