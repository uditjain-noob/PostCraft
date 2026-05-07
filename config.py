import tomllib
from pathlib import Path

def get_config() -> dict:
    path = Path(__file__).parent / "config.toml"
    with open(path, "rb") as f:
        return tomllib.load(f)
