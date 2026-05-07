import pandas as pd


def compute_volume_ratio(volumes: pd.Series, window: int = 20) -> float:
    """Return ratio of current volume to the average of the prior `window` sessions."""
    current = float(volumes.iloc[-1])
    avg = float(volumes.iloc[-window:-1].mean()) if len(volumes) > 1 else 0.0
    return float(current / avg) if avg > 0 else 0.0
