"""
PuLP linear programming dispatch optimizer.

Given a 24-hour price forecast and battery specs, solves for the optimal
charge/discharge schedule that maximizes energy arbitrage revenue while
respecting SOC, power, and efficiency constraints.
"""

from pulp import (
    LpProblem, LpMaximize, LpVariable, LpStatus,
    lpSum, value, PULP_CBC_CMD,
)


def optimize(forecast_prices: list[float], battery: dict) -> dict:
    """
    Args:
        forecast_prices: list of 24 hourly prices ($/MWh), index = hour 0..23
        battery: {
            capacity_kwh: float,
            max_charge_kw: float,
            max_discharge_kw: float,
            round_trip_efficiency: float,  # e.g. 0.85
            min_soc: float,                # fraction, e.g. 0.10
            max_soc: float,                # fraction, e.g. 0.95
        }

    Returns:
        {
            schedule: [{hour, action, amount_kw, expected_revenue, soc_pct}],
            total_expected_revenue: float,
            status: str,
        }
    """
    T = len(forecast_prices)
    cap = battery["capacity_kwh"]
    max_ch = battery["max_charge_kw"]
    max_dis = battery["max_discharge_kw"]
    eta = battery["round_trip_efficiency"]
    soc_min = battery["min_soc"] * cap
    soc_max = battery["max_soc"] * cap
    soc_init = 0.5 * cap  # start at 50% SOC

    prob = LpProblem("battery_dispatch", LpMaximize)

    charge = [LpVariable(f"ch_{t}", 0, max_ch) for t in range(T)]
    discharge = [LpVariable(f"dis_{t}", 0, max_dis) for t in range(T)]
    soc = [LpVariable(f"soc_{t}", soc_min, soc_max) for t in range(T)]

    # Objective: maximize net revenue (discharge revenue - charge cost)
    # Convert kWh → MWh by dividing by 1000
    prob += lpSum(
        (discharge[t] - charge[t]) * forecast_prices[t] / 1000
        for t in range(T)
    )

    # SOC dynamics
    prob += soc[0] == soc_init + charge[0] * eta - discharge[0]
    for t in range(1, T):
        prob += soc[t] == soc[t - 1] + charge[t] * eta - discharge[t]

    # Can't charge and discharge simultaneously (handled implicitly by
    # revenue maximization, but add a soft guard via separate variable limits)
    for t in range(T):
        prob += charge[t] + discharge[t] <= max(max_ch, max_dis)

    prob.solve(PULP_CBC_CMD(msg=0))

    status = LpStatus[prob.status]
    schedule = []
    for t in range(T):
        ch = value(charge[t]) or 0.0
        dis = value(discharge[t]) or 0.0
        soc_val = value(soc[t]) or soc_init
        price = forecast_prices[t]

        if ch > 0.1:
            action, amount = "charge", ch
        elif dis > 0.1:
            action, amount = "discharge", dis
        else:
            action, amount = "idle", 0.0

        revenue = (dis - ch) * price / 1000

        schedule.append({
            "hour": t,
            "action": action,
            "amount_kw": round(amount, 2),
            "expected_revenue": round(revenue, 4),
            "soc_pct": round(soc_val / cap, 3),
        })

    total = sum(s["expected_revenue"] for s in schedule)
    return {
        "schedule": schedule,
        "total_expected_revenue": round(total, 4),
        "status": status,
    }
