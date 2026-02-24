"""
NodalIQ ML layer — deployed on Modal.

Endpoints:
  POST /forecast   → Prophet 24h price forecast
  POST /optimize   → PuLP LP dispatch schedule
  POST /rl         → SAC RL dispatch schedule

All return JSON. Called from Next.js API routes via fetch().
"""

import modal

app = modal.App("nodaliq-ml")


# ─── Build step: compile Prophet's Stan model inside the container ─────────
# run_function gives real Python tracebacks (unlike run_commands which silently
# swallows exceptions from Prophet's bare `except:` clause).

def _compile_prophet():
    """
    Prophet's PyPI wheel ships a pre-compiled manylinux binary (incompatible
    with Modal's Debian container) and a bundled Windows CmdStan 2.33.1
    (invalid on Linux — CmdStanPyBackend.__init__ calls set_cmdstan_path() on
    it and fails). This function:
      1. Removes both artifacts.
      2. Compiles prophet_model.stan fresh with the system CmdStan 2.38.0.
      3. Copies the compiled binary to the path Prophet expects.
    Runs once at image-build time; result is baked into the image layer.
    """
    import os
    import shutil
    import cmdstanpy
    import prophet as _prophet

    stan_model_dir = os.path.join(os.path.dirname(_prophet.__file__), "stan_model")
    bin_path = os.path.join(stan_model_dir, "prophet_model.bin")

    # 1. Remove manylinux pre-compiled binary
    if os.path.exists(bin_path):
        os.remove(bin_path)

    # 2. Remove bundled Windows CmdStan — CmdStanPyBackend.__init__ tries
    #    set_cmdstan_path() on it and raises ValueError on Linux.
    bundled_cmdstan = os.path.join(stan_model_dir, "cmdstan-2.33.1")
    if os.path.exists(bundled_cmdstan):
        shutil.rmtree(bundled_cmdstan)

    # 3. Point cmdstanpy at the freshly installed CmdStan
    cmdstanpy.set_cmdstan_path(cmdstanpy.cmdstan_path())

    # 4. Compile the Stan source (mounted via add_local_file) and save binary
    stan_file = os.path.join(stan_model_dir, "prophet_model.stan")
    model = cmdstanpy.CmdStanModel(stan_file=stan_file)
    shutil.copy(model.exe_file, bin_path)
    print(f"Prophet Stan model compiled: {bin_path}")


# ─── Image with all ML deps + local source files ──────────────────────────

_base_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi[standard]",
        "prophet==1.1.6",
        "pulp==2.9.0",
        "torch==2.5.1",
        "pandas==2.2.3",
        "numpy==1.26.4",
    )
    .run_commands("python -c 'import cmdstanpy; cmdstanpy.install_cmdstan(overwrite=True)'")
)

ml_image = (
    _base_image
    # Mount the Stan source extracted from the sdist — not shipped in the manylinux wheel
    .add_local_file(
        "prophet_model.stan",
        "/usr/local/lib/python3.12/site-packages/prophet/stan_model/prophet_model.stan",
        copy=True,
    )
    .run_function(_compile_prophet)
    .add_local_python_source("forecaster", "optimizer", "rl_agent")
)

# ─── Forecast endpoint ────────────────────────────────────────────────────

@app.function(image=ml_image, timeout=120)
@modal.fastapi_endpoint(method="POST")
def forecast(body: dict) -> dict:
    """
    Body: { prices: [{interval_start, price_per_mwh}], horizon_hours?: int }
    Returns: { forecast: [{ds, yhat, yhat_lower, yhat_upper}] }
    """
    from forecaster import forecast as run_forecast

    prices = body.get("prices", [])
    horizon = int(body.get("horizon_hours", 24))

    if not prices:
        return {"error": "prices array is required", "forecast": []}

    try:
        result = run_forecast(prices, horizon_hours=horizon)
        return {"forecast": result, "count": len(result)}
    except Exception as exc:
        import traceback
        return {"error": str(exc), "traceback": traceback.format_exc(), "forecast": []}


# ─── LP Optimize endpoint ─────────────────────────────────────────────────

@app.function(image=ml_image, timeout=60)
@modal.fastapi_endpoint(method="POST")
def optimize(body: dict) -> dict:
    """
    Body: {
        forecast_prices: [float, ...],   # 24 hourly prices $/MWh
        battery: {
            capacity_kwh, max_charge_kw, max_discharge_kw,
            round_trip_efficiency, min_soc, max_soc
        }
    }
    Returns: { schedule: [...], total_expected_revenue: float, status: str }
    """
    from optimizer import optimize as run_optimize

    forecast_prices = body.get("forecast_prices", [])
    battery = body.get("battery", {})

    if not forecast_prices or not battery:
        return {"error": "forecast_prices and battery are required"}

    return run_optimize(forecast_prices, battery)


# ─── RL dispatch endpoint ─────────────────────────────────────────────────

@app.function(image=ml_image, timeout=60)
@modal.fastapi_endpoint(method="POST")
def rl(body: dict) -> dict:
    """
    Body: {
        forecast_prices: [float, ...],   # 24 hourly prices $/MWh
        battery: { ... },
        start_hour?: int,                # hour of day (default 0)
        dow?: int                        # day of week 0=Mon (default 0)
    }
    Returns: { schedule: [...], total_expected_revenue: float, policy: str }
    """
    from rl_agent import rl_dispatch

    forecast_prices = body.get("forecast_prices", [])
    battery = body.get("battery", {})
    start_hour = int(body.get("start_hour", 0))
    dow = int(body.get("dow", 0))

    if not forecast_prices or not battery:
        return {"error": "forecast_prices and battery are required"}

    return rl_dispatch(forecast_prices, battery, start_hour=start_hour, dow=dow)


# ─── Local test ───────────────────────────────────────────────────────────

@app.local_entrypoint()
def test():
    """Run: modal run ml/main.py"""
    import json

    sample_prices = [
        {"interval_start": f"2026-02-19T{str(h).zfill(2)}:00:00", "price_per_mwh": 20 + h * 3}
        for h in range(24)
    ] * 3  # repeat 3 days for Prophet

    battery = {
        "capacity_kwh": 1000,
        "max_charge_kw": 250,
        "max_discharge_kw": 250,
        "round_trip_efficiency": 0.85,
        "min_soc": 0.10,
        "max_soc": 0.95,
    }

    print("Testing forecast...")
    fc = forecast.local({"prices": sample_prices})
    print(f"  Forecast: {len(fc['forecast'])} hours")
    print(f"  Sample: {fc['forecast'][0]}")

    forecast_prices = [r["yhat"] for r in fc["forecast"]]

    print("\nTesting LP optimizer...")
    lp = optimize.local({"forecast_prices": forecast_prices, "battery": battery})
    print(f"  LP total revenue: ${lp['total_expected_revenue']:.2f}")
    print(f"  Status: {lp['status']}")

    print("\nTesting RL agent...")
    rl_result = rl.local({"forecast_prices": forecast_prices, "battery": battery})
    print(f"  RL total revenue: ${rl_result['total_expected_revenue']:.2f}")
    print(f"  Policy: {rl_result['policy']}")

    print("\nAll tests passed.")
