# agents/classifier.py
try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_google_genai import ChatGoogleGenerativeAI
except Exception:
    ChatPromptTemplate = None
    ChatGoogleGenerativeAI = None
from core.models import Task
from core.config import MODEL
import os

_GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

_CLASSIFIER_PROMPT = None
if ChatPromptTemplate is not None:
    _CLASSIFIER_PROMPT = ChatPromptTemplate.from_messages([
        ("system",
         "You are a cognitive effort classifier for tasks.\n"
         "Return only one of low|medium|high and a confidence 0-1.\n"
         "Guidelines\n"
         "- Deep work (reports, coding, analysis, research, design) is high.\n"
         "- Meetings, reviews, writing short notes are medium.\n"
         "- Emails, quick calls, admin, errands are low.\n"
         "Only classify based on the given title and notes.\n"),
         ("human", "Tasks: {title}\n Notes: {notes}\n")
    ])

_llm = None
if ChatGoogleGenerativeAI is not None and _GOOGLE_API_KEY:
    try:
        _llm = ChatGoogleGenerativeAI(
            model=MODEL,
            temperature=0,
            google_api_key=_GOOGLE_API_KEY,
        )
    except Exception:
        _llm = None

def classify_effort(task: Task) -> Task:
    # --- Step 1: Optionally get initial classification from the LLM ---
    effort, conf = "medium", 0.6
    if _llm is not None and _CLASSIFIER_PROMPT is not None:
        try:
            out = _llm.invoke(
                _CLASSIFIER_PROMPT.format_messages(
                    title=task.title,
                    notes=task.notes or ""
                )
            )
            text = (out.content or "").lower()
            if "high" in text:
                effort, conf = "high", 0.8
            elif "low" in text:
                effort, conf = "low", 0.7
            elif "medium" in text:
                effort, conf = "medium", 0.7
        except Exception:
            # fall back to deterministic classification below
            effort, conf = "medium", 0.6

    # --- Step 3: Refine with rule-based keywords ---
    hi_kw = ["report", "analysis", "prototype", "research", "design", "study"]
    lo_kw = ["email", "call", "text", "schedule", "calendar", "meeting"]
    txt = (task.title + " " + (task.notes or "")).lower()
    if any(k in txt for k in hi_kw):
        effort, conf = "high", max(conf, 0.85)
    elif effort != "high" and any(k in txt for k in lo_kw):
        effort, conf = "low", max(conf, 0.75)


    task.effort, task.confidence = effort, conf
    return task