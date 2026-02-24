"""
Prophet price forecaster.
Takes historical ERCOT DAM prices and returns a 24-hour ahead forecast.
"""

import pandas as pd
from prophet import Prophet


def forecast(prices: list[dict], horizon_hours: int = 24) -> list[dict]:
    """
    Args:
        prices: list of {interval_start: str (ISO), price_per_mwh: float}
                sorted oldest → newest, minimum ~48 rows recommended
        horizon_hours: number of hours to forecast ahead

    Returns:
        list of {ds: str, yhat: float, yhat_lower: float, yhat_upper: float}
    """
    df = pd.DataFrame(prices)
    df["ds"] = pd.to_datetime(df["interval_start"], utc=True).dt.tz_localize(None)
    df["y"] = df["price_per_mwh"].astype(float)
    df = df[["ds", "y"]].dropna().sort_values("ds").reset_index(drop=True)

    if len(df) < 2:
        raise ValueError(f"Need at least 2 price rows, got {len(df)}")

    model = Prophet(
        daily_seasonality=True,
        weekly_seasonality=len(df) >= 48,  # need >2 days for weekly
        yearly_seasonality=False,           # not enough data at this stage
        changepoint_prior_scale=0.05,       # conservative — ERCOT prices are noisy
        interval_width=0.90,
    )
    model.fit(df)

    future = model.make_future_dataframe(periods=horizon_hours, freq="h")
    fc = model.predict(future)

    # Return only the forecasted future rows
    fc_future = fc[fc["ds"] > df["ds"].max()].head(horizon_hours)

    return [
        {
            "ds": row["ds"].isoformat(),
            "yhat": round(float(row["yhat"]), 4),
            "yhat_lower": round(float(row["yhat_lower"]), 4),
            "yhat_upper": round(float(row["yhat_upper"]), 4),
        }
        for _, row in fc_future.iterrows()
    ]
