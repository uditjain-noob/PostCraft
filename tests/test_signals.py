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
