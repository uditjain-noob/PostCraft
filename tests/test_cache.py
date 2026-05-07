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
