# MindSyncAI Planner (minimal setup)

This repository contains a small FastAPI app and supporting agents for parsing, classifying, scheduling, and summarizing tasks.

Quick start (recommended in a virtualenv):

1. Install dependencies

```bash
python -m venv .venv
source .venv/Scripts/activate   # on Windows PowerShell use: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Copy `.env.sample` to `.env` and populate `GOOGLE_API_KEY` and `LC_MODEL` if you intend to use LLM integrations.

3. Run the API locally:

```bash
uvicorn api:app --reload --port 8000
```

4. Health check

GET http://127.0.0.1:8000/health

Notes
- The project aims to fail-soft when LLM integrations are missing; core scheduling and parsing have deterministic fallbacks.
- This README is intentionally minimal. Add project-specific environment and deployment instructions as needed.
