import pandas as pd
import numpy as np


def compute_rsi(closes: pd.Series, period: int = 14) -> float:
    delta = closes.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    gain_arr = gain.values
    loss_arr = loss.values
    with np.errstate(divide="ignore", invalid="ignore"):
        rs = np.where(loss_arr == 0, np.inf, gain_arr / loss_arr)
    rsi_arr = np.where(
        loss_arr == 0,
        np.where(gain_arr == 0, 50.0, 100.0),
        100.0 - 100.0 / (1.0 + rs),
    )
    return float(rsi_arr[-1])
