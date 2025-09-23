import os
import sys
import pytest
from datetime import date
from dotenv import load_dotenv

# Load environment variables at import time so pytest collection sees keys like
# GOOGLE_API_KEY. This ensures skip markers that check os.getenv(...) behave
# correctly when running under pytest inside the project's .venv.
load_dotenv('.env')

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from api import app
from agents import parser, classifier, scheduler

client = TestClient(app)


def has_llm_setup() -> bool:
    # crude checks: installed packages and GOOGLE_API_KEY present
    key = os.getenv("GOOGLE_API_KEY")
    have_libs = True
    try:
        import langchain_core  # type: ignore
        import langchain_google_genai  # type: ignore
    except Exception:
        have_libs = False
    return bool(key) and have_libs


@pytest.mark.skipif(not has_llm_setup(), reason="No LLM configuration available in environment")
def test_llm_parser_and_classifier():
    # run LLM-backed parse and classify paths
    raw = "Draft research plan; 2h; due tomorrow 17:00; research"
    t = parser.parse_task(raw)
    assert t.title and t.est_minutes

    t2 = classifier.classify_effort(t)
    assert t2.effort in ("low", "medium", "high")


@pytest.mark.skipif(not has_llm_setup(), reason="No LLM configuration available in environment")
def test_api_plan_with_quiz_and_llm():
    # call the plan/with_quiz endpoint which uses infer_profile -> energy_curve -> LLM scheduler
    payload = {
        "wake_time": "7",
        "peak_block_start": "10",
        "night_alert": 1,
        "post_lunch_slump": 2,
        "ideal_meeting_time": "11",
        "tasks": ["Draft research plan; 2h; due tomorrow 17:00; research", "Quick email; 15m"],
        "day": date.today().isoformat(),
    }
    r = client.post("/plan/with_quiz", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert "plan" in body and "summary" in body
 