from config import get_config


def compute_composite_score(
    beta: float,
    rsi: float,
    volume_ratio: float,
    ema_signal: str,
    momentum_20d_val: float,
    pct_from_52w_high_val: float,
    roe: float,
    de_ratio: float,
) -> float:
    w = get_config()["weights"]

    ema_score = {"bullish": 100.0, "neutral": 50.0, "bearish": 0.0}.get(ema_signal, 50.0)
    mom_score = min(100.0, max(0.0, 50.0 + momentum_20d_val * 2))
    pos_score = min(100.0, max(0.0, 100.0 + pct_from_52w_high_val * 2))
    momentum = ema_score * 0.4 + mom_score * 0.3 + pos_score * 0.3

    if 40 <= rsi <= 60:
        rsi_score = 80.0 + (50 - abs(rsi - 50)) * 0.4
    elif rsi < 40:
        rsi_score = max(0.0, rsi * 1.5)
    else:
        rsi_score = max(0.0, 100.0 - (rsi - 60) * 2.5)

    vol_score = min(100.0, volume_ratio * 50)
    beta_score = min(100.0, max(0.0, (beta - 0.5) * 50))
    fund_score = 100.0 if (roe >= 0.12 and de_ratio <= 1.5) else (30.0 if roe >= 0.08 else 0.0)

    score = (
        momentum   * w["momentum"] +
        rsi_score  * w["rsi"] +
        vol_score  * w["volume"] +
        beta_score * w["beta"] +
        fund_score * w["fundamental"]
    )
    return round(min(100.0, max(0.0, score)), 1)
