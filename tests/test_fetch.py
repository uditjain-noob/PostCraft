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
