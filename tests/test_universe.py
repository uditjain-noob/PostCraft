import pytest
from unittest.mock import patch
from tools.universe import get_fo_universe


@pytest.fixture(autouse=True)
def reset_cache():
    import tools.universe as u
    u._universe_cache = None
    yield
    u._universe_cache = None


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
