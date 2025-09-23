
from __future__ import annotations

import os
from datetime import datetime, timedelta, date, time
from typing import List, Tuple, Dict, Optional

from pydantic import BaseModel, Field, ValidationError
from dotenv import load_dotenv

from core.models import Task, DayPlan, Block

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.prompts import ChatPromptTemplate
except Exception:
    ChatGoogleGenerativeAI = None  
    ChatPromptTemplate = None     

load_dotenv()

LLM_MODEL = os.getenv("LC_MODEL", "gemini-2.5-flash-lite")

Slot = Tuple[datetime, datetime]

def mock_energy_curve(day: date) -> List[Tuple[datetime, float]]:
    """
    Returns 96 (15-min) points across the day with simple peaks:
      • High:        09:00–11:00
      • Post-lunch:  13:00–14:00 dip
      • Medium-high: 16:00–18:00
    Values in [0..1].
    """
    base = datetime.combine(day, time(6, 0))
    curve: List[Tuple[datetime, float]] = []
    for i in range(96):
        t = base + timedelta(minutes=15 * i)
        hour = t.hour + t.minute / 60.0
        e = 0.3
        if 9 <= hour <= 11:
            e = 0.9
        if 16 <= hour <= 18:
            e = max(e, 0.8)
        if 13 <= hour <= 14:
            e = 0.2
        curve.append((t, e))
    return curve


def mock_busy(day: date) -> List[Slot]:
    """
    Hardcoded conflicts to simulate meetings:
      • 10:30–11:00
      • 14:00–15:00
    """
    s1 = datetime.combine(day, time(10, 30)); e1 = s1 + timedelta(minutes=30)
    s2 = datetime.combine(day, time(14, 0));  e2 = s2 + timedelta(minutes=60)
    return [(s1, e1), (s2, e2)]


def _clamp_to_workday(dt: datetime, day: date, start_h: int, end_h: int) -> datetime:
    """Clamp any datetime to [start_h, end_h] on the given day."""
    start = datetime.combine(day, time(start_h, 0))
    end = datetime.combine(day, time(end_h, 0))
    return max(min(dt, end), start)


def _workday_slots(day: date, start_h=9, end_h=18, step_min=15) -> List[Slot]:
    start = datetime.combine(day, time(start_h, 0))
    end = datetime.combine(day, time(end_h, 0))
    slots: List[Slot] = []
    t = start
    while t < end:
        nxt = t + timedelta(minutes=step_min)
        slots.append((t, nxt))
        t = nxt
    return slots


def _overlaps(a: Slot, b: Slot) -> bool:
    return not (a[1] <= b[0] or b[1] <= a[0])


def _slot_scores(free: List[Slot], curve: List[Tuple[datetime, float]]) -> Dict[Slot, float]:
    energy_lookup = {t: e for t, e in curve}
    return {s: energy_lookup.get(s[0], 0.5) for s in free}


def _chunk_minutes_for_effort(effort: Optional[str]) -> int:
    """
    Choose chunk size by effort:
      • high:   60m
      • medium: 45m
      • low:    30m
    """
    eff = (effort or "").lower()
    if eff == "high":
        return 60
    if eff == "low":
        return 30
    return 45


def _contiguous_slots(start: datetime, minutes: int) -> List[Slot]:
    """Return the list of 15-min slots covering [start, start+minutes]."""
    steps = max(1, minutes // 15)
    return [
        (start + timedelta(minutes=15 * i),
         start + timedelta(minutes=15 * (i + 1)))
        for i in range(steps)
    ]


def _snap_down_15(dt: datetime) -> datetime:
    minutes = (dt.minute // 15) * 15
    return dt.replace(minute=minutes, second=0, microsecond=0)


def _snap_up_15(dt: datetime) -> datetime:
    if dt.minute % 15 == 0 and dt.second == 0 and dt.microsecond == 0:
        return dt.replace(second=0, microsecond=0)
    delta = 15 - (dt.minute % 15)
    out = dt + timedelta(minutes=delta)
    return out.replace(second=0, microsecond=0)


def _merge_adjacent(plan: DayPlan) -> DayPlan:
    """Fuse adjacent blocks of the same task to reduce fragmentation."""
    merged: List[Block] = []
    for b in sorted(plan.blocks, key=lambda x: (x.start, x.task_title)):
        if merged and merged[-1].task_title == b.task_title and merged[-1].end == b.start:
            merged[-1].end = b.end
        else:
            merged.append(b)
    plan.blocks = merged
    return plan


class PlanAdvice(BaseModel):
    order: List[str] = Field(default_factory=list)                # titles by priority (highest first)
    chunk_minutes: Dict[str, int] = Field(default_factory=dict)   # per-title overrides (15..120)
    defer: List[str] = Field(default_factory=list)                # titles to skip today
    note: Optional[str] = None


def _get_llm_for_scheduler():
    key = os.getenv("GOOGLE_API_KEY")
    if not key or ChatGoogleGenerativeAI is None:
        return None
    try:
        return ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0, google_api_key=key)
    except Exception:
        return None


def _summarize_energy(curve: List[Tuple[datetime, float]]) -> str:
    """Compact hourly avg, e.g., '06:30 07:35 08:60 ...' where value is %."""
    buckets: Dict[int, List[float]] = {}
    for t, e in curve:
        buckets.setdefault(t.hour, []).append(e)
    parts = []
    for h in sorted(buckets):
        avg = sum(buckets[h]) / max(1, len(buckets[h]))
        parts.append(f"{h:02d}:{int(round(avg * 100)):02d}")
    return " ".join(parts)


_LLM_SCHED_PROMPT = None
if ChatPromptTemplate is not None:
    _LLM_SCHED_PROMPT = ChatPromptTemplate.from_messages([
        ("system",
         "You are a planning assistant. Given tasks and an energy profile (0..1), "
         "propose: (1) a task priority order, (2) optional chunk minutes per task, "
         "and (3) tasks to defer. Keep JSON small and deterministic.\n"
         "Rules:\n"
         "- Respect same-day deadlines: urgent tasks must come earlier.\n"
         "- High-effort → prefer higher energy hours; low-effort → fine in dips.\n"
         "- If the day is too full, you may suggest deferring some tasks.\n"
         "- Do NOT invent titles; only use provided titles exactly.\n"
         "- Return only JSON valid for the schema."),
        ("human",
         "Day: {day}\n"
         "Work hours: {start_h}:00–{end_h}:00\n"
         "Energy hourly avg (HH:score%): {energy_summary}\n"
         "Tasks (title | est_minutes | effort | deadline | fixed):\n{task_table}\n"
         "Return a JSON object with fields: order, chunk_minutes, defer, note.")
    ])

def _llm_plan_advice(
    tasks: List[Task],
    day: date,
    *,
    energy_curve: List[Tuple[datetime, float]],
    work_start_h: int,
    work_end_h: int,
) -> Optional[PlanAdvice]:
    """Ask the LLM for suggested order / chunk / deferrals. Fail-soft to None."""
    llm = _get_llm_for_scheduler()
    if llm is None or _LLM_SCHED_PROMPT is None:
        return None

    # --- Input Preparation (Provided) ---
    rows = []
    for t in tasks:
        dl = t.deadline.isoformat() if t.deadline else "-"
        fx = ""
        if getattr(t, "fixed_start", None) and getattr(t, "fixed_end", None):
            fx = f"{t.fixed_start.strftime('%H:%M')}-{t.fixed_end.strftime('%H:%M')}"
        rows.append(f"- {t.title} | {int(t.est_minutes)} | {t.effort or 'medium'} | {dl} | {fx or '-'}")
    task_table = "\n".join(rows)
    energy_summary = _summarize_energy(energy_curve)

    try:

        # Build and run the LCEL chain only if the prompt and LLM are available.
        if _LLM_SCHED_PROMPT is None:
            return None

        llm = _get_llm_for_scheduler()
        if llm is None:
            return None

        # Chain the prompt to the LLM and request a structured PlanAdvice output.
        try:
            chain = _LLM_SCHED_PROMPT | llm.with_structured_output(PlanAdvice)
            advice: PlanAdvice = chain.invoke({
                "day": day.isoformat(),
                "start_h": work_start_h,
                "end_h": work_end_h,
                "energy_summary": energy_summary,
                "task_table": task_table,
            })
        except Exception:
            return None
        
        # --- End of Coding Section ---

        if advice and advice.chunk_minutes:
            advice.chunk_minutes = {
                k: int(max(15, min(120, v))) for k, v in advice.chunk_minutes.items()
            }
        return advice
    except ValidationError:
        return None
    except Exception:
        return None




def greedy_schedule(
    tasks: List[Task],
    day: date,
    *,
    energy_curve: Optional[List[Tuple[datetime, float]]] = None,
    busy: Optional[List[Slot]] = None,
    work_start_h: int = 9,
    work_end_h: int = 18,
    step_min: int = 15,
    use_llm: Optional[bool] = None,  # enable LLM layer (env or explicit)
) -> DayPlan:
    """
    Greedy packer with:
      • fixed-time reservations (+ safety valve vs deadline),
      • work-hours clamp,
      • same-day deadline guard (no chunk ends after deadline),
      • mild energy-aware scoring (high→peaks, low→dips),
      • optional LLM pre-advice (order / chunk / deferrals),
      • contiguous chunk packing + merge.
    """
    curve = energy_curve or mock_energy_curve(day)
    busy_list = busy or mock_busy(day)

    use_llm = True
    all_work_slots = _workday_slots(day, start_h=work_start_h, end_h=work_end_h, step_min=step_min)
    free = [s for s in all_work_slots if not any(_overlaps(s, b) for b in busy_list)]
    scores = _slot_scores(free, curve)

    plan = DayPlan(date=day, blocks=[])
    used: set[Slot] = set()

    fixed: List[Tuple[Task, Optional[datetime], Optional[datetime]]] = []
    flexible: List[Task] = []

    for t in tasks:
        fs = getattr(t, "fixed_start", None)
        fe = getattr(t, "fixed_end", None)
        if fs or fe:
            if fs and not fe:
                fe = fs + timedelta(minutes=int(max(15, t.est_minutes)))
            fs = _snap_down_15(fs) if fs else None
            fe = _snap_up_15(fe) if fe else None
            if t.deadline and t.deadline.date() == day and fe and fe > t.deadline:
                fs, fe = None, None

            try:
                t.fixed_start, t.fixed_end = fs, fe 
            except Exception:
                pass

            if fs and fe:
                fixed.append((t, fs, fe))
            else:
                flexible.append(t)
        else:
            flexible.append(t)

    for t, fs, fe in fixed:
        if not fs or not fe:
            continue
        if fs.date() != day:
            continue
        fs = _clamp_to_workday(fs, day, work_start_h, work_end_h)
        fe = _clamp_to_workday(fe, day, work_start_h, work_end_h)
        if fe <= fs:
            continue
        minutes = int((fe - fs).total_seconds() // 60)
        needed = _contiguous_slots(fs, minutes)
        for ns in needed:
            used.add(ns)
        plan.blocks.append(Block(task_title=t.title, start=fs, end=fe))

   
    free = [s for s in free if s not in used]
    if not free and len(plan.blocks) == 0:
        return plan

 
    advice: Optional[PlanAdvice] = None
    if use_llm:
        # Only ask LLM about flexible tasks
        advice = _llm_plan_advice(
            tasks=flexible,
            day=day,
            energy_curve=curve,
            work_start_h=work_start_h,
            work_end_h=work_end_h,
        )

    by_title: Dict[str, Task] = {t.title: t for t in flexible}
    defer_titles: set[str] = set()
    chunk_override: Dict[str, int] = {}

    if advice:
        defer_titles = {t for t in advice.defer if t in by_title}
        flexible = [t for t in flexible if t.title not in defer_titles]
        if advice.chunk_minutes:
            for k, v in advice.chunk_minutes.items():
                if k in by_title:
                    chunk_override[k] = int(max(15, min(120, v)))

    # --- 4) Order flexible tasks (deadline first, then effort) or use LLM order ---
    def task_key(t: Task):
        d = t.deadline or datetime.combine(day, time(23, 59))
        eff_rank = {"high": 0, "medium": 1, "low": 2}.get((t.effort or "medium").lower(), 1)
        return (d, eff_rank)

    tasks_sorted_default = sorted(flexible, key=task_key)

    if advice and advice.order:
        seen_titles: set[str] = set()
        ordered: List[Task] = []

        # put LLM-ordered tasks first
        for title in advice.order:
            t = by_title.get(title)
            if t and t in flexible and title not in seen_titles:
                ordered.append(t)
                seen_titles.add(title)

        # then append leftovers in default order
        for t in tasks_sorted_default:
            if t.title not in seen_titles:
                ordered.append(t)
                seen_titles.add(t.title)

        tasks_sorted = ordered
    else:
        tasks_sorted = tasks_sorted_default


    def score_for_task(slot: Slot, effort: Optional[str]) -> float:
        e = scores.get(slot, 0.5)
        h = slot[0].hour
        eff = (effort or "medium").lower()
        if eff == "high":
            return e                      
        if eff == "low":
            early_penalty = 0.2 if h < max(work_start_h + 1, 9) else 0.0
            return (1.0 - e) - early_penalty
        return 0.5 + 0.5 * e            

    for t in tasks_sorted:
        remaining = max(15, int(t.est_minutes))

        chunk = _chunk_minutes_for_effort(t.effort)
        if advice and t.title in chunk_override:
            chunk = chunk_override[t.title]

        latest_end: Optional[datetime] = None
        if t.deadline and t.deadline.date() == day:
            latest_end = t.deadline

        free_sorted = sorted(free, key=lambda x: -score_for_task(x, t.effort))

        while remaining > 0:
            placed_any = False

            for s in free_sorted:
                if s in used:
                    continue

                minutes = min(chunk, remaining)
                if minutes < 30 and remaining >= 30:
                    minutes = 30

                start = s[0]
                end = start + timedelta(minutes=minutes)

                start = _clamp_to_workday(start, day, work_start_h, work_end_h)
                end = _clamp_to_workday(end, day, work_start_h, work_end_h)
                if end <= start:
                    continue

                if latest_end and end > latest_end:
                    continue

                needed = _contiguous_slots(start, minutes)
                if not all(ns in free and ns not in used for ns in needed):
                    continue

                for ns in needed:
                    used.add(ns)
                plan.blocks.append(Block(task_title=t.title, start=start, end=end))
                remaining -= minutes
                placed_any = True
                break

            if not placed_any:
                break

   
    plan.blocks.sort(key=lambda b: b.start)
    _merge_adjacent(plan)
    return plan

def energy_alignment(plan: DayPlan) -> float:
    """Fraction of planned minutes landing in high-energy slots (>= 0.75)."""
    if not plan.blocks:
        return 0.0
    curve = dict(mock_energy_curve(plan.date))
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

