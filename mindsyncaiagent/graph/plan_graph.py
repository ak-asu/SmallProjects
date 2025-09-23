# graph/plan_graph.py
from __future__ import annotations
from typing import TypedDict
from datetime import date

try:
    from langgraph.graph import StateGraph, END
except Exception:
    StateGraph = None
    END = None

from core.models import Task, DayPlan, DailySummary
from agents.parser import parse_task
from agents.classifier import classify_effort
from agents.scheduler import greedy_schedule
from agents.summarizer import summarize


class State(TypedDict, total=False):
    raw_text: str
    task: Task
    plan: DayPlan
    summary: DailySummary

def node_parse(state: State) -> State:
    """Raw text → Task"""
    # Parse raw_text into a Task and store it in state['task'].
    raw = state.get("raw_text")
    if not raw:
        return state
    t = parse_task(raw)
    state["task"] = t
    return state


def node_classify(state: State) -> State:
    """Task → (effort, confidence)"""
    # Classify the task and update state['task'] with effort/confidence.
    t = state.get("task")
    if not t:
        return state
    state["task"] = classify_effort(t)
    return state


def node_schedule(state: State) -> State:
    """Task(+effort) → DayPlan (today by default)"""
    # Schedule the task into a DayPlan and store in state['plan'].
    t = state.get("task")
    if not t:
        return state
    # determine target day: use task.deadline.date() if present and a date, else today
    from datetime import date
    target_day = date.today()
    try:
        if getattr(t, "deadline", None) is not None:
            d = t.deadline
            target_day = d.date()
    except Exception:
        target_day = date.today()

    plan = greedy_schedule([t], target_day)
    state["plan"] = plan
    return state


def node_summary(state: State) -> State:
    """DayPlan → DailySummary (rule-based tips by default)"""
    # Summarize the plan and put the DailySummary in state['summary'].
    p = state.get("plan")
    if not p:
        return state
    summary = summarize(p, completed_titles=[])
    state["summary"] = summary
    return state


def build_graph():
    """
    Returns a compiled LangGraph app that runs:
        parse → classify → schedule → summary
    """
    # Build a langgraph-backed runner when available, otherwise provide
    # a safe sequential runner that applies the nodes in order.
    g = None
    run_graph_callable = None

    if StateGraph is not None:
        try:
            try:
                g = StateGraph(state_schema=State)
            except TypeError:
                g = StateGraph()

            if g is not None:
                # add nodes and edges
                g.add_node("parse", node_parse)
                g.add_node("classify", node_classify)
                g.add_node("schedule", node_schedule)
                g.add_node("summary", node_summary)
                g.add_edge("parse", "classify")
                g.add_edge("classify", "schedule")
                g.add_edge("schedule", "summary")

                def _invoke_langgraph(state: State) -> State:
                    # Try typical invocation methods; if none work, raise.
                    for method in ("run", "invoke", "execute", "__call__"):
                        fn = getattr(g, method, None)
                        if fn is None:
                            continue
                        try:
                            return fn(state)
                        except Exception:
                            continue
                    raise RuntimeError("unable to invoke StateGraph with known methods")

                run_graph_callable = _invoke_langgraph
        except Exception:
            run_graph_callable = None

    # Fallback sequential runner
    def runner(state: State) -> State:
        s = dict(state)
        s = node_parse(s)
        s = node_classify(s)
        s = node_schedule(s)
        s = node_summary(s)
        return s

    # Wrap: prefer langgraph runner, but on any error fall back to sequential runner
    def graph_runner(state: State) -> State:
        if run_graph_callable is not None:
            try:
                return run_graph_callable(state)
            except Exception:
                return runner(state)
        return runner(state)

    return graph_runner


def run_once(raw_text: str) -> State:
    """
    Convenience wrapper used by app.py:
    input raw text → returns final state with task, plan, summary.
    """
    # Build and run the graph (or the safe fallback runner).
    # HINT: The initial state is {"raw_text": raw_text}
    g = build_graph()
    initial: State = {"raw_text": raw_text}
    return g(initial)

