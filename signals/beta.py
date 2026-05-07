import numpy as np
import pandas as pd
from data.fetch import fetch_ohlcv

def compute_beta(ticker: str, benchmark: str = "^NSEI") -> float:
    stock_df = fetch_ohlcv(ticker, period="1y")
    bench_df = fetch_ohlcv(benchmark, period="1y")
    stock_ret = stock_df["Close"].pct_change().dropna()
    bench_ret = bench_df["Close"].pct_change().dropna()
    combined = pd.concat([stock_ret, bench_ret], axis=1).dropna()
    combined.columns = ["stock", "bench"]
    cov = np.cov(combined["stock"], combined["bench"])
    bench_var = cov[1, 1]
    return float(cov[0, 1] / bench_var) if bench_var != 0 else 1.0
