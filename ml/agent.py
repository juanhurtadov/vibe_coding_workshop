"""
NodalIQ LangGraph agent — orchestrates market analysis and recommendation synthesis.

Entry point: run_agent(forecast, lp_schedule, rl_schedule, battery, node) -> dict
"""

from typing import TypedDict

from langgraph.graph import StateGraph, START, END


# ─── State ────────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    node: str
    forecast: list[dict]       # [{ds, yhat, yhat_lower, yhat_upper}]
    lp_schedule: dict          # {schedule, total_expected_revenue, status}
    rl_schedule: dict          # {schedule, total_expected_revenue, policy}
    battery: dict
    peak_hours: list[int]      # 6 highest-price hours (indices into forecast)
    trough_hours: list[int]    # 6 lowest-price hours
    selected_strategy: str     # "lp" | "rl"
    recommendation_text: str   # GPT-4o output


# ─── Nodes ────────────────────────────────────────────────────────────────────

def analyze_market(state: AgentState) -> dict:
    """Sort the 24h forecast and extract the 6 peak and 6 trough hour indices."""
    forecast = state["forecast"]

    indexed = list(enumerate(forecast))
    sorted_asc = sorted(indexed, key=lambda x: x[1].get("yhat", 0))

    trough_hours = [i for i, _ in sorted_asc[:6]]
    peak_hours = [i for i, _ in sorted_asc[-6:]]

    return {"peak_hours": peak_hours, "trough_hours": trough_hours}


def select_strategy(state: AgentState) -> dict:
    """Pick LP or RL based on whichever has higher expected revenue."""
    lp_rev = (state.get("lp_schedule") or {}).get("total_expected_revenue") or 0
    rl_rev = (state.get("rl_schedule") or {}).get("total_expected_revenue") or 0

    selected = "lp" if lp_rev >= rl_rev else "rl"
    return {"selected_strategy": selected}


def write_recommendation(state: AgentState) -> dict:
    """Build a structured prompt and call GPT-4o for a plain-language recommendation."""
    import os
    import openai

    forecast = state["forecast"]
    peak_hours = state["peak_hours"]
    trough_hours = state["trough_hours"]
    selected = state["selected_strategy"]
    lp_schedule = state.get("lp_schedule") or {}
    rl_schedule = state.get("rl_schedule") or {}
    node = state["node"]

    peak_prices = [
        {"hour": h, "price_per_mwh": round(forecast[h]["yhat"], 2)}
        for h in peak_hours
        if h < len(forecast)
    ]
    trough_prices = [
        {"hour": h, "price_per_mwh": round(forecast[h]["yhat"], 2)}
        for h in trough_hours
        if h < len(forecast)
    ]

    chosen = lp_schedule if selected == "lp" else rl_schedule
    total_rev = chosen.get("total_expected_revenue") or 0
    sample_actions = (chosen.get("schedule") or [])[:6]

    prompt = (
        f"You are a battery dispatch advisor for an energy storage operator at ERCOT node {node}.\n\n"
        f"Today's 24-hour price forecast shows:\n"
        f"- Peak hours (best discharge windows): {peak_prices}\n"
        f"- Trough hours (best charge windows): {trough_prices}\n\n"
        f"Selected strategy: {selected.upper()} optimizer\n"
        f"Expected revenue: ${total_rev:.2f}\n"
        f"Sample dispatch actions (first 6 hours): {sample_actions}\n\n"
        "Write a concise (3-5 sentence) plain-language recommendation for the operator. "
        "Include when to charge, when to discharge, and the expected revenue. "
        "Be specific about hours and prices. End with one sentence on key risk."
    )

    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.3,
    )

    recommendation_text = response.choices[0].message.content.strip()
    return {"recommendation_text": recommendation_text}


# ─── Graph ────────────────────────────────────────────────────────────────────

def _build_graph():
    g = StateGraph(AgentState)
    g.add_node("analyze_market", analyze_market)
    g.add_node("select_strategy", select_strategy)
    g.add_node("write_recommendation", write_recommendation)
    g.add_edge(START, "analyze_market")
    g.add_edge("analyze_market", "select_strategy")
    g.add_edge("select_strategy", "write_recommendation")
    g.add_edge("write_recommendation", END)
    return g.compile()


_graph = None


# ─── Entry point ──────────────────────────────────────────────────────────────

def run_agent(
    forecast: list[dict],
    lp_schedule: dict,
    rl_schedule: dict,
    battery: dict,
    node: str,
) -> dict:
    """Called by the Modal endpoint. Returns recommendation + strategy metadata."""
    global _graph
    if _graph is None:
        _graph = _build_graph()

    initial_state: AgentState = {
        "node": node,
        "forecast": forecast,
        "lp_schedule": lp_schedule or {},
        "rl_schedule": rl_schedule or {},
        "battery": battery,
        "peak_hours": [],
        "trough_hours": [],
        "selected_strategy": "lp",
        "recommendation_text": "",
    }

    final_state = _graph.invoke(initial_state)

    return {
        "recommendation_text": final_state["recommendation_text"],
        "selected_strategy": final_state["selected_strategy"],
        "peak_hours": final_state["peak_hours"],
        "trough_hours": final_state["trough_hours"],
    }
