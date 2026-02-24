"""
SAC (Soft Actor-Critic) dispatch policy.

Architecture:
  State  : (soc_pct, price_now, price_forecast[t+1..t+6], hour_sin, hour_cos, dow_sin, dow_cos)
           → 12-dim vector
  Action : scalar in [-1, 1], scaled to [-max_discharge_kw, max_charge_kw]
  Reward : realized revenue per step; SOC violations penalised

Training: run ml/train_sac.py offline on historical ERCOT data.
          Serializes policy to ml/artifacts/sac_policy.pt.

Inference (this file): loads the saved policy and returns a 24-hour
          action sequence given current state + price forecast.
"""

from __future__ import annotations
import math
import os
from typing import Optional

import torch
import torch.nn as nn


# ─── Network definition (must match training) ─────────────────────────────

class Actor(nn.Module):
    """Gaussian policy network. Outputs mean + log_std of action distribution."""

    STATE_DIM = 12
    ACTION_DIM = 1

    def __init__(self, hidden: int = 128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(self.STATE_DIM, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden), nn.ReLU(),
        )
        self.mean_head = nn.Linear(hidden, self.ACTION_DIM)
        self.log_std_head = nn.Linear(hidden, self.ACTION_DIM)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        h = self.net(x)
        mean = self.mean_head(h)
        log_std = self.log_std_head(h).clamp(-4, 2)
        return mean, log_std

    @torch.no_grad()
    def act(self, state: torch.Tensor, deterministic: bool = True) -> float:
        mean, log_std = self(state.unsqueeze(0))
        if deterministic:
            raw = mean
        else:
            std = log_std.exp()
            raw = mean + std * torch.randn_like(std)
        # squash to (-1, 1) via tanh
        return float(torch.tanh(raw).squeeze())


# ─── State encoding ───────────────────────────────────────────────────────

def encode_state(
    soc_pct: float,
    price_now: float,
    price_forecast: list[float],  # next 6 hours
    hour: int,
    dow: int,
    price_scale: float = 150.0,
) -> torch.Tensor:
    """Normalise and encode state into a 12-dim tensor."""
    forecast_norm = [(p / price_scale) for p in (price_forecast[:6] + [0] * 6)[:6]]
    hour_sin = math.sin(2 * math.pi * hour / 24)
    hour_cos = math.cos(2 * math.pi * hour / 24)
    dow_sin = math.sin(2 * math.pi * dow / 7)
    dow_cos = math.cos(2 * math.pi * dow / 7)
    state = [soc_pct, price_now / price_scale] + forecast_norm + [hour_sin, hour_cos, dow_sin, dow_cos]
    return torch.tensor(state, dtype=torch.float32)


# ─── Policy loading ───────────────────────────────────────────────────────

_policy: Optional[Actor] = None
ARTIFACT_PATH = os.path.join(os.path.dirname(__file__), "artifacts", "sac_policy.pt")


def _load_policy() -> Actor:
    global _policy
    if _policy is None:
        actor = Actor()
        if os.path.exists(ARTIFACT_PATH):
            actor.load_state_dict(torch.load(ARTIFACT_PATH, map_location="cpu"))
            actor.eval()
        else:
            # No trained weights yet — use random init as a baseline
            # (will be replaced once train_sac.py is run)
            actor.eval()
        _policy = actor
    return _policy


# ─── Inference ────────────────────────────────────────────────────────────

def rl_dispatch(forecast_prices: list[float], battery: dict, start_hour: int = 0, dow: int = 0) -> dict:
    """
    Args:
        forecast_prices : list of 24 hourly prices ($/MWh)
        battery         : same spec dict as optimizer.py
        start_hour      : hour of day for first interval (0-23)
        dow             : day of week (0=Mon … 6=Sun)

    Returns:
        Same shape as optimizer.optimize() so the two can be compared directly.
    """
    actor = _load_policy()
    cap = battery["capacity_kwh"]
    max_ch = battery["max_charge_kw"]
    max_dis = battery["max_discharge_kw"]
    eta = battery["round_trip_efficiency"]
    soc_min = battery["min_soc"]
    soc_max = battery["max_soc"]

    soc_pct = 0.5  # start at 50%
    schedule = []

    for t, price in enumerate(forecast_prices):
        hour = (start_hour + t) % 24
        future_prices = forecast_prices[t + 1: t + 7]

        state = encode_state(soc_pct, price, future_prices, hour, dow)
        raw_action = actor.act(state, deterministic=True)  # in (-1, 1)

        # Map action to kW: positive → discharge, negative → charge
        if raw_action > 0.05:
            kw = raw_action * max_dis
            action = "discharge"
            soc_pct = max(soc_min, soc_pct - kw / cap)
        elif raw_action < -0.05:
            kw = abs(raw_action) * max_ch
            action = "charge"
            soc_pct = min(soc_max, soc_pct + (kw * eta) / cap)
        else:
            kw = 0.0
            action = "idle"

        revenue = (kw if action == "discharge" else -kw if action == "charge" else 0) * price / 1000

        schedule.append({
            "hour": t,
            "action": action,
            "amount_kw": round(kw, 2),
            "expected_revenue": round(revenue, 4),
            "soc_pct": round(soc_pct, 3),
        })

    total = sum(s["expected_revenue"] for s in schedule)
    trained = os.path.exists(ARTIFACT_PATH)
    return {
        "schedule": schedule,
        "total_expected_revenue": round(total, 4),
        "policy": "sac_trained" if trained else "sac_random_init",
    }
