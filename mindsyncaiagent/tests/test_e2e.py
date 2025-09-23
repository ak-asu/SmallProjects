import sys
import os
from datetime import date

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient

from api import app
from agents.parser import parse_task, parse_tasks
from agents.classifier import classify_effort
from agents.scheduler import greedy_schedule, mock_energy_curve
from agents.summarizer import summarize
from core.models import Task
from graph.plan_graph import run_once

client = TestClient(app)


def test_parse_and_classify():
    raw = "Finish report; ~2h; due Fri 5pm"
    t = parse_task(raw)
    assert isinstance(t, Task)
    # classify (no LLM needed due to keyword rules)
    t2 = classify_effort(t)
    assert t2.effort in ("low", "medium", "high")


def test_schedule_and_summarize():
    raw = "Finish report; 2h; due today 17:00"
    t = parse_task(raw)
    t = classify_effort(t)
    day = date.today()
    curve = mock_energy_curve(day)
    plan = greedy_schedule([t], day, energy_curve=curve, work_start_h=9, work_end_h=18)
    summary = summarize(plan, completed_titles=[], profile="balanced", work_start_h=9, work_end_h=18, energy_curve=curve)
    assert summary.date == plan.date
    assert isinstance(summary.suggestions, list)


def test_graph_run_once():
    state = run_once("Quick email; 15m; due today")
    assert "task" in state and "plan" in state and "summary" in state


def test_api_endpoints():
    # /health
    r = client.get("/health")
    assert r.status_code == 200 and r.json().get("ok") is True

    # /parse
    r = client.post("/parse", json={"text": "Quick email; 15m"})
    assert r.status_code == 200 and "task" in r.json()

    # /classify
    r = client.post("/classify", json={"title": "Quick email", "notes": "reply to x", "est_minutes": 15})
    assert r.status_code == 200 and r.json().get("task", {}).get("effort") in (None, "low", "medium", "high")

    # /plan
    r = client.post("/plan", json={
        "tasks": ["Quick email; 15m", "Write analysis; 1.5h"],
        "day": date.today().isoformat(),
    })
    assert r.status_code == 200
    body = r.json()
    assert "plan" in body and "summary" in body
 