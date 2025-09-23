
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

from core.models import DayPlan, DailySummary, Block


try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.prompts import ChatPromptTemplate
except Exception:
    ChatGoogleGenerativeAI = None  
    ChatPromptTemplate = None     

load_dotenv()
LLM_MODEL = os.getenv("LC_MODEL", "gemini-2.5-flash")



def _minutes(b: Block) -> int:
    return int((b.end - b.start).total_seconds() // 60)


def _energy_alignment(plan: DayPlan, curve: Optional[Dict[datetime, float]] = None) -> float:
    """
    Compute the fraction of scheduled minutes that land in 'high energy' slots (>= 0.75).
    If a curve dict is not provided, treat all slots as neutral (alignment=0.0 when no blocks).
    """
    if not plan.blocks:
        return 0.0
    if curve is None:
        total = sum(_minutes(b) for b in plan.blocks)
        return 0.0 if total == 0 else 0.0

    hi_thresh = 0.75
    hi = 0
    total = 0
    for b in plan.blocks:
        t = b.start.replace(second=0, microsecond=0)
        while t < b.end:
            total += 15
            if curve.get(t, 0.0) >= hi_thresh:
                hi += 15
            t += timedelta(minutes=15)
    return 0.0 if total == 0 else round(hi / total, 2)


def _flow_minutes(plan: DayPlan) -> int:
    """
    'Flow' is the sum of minutes in blocks that are >= 45 minutes, favoring deep work.
    (Simple, explainable metric for v1.)
    """
    return sum(_minutes(b) for b in plan.blocks if _minutes(b) >= 45)


def _baseline_suggestions(energy_alignment: float, plan: DayPlan) -> List[str]:
    """
    Deterministic suggestions you always have as a fallback.
    Keep concise, actionable, and stable so diffing is trivial.
    """
    suggestions: List[str] = []
    if energy_alignment >= 0.75:
        suggestions.append("Keep anchoring deep work in your peak hours; it’s working.")
    elif energy_alignment >= 0.55:
        suggestions.append("Nudge deep work earlier by ~30–45 minutes to better hit your peak.")
    else:
        suggestions.append("Protect one 60–90 minute block in your peak window; move admin out of it.")


    short_blocks = [b for b in plan.blocks if _minutes(b) < 30]
    if len(short_blocks) >= 2:
        suggestions.append("Use 30–45 minute focus blocks with 10-minute buffers; group tiny items.")

    
    if any(b.end.hour >= 17 for b in plan.blocks):
        suggestions.append("Trim late-day work; reserve the last 15 minutes for shutdown and tomorrow’s setup.")


    if len(suggestions) > 2:
        suggestions = suggestions[:2]
    return suggestions


class Advice(BaseModel):
    suggestions: List[str] = Field(default_factory=list)


_LLM_SUMMARY_PROMPT = None
if ChatPromptTemplate is not None:
    _LLM_SUMMARY_PROMPT = ChatPromptTemplate.from_messages([
        #put your prompt here
    ])


def _get_llm():
    key = os.getenv("GOOGLE_API_KEY")
    if not key or ChatGoogleGenerativeAI is None:
        return None
    try:
        return ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0, google_api_key=key)
    except Exception:
        return None


def _blocks_table(plan: DayPlan) -> str:
    lines = []
    for b in plan.blocks:
        lines.append(f"- {b.start.strftime('%H:%M')}-{b.end.strftime('%H:%M')} | {b.task_title} | { _minutes(b)}m")
    return "\n".join(lines) if lines else "- (no blocks)"


def _llm_suggestions(
    *,
    date_str: str,
    profile: Optional[str],
    work_start_h: int,
    work_end_h: int,
    energy_alignment: float,
    flow_minutes: int,
    plan: DayPlan,
) -> Optional[List[str]]:
    """Ask the LLM to rewrite/augment suggestions; fail-soft to None."""
    llm = _get_llm()
    if llm is None or _LLM_SUMMARY_PROMPT is None:
        return None

    chain = _LLM_SUMMARY_PROMPT | llm.with_structured_output(Advice)
    try:
        advice: Advice = chain.invoke({
            "date": date_str,
            "profile": profile or "-",
            "work_start_h": work_start_h,
            "work_end_h": work_end_h,
            "energy_alignment": energy_alignment,
            "flow_minutes": flow_minutes,
            "blocks_table": _blocks_table(plan),
        })
        # sanitize: keep up to 3 short suggestions, strip blanks
        out = [s.strip() for s in (advice.suggestions or []) if s.strip()]
        if len(out) > 3:
            out = out[:3]
        return out or None
    except ValidationError:
        return None
    except Exception:
        return None



def summarize(
    plan: DayPlan,
    *,
    completed_titles: Optional[List[str]] = None,
    profile: Optional[str] = None,
    work_start_h: int = 9,
    work_end_h: int = 18,
    energy_curve: Optional[List[Tuple[datetime, float]]] = None,
) -> DailySummary:
    """
    Compute deterministic metrics (completion_rate, energy_alignment, flow_minutes) and
    produce suggestions. If an LLM is available, rewrite the suggestions to be sharper
    and context-specific; otherwise fallback to deterministic tips.
    """
    completed_titles = completed_titles or []

   
    planned_titles = [b.task_title for b in plan.blocks]
    planned_unique = set(planned_titles)
    done = len([t for t in planned_unique if t in set(completed_titles)])
    total = len(planned_unique) if planned_unique else 1
    completion_rate = round(done / total, 2)

    
    curve_dict = None
    if energy_curve:
        curve_dict = {t: e for t, e in energy_curve}
    energy_align = _energy_alignment(plan, curve=curve_dict)

    
    flow = _flow_minutes(plan)


    suggestions = _baseline_suggestions(energy_align, plan)


    llm_out = _llm_suggestions(
        date_str=plan.date.isoformat(),
        profile=profile,
        work_start_h=work_start_h,
        work_end_h=work_end_h,
        energy_alignment=energy_align,
        flow_minutes=flow,
        plan=plan,
    )
    if llm_out is not None:
        suggestions = llm_out

    return DailySummary(
        date=plan.date,
        completion_rate=completion_rate,
        energy_alignment=energy_align,
        flow_minutes=flow,
        suggestions=suggestions,
    )
