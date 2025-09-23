from __future__ import annotations
import os
import re
from datetime import datetime, timedelta
from typing import Optional

from pydantic import BaseModel
try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_google_genai import ChatGoogleGenerativeAI
except Exception:
    ChatPromptTemplate = None
    ChatGoogleGenerativeAI = None

from core.models import Task
from core.config import MODEL
try:
    from dateutil import parser as dtp
except Exception:
    # Provide a minimal fallback that supports ISO-like strings. This keeps
    # the library importable in environments where python-dateutil isn't
    # installed. The fallback raises on unsupported formats.
    from types import SimpleNamespace
    from datetime import datetime

    def _fallback_parse(s: str, default: datetime | None = None) -> datetime:
        # try native ISO parser first
        try:
            # handle cases like '2024-03-15T14:30:00' or '2024-03-15'
            return datetime.fromisoformat(s)
        except Exception:
            if default is not None:
                # return default when parse fails, mirroring dateutil's behavior in some cases
                return default
            raise

    dtp = SimpleNamespace(parse=_fallback_parse)


_DUE_PAT = re.compile(r"\bdue\b([^;,.]*)", re.IGNORECASE)
def _extract_due_deadline(raw_text: str, plan_day: datetime) -> datetime | None:
    m = _DUE_PAT.search(raw_text or "")
    if not m:
        return None
    frag = m.group(1).strip()
    try:
        dt = dtp.parse(frag, default=plan_day.replace(hour=0, minute=0, second=0, microsecond=0))
        return dt
    except Exception:
        return None
def _get_llm():
    # Return an LLM instance when available and configured, else None.
    if ChatGoogleGenerativeAI is None:
        return None
    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        return None
    try:
        return ChatGoogleGenerativeAI(
            model=MODEL,
            temperature=0,
            google_api_key=key,
        )
    except Exception:
        return None

class TaskDraft(BaseModel):
    title: str
    est_minutes: int = 30
    deadline: Optional[str] = None         
    tags: list[str] = []
    notes: Optional[str] = None
    fixed_start: Optional[str] = None      
    fixed_end: Optional[str] = None

_BASE_RULES = (
    "Return only the fields defined by the schema"
    "Convert durations like '2h', '1.5 hours', '45m' into total minutes"
    "If explicit time windows appear (eg: '14:00-14:30','2pm-3pm','Fri 11am')"
    "set fixed_start/fixed_end accordingly"
    "If only a start time is given (eg, at '14:00'),set fixed_start to that time and "
    "fixed_end = fixed_start + est_minutes"
    "Treat any phrase starting with 'due' (e.g., 'due today 4pm', 'due Fri 17:00')"
    " as a DEADLINE (deadline field), NOT as a fixed_start/fixed_end. Never set fixed_start/"
    "fixed_end from 'due'"
    )

if ChatPromptTemplate is not None:
    PARSER_PROMPT_LENIENT = ChatPromptTemplate.from_messages([
        ("system",
         "Extract a single Task JSON using this schema:"
         "title (string), est_minutes (int), deadline (string|null), tags(list[str]),"
         "notes (string|null), fixed_start (string|null), fixed_end (string|null). "
         + _BASE_RULES),
         ("human", "{raw_text}")
    ])

    PARSER_PROMPT_STRICT = ChatPromptTemplate.from_messages([
        ("system",
         "Extract a single Task JSON using this schema:"
         "title (string), est_minutes (int), deadline (ISO8601 string|null), tags(list[str]),"
         "notes (string|null), fixed_start (ISO8601 string|null), fixed_end (ISO8601 string|null). "
         + _BASE_RULES),
         "IMPORTANT: Never output words like 'today' or 'tomorrow'; use only ISO format only."
         "Always convert to full ISO 8601 (e.g., '2024-03-15T14:30:00')"
         "If a relative day has no time, use 17:00 as the default time.",
        ("human", "{raw_text}")
    ])
else:
    PARSER_PROMPT_LENIENT = None
    PARSER_PROMPT_STRICT = None


_TIME_RE = re.compile(
    r'(?<!\d)(?P<h1>\d{1,2})(?::(?P<m1>\d{2}))?\s*(?P<ampm1>am|pm)?'
    r'\s*[-–—]\s*'
    r'(?P<h2>\d{1,2})(?::(?P<m2>\d{2}))?\s*(?P<ampm2>am|pm)?',
    re.IGNORECASE,
)
_SINGLE_TIME_RE = re.compile(
    r'(?<!\d)(?P<h>\d{1,2})(?::(?P<m>\d{2}))?\s*(?P<ampm>am|pm)?',
    re.IGNORECASE,
)

def _to_24h(h: int, ampm: str | None) -> int:
    if ampm is None:
        return h if 0 <= h <= 23 else h % 24
    ampm = ampm.lower()
    if ampm == "am":
        return 0 if h == 12 else h
    return 12 if h == 12 else h + 12

def _parse_time_window_from_text(raw_text: str, base: datetime) -> tuple[datetime | None, datetime | None]:
    m = _TIME_RE.search(raw_text)
    if not m:
        return (None, None)
    h1 = _to_24h(int(m.group("h1")), m.group("ampm1"))
    m1 = int(m.group("m1") or 0)
    h2 = _to_24h(int(m.group("h2")), m.group("ampm2"))
    m2 = int(m.group("m2") or 0)
    start = base.replace(hour=h1, minute=m1, second=0, microsecond=0)
    end = base.replace(hour=h2, minute=m2, second=0, microsecond=0)
    if end <= start:
        end += timedelta(days=1)
    return (start, end)

def _parse_single_time_from_text(raw_text: str, base: datetime) -> datetime | None:
    m = _SINGLE_TIME_RE.search(raw_text)
    if not m:
        return None
    h = _to_24h(int(m.group("h")), m.group("ampm"))
    mm = int(m.group("m") or 0)
    return base.replace(hour=h, minute=mm, second=0, microsecond=0)

def _normalize_rel_word(s: Optional[str], default_hour=17) -> datetime | None:
    if not s:
        return None
    txt = s.strip().lower()
    now = datetime.now()
    if txt == "today":
        return now.replace(hour=default_hour, minute=0, second=0, microsecond=0)
    if txt in {"tomorrow", "tmr"}:
        tmr = now + timedelta(days=1)
        return tmr.replace(hour=default_hour, minute=0, second=0, microsecond=0)
    
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

def _finalize_task(raw_text: str, d: TaskDraft) -> Task:
    base = _infer_base_from_text(raw_text)

    fs_dt = _normalize_rel_word(d.fixed_start)
    fe_dt = _normalize_rel_word(d.fixed_end)
    if fs_dt is None and fe_dt is None:
        fs_dt, fe_dt = _parse_time_window_from_text(raw_text, base)
    if fs_dt is None and fe_dt is None:
        fs_dt = _parse_single_time_from_text(raw_text, base)
    if fs_dt is not None and fe_dt is None:
        fe_dt = fs_dt + timedelta(minutes=d.est_minutes or 30)

    dl_dt = _normalize_rel_word(d.deadline)
    if dl_dt is None and d.deadline:
        maybe = _parse_single_time_from_text(d.deadline, base)
        dl_dt = maybe or dl_dt

    extra_due = _extract_due_deadline(raw_text, base)
    if extra_due:
        dl_dt = extra_due if (dl_dt is None or extra_due < dl_dt) else dl_dt

        tlow = raw_text.lower()
        has_window = _TIME_RE.search(raw_text) is not None
        has_explicit_start_words = any(w in tlow for w in (" at ", " start ", " from "))
        if not has_window and not has_explicit_start_words:
            fs_dt, fe_dt = None, None

    return Task(
        title=d.title,
        est_minutes=d.est_minutes or 30,
        deadline=dl_dt,
        tags=d.tags,
        notes=d.notes,
        fixed_start=fs_dt,
        fixed_end=fe_dt,
    )

def parse_task(raw_text: str) -> Task:
    """
    Parse raw text into a Task.
    Strategy:
      1) Lenient pass (times as strings) -> Python normalization.
      2) If conversion fails, strict pass (ISO-only).
    """
    llm = _get_llm()

    # If an LLM is available and prompts are configured, try the lenient/strict chains.
    if llm is not None and ChatPromptTemplate is not None:
        try:
            draft_chain = PARSER_PROMPT_LENIENT | llm.with_structured_output(TaskDraft)
            draft = draft_chain.invoke({"raw_text": raw_text})
            return _finalize_task(raw_text, draft)
        except Exception:
            try:
                strict_chain = PARSER_PROMPT_STRICT | llm.with_structured_output(TaskDraft)
                draft2 = strict_chain.invoke({"raw_text": raw_text})
                return _finalize_task(raw_text, draft2)
            except Exception:
                # fall through to deterministic fallback
                pass

    # Deterministic fallback parser (no LLM): simple semicolon-splitting and regex heuristics.
    parts = [p.strip() for p in re.split(r";|\n", raw_text) if p.strip()]
    title = parts[0] if parts else raw_text.strip()

    # duration: look for patterns like '2h', '1.5 hours', '45m'
    est_minutes = 30
    dur_match = re.search(r"(\d+(?:\.\d+)?)\s*h", raw_text, re.IGNORECASE)
    if dur_match:
        hours = float(dur_match.group(1))
        est_minutes = int(hours * 60)
    else:
        min_match = re.search(r"(\d+)\s*m", raw_text, re.IGNORECASE)
        if min_match:
            est_minutes = int(min_match.group(1))

    base = _infer_base_from_text(raw_text)
    dl_dt = _extract_due_deadline(raw_text, base)
    fs_dt, fe_dt = _parse_time_window_from_text(raw_text, base)
    if fs_dt is None:
        fs_dt = _parse_single_time_from_text(raw_text, base)
    if fs_dt is not None and fe_dt is None:
        fe_dt = fs_dt + timedelta(minutes=est_minutes)

    return Task(
        title=title,
        est_minutes=est_minutes,
        deadline=dl_dt,
        tags=[],
        notes=None,
        fixed_start=fs_dt,
        fixed_end=fe_dt,
    )

    # --- END OF THE CODING EXERCISE ---

def parse_tasks(texts: list[str]) -> list[Task]:
    return [parse_task(t) for t in texts]

def _infer_base_from_text(raw_text: str) -> datetime:
    t = raw_text.lower()
    now = datetime.now()
    
    if "tomorrow" in t or "tmr" in t:
        return now + timedelta(days=1)
    if "today" in t:
        return now
    return now
