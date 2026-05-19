# AGENTS.md — LLM & Agentic Coding Guide

> **Purpose:** This file is the single source of truth for any LLM or coding agent working on this codebase. Read this before touching any file. It tells you what exists, where it lives, what patterns to follow, and what traps to avoid.

---

## Project Identity

**Name:** API Dev Dashboard  
**Type:** Local developer tool — not a SaaS, not a cloud app  
**Stack:** FastAPI (Python 3.11+) backend · React 18 + Vite frontend · SQLite via SQLAlchemy  
**Ports:** Backend `:9001` · Frontend `:5173` · Sample target API `:8000`

---

## Repository Layout

```
project-apimu/
├── api-dashboard/
│   ├── backend/                        # FastAPI app (Python package)
│   │   ├── main.py                     # ← App factory, middleware, router mounts
│   │   ├── config.py                   # ← Pydantic Settings (reads .env)
│   │   ├── database/
│   │   │   ├── db.py                   # ← engine, SessionLocal, init_db()
│   │   │   └── models.py               # ← ORM: Trace, TestRun, TestCase
│   │   ├── routers/                    # ← One file per route group
│   │   │   ├── schema.py               #   GET  /schema, GET /schema/diagnose
│   │   │   ├── proxy.py                #   POST /proxy
│   │   │   ├── generator.py            #   POST /tests/generate
│   │   │   ├── runner.py               #   POST /tests/run  (SSE)
│   │   │   ├── traces.py               #   GET/DELETE /traces
│   │   │   ├── analytics.py            #   GET /analytics/*
│   │   │   └── test_cases.py           #   CRUD + run /test-cases
│   │   └── services/
│   │       ├── schema_parser.py        # ← Parse raw OpenAPI JSON → endpoint list
│   │       ├── test_generator.py       # ← Write pytest file from endpoints
│   │       ├── tracer.py               # ← Save a Trace row to DB
│   │       └── result_parser.py        # ← Parse pytest-json-report → trace dicts
│   │
│   ├── frontend/
│   │   ├── vite.config.js              # ← Proxy: /api → http://127.0.0.1:9001
│   │   └── src/
│   │       ├── App.jsx                 # ← BrowserRouter + nav + useSchema (global)
│   │       ├── api/client.js           # ← Axios instance (baseURL="/api")
│   │       ├── pages/
│   │       │   ├── Dashboard.jsx       # ← KPIs + charts
│   │       │   ├── Explorer.jsx        # ← Schema load, form, proxy send
│   │       │   ├── History.jsx         # ← Trace browser + filters
│   │       │   └── TestCases.jsx       # ← Test case CRUD + batch run
│   │       ├── components/
│   │       │   ├── Sidebar.jsx         # ← Endpoint list by tag
│   │       │   ├── DynamicForm.jsx     # ← Auto-form from schema params
│   │       │   ├── ResponsePanel.jsx   # ← Show HTTP response
│   │       │   ├── AddToTestModal.jsx  # ← Save request as test case
│   │       │   ├── TestCaseCard.jsx    # ← Card with run/edit/delete
│   │       │   ├── TestCaseForm.jsx    # ← Create/edit form
│   │       │   ├── TestRunner.jsx      # ← Pytest SSE stream display
│   │       │   ├── TraceCard.jsx       # ← Expanded trace detail
│   │       │   ├── charts/
│   │       │   │   ├── CallsPerEndpoint.jsx
│   │       │   │   ├── PassFailPie.jsx
│   │       │   │   └── ResponseTimeLine.jsx
│   │       │   └── shared/
│   │       │       ├── Badge.jsx       # ← Status code color badge
│   │       │       ├── EmptyState.jsx  # ← "No data" placeholder
│   │       │       └── Spinner.jsx     # ← Loading spinner
│   │       └── hooks/
│   │           ├── useSchema.js        # ← Load schema + step logging + diagnose
│   │           ├── useTraces.js        # ← Query/filter traces
│   │           ├── useTestCases.js     # ← CRUD test cases
│   │           ├── useAnalytics.js     # ← Fetch all analytics endpoints
│   │           └── useTestRun.js       # ← SSE listener for pytest runner
│   │
│   ├── sample_app/
│   │   ├── main.py                     # ← Product Inventory API (CRUD, in-memory)
│   │   └── tests/test_main.py          # ← pytest integration tests for sample app
│   │
│   ├── generated_tests/
│   │   └── test_generated.py           # ← Auto-generated pytest (overwritten on generate)
│   ├── .env.example                    # ← Copy to .env to configure
│   └── requirements.txt
│
└── diagnose_network.py                 # ← Run to debug connectivity issues
```

---

## Critical Rules — Read Before Editing

### 1. Port 9001, not 9000
Port 9000 is permanently occupied by **ZSATunnel** (Zscaler corporate VPN, PID protected). Never use port 9000 for the dashboard backend. The configured port is `9001` everywhere:
- `backend/config.py` default
- `frontend/vite.config.js` proxy target
- All startup commands

### 2. Always use `127.0.0.1`, never `localhost` in server-side code
On this Windows machine, `localhost` resolves to `::1` (IPv6) before `127.0.0.1`, adding a ~2s DNS penalty when the target is IPv4-only. The backend converts `localhost` → `127.0.0.1` in `routers/schema.py`. Do not revert this. Start uvicorn with `--host 127.0.0.1`.

### 3. Schema state lives in `App.jsx`
`useSchema()` is called in `App.jsx` and passed as `schemaProps` to `Explorer`. **Do not move it back into `Explorer.jsx`** — it would be destroyed on every page navigation.

### 4. SQLite migration is done in-place
`db.py → init_db()` runs `CREATE TABLE IF NOT EXISTS` via SQLAlchemy. If you add a column to a model, you must also add an `ALTER TABLE ... ADD COLUMN` migration inside `init_db()` using `PRAGMA table_info`. SQLite does not support `ALTER TABLE DROP COLUMN` in older versions.

### 5. All frontend API calls go through the Vite proxy
The axios client in `src/api/client.js` uses `baseURL = "/api"`. All calls are `/api/something` → Vite rewrites to `http://127.0.0.1:9001/something`. Never hardcode backend URLs in component code.

### 6. SSE endpoints use `StreamingResponse`
Both `/tests/run` and `/test-cases/run-batch` return `StreamingResponse` with `media_type="text/event-stream"`. On the frontend, `/tests/run` uses the `EventSource` API; `/test-cases/run-batch` uses native `fetch()` with a `ReadableStream` reader.

---

## Backend Patterns

### Adding a new route

1. Create or edit the appropriate file in `backend/routers/`
2. Define a Pydantic model for request body if needed
3. Add `router.include_router(...)` in `backend/main.py` if it's a new file
4. Use `SessionLocal` from `backend/database/db.py` for DB access:

```python
from ..database.db import SessionLocal

@router.get("/example")
def example():
    db = SessionLocal()
    try:
        result = db.query(SomeModel).all()
        return result
    finally:
        db.close()
```

### Saving a trace

Always use the `save_trace()` function — never write Trace rows directly:

```python
from ..services.tracer import save_trace

trace = save_trace(
    endpoint="/products/{id}",
    method="GET",
    url="http://127.0.0.1:8000/products/p001",
    payload={"path_params": {"id": "p001"}, "query_params": {}, "body": None},
    response_body=response.json(),
    status_code=response.status_code,
    time_taken_ms=round(elapsed * 1000, 1),
    source="test_case",  # "portal" | "pytest" | "test_case"
    passed=response.status_code == expected_status,
)
```

### Adding a new DB model column

```python
# In models.py — add the column:
new_field = Column(String, nullable=True)

# In db.py — inside init_db(), add migration:
with engine.connect() as conn:
    existing = {row[1] for row in conn.execute(text("PRAGMA table_info(your_table)"))}
    if "new_field" not in existing:
        conn.execute(text("ALTER TABLE your_table ADD COLUMN new_field VARCHAR"))
        conn.commit()
```

### Logging

Use Python's `logging` module — not `print()`. The root logger is configured in `main.py`:

```python
import logging
log = logging.getLogger("dashboard.your_module")
log.info("[YOUR ACTION] message")
log.error("[YOUR ACTION] ✗ error detail")
```

---

## Frontend Patterns

### Making an API call

```javascript
import client from "../api/client.js";

// GET with query params
const res = await client.get("/traces", { params: { method: "GET", limit: 50 } });

// POST with body
const res = await client.post("/test-cases", { name, endpoint, method, expected_status });

// DELETE
await client.delete(`/test-cases/${testCaseId}`);
```

### Adding a new hook

Create `src/hooks/useYourFeature.js`:

```javascript
import { useState, useCallback } from "react";
import client from "../api/client.js";

export function useYourFeature() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const fetchData = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get("/your-endpoint", { params });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchData };
}
```

### Adding a new page

1. Create `src/pages/YourPage.jsx`
2. Add a route in `App.jsx`:
```javascript
import YourPage from "./pages/YourPage.jsx";
// inside <Routes>:
<Route path="/your-page" element={<YourPage />} />
```
3. Add a `<NavItem>` in the nav bar in `App.jsx`

### Styling conventions

- All styling uses **Tailwind CSS utility classes** — no separate CSS files
- Dark theme: `bg-gray-950` (page bg), `bg-gray-900` (card bg), `bg-gray-800` (input bg)
- Accent: `indigo-600` / `indigo-500` (buttons, active states)
- Success: `emerald-*`, Error: `red-*`, Warning: `yellow-*`
- Text: `text-white` (primary), `text-gray-400` (secondary), `text-gray-600` (muted)
- Borders: `border-gray-800` (card borders), `border-gray-700` (visible borders)

---

## Data Models (Quick Reference)

### Trace
```
trace_id (UUID str), endpoint, method, url,
payload (JSON text), response_body (JSON text),
status_code, time_taken_ms,
source ("portal"|"pytest"|"test_case"),
test_name, test_run_id, tag,
passed (bool|null), error_message, timestamp
```

### TestCase
```
test_case_id (UUID str), name, description,
endpoint, method, base_url,
path_params (JSON text), query_params (JSON text), body (JSON text),
expected_status (int), tag, suite,
status ("draft"|"confirmed"),
last_run_at, last_run_passed, last_run_status,
created_at, updated_at
```

### TestRun
```
run_id (UUID str), triggered_at, completed_at,
duration_ms, total, passed, failed, skipped, target_url
```

---

## Environment Variables

```bash
DASHBOARD_PORT=9001           # Backend port (never 9000 — Zscaler owns it)
DATABASE_URL=sqlite:///./traces.db
CORS_ORIGINS=http://localhost:5173
GENERATED_TESTS_DIR=./generated_tests
PYTEST_TIMEOUT=60
```

---

## Start Commands

```bash
# Backend (from api-dashboard/)
uvicorn backend.main:app --host 127.0.0.1 --port 9001 --reload

# Sample target API (from api-dashboard/)
uvicorn sample_app.main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (from api-dashboard/frontend/)
npm run dev
```

---

## Common Tasks & Where To Go

| Task | File(s) to edit |
|---|---|
| Add a backend route | `backend/routers/<relevant>.py` + `backend/main.py` |
| Add a DB column | `backend/database/models.py` + migration in `backend/database/db.py` |
| Add a frontend page | `src/pages/YourPage.jsx` + route + nav in `src/App.jsx` |
| Add a frontend component | `src/components/YourComponent.jsx` |
| Change API proxy target | `frontend/vite.config.js` |
| Change backend port | `backend/config.py` + `frontend/vite.config.js` + `.env.example` |
| Change CORS origins | `.env` → `CORS_ORIGINS` |
| Debug connectivity | `python diagnose_network.py` (run with all services active) |
| Modify schema parsing | `backend/services/schema_parser.py` |
| Modify test generation | `backend/services/test_generator.py` |
| Add analytics metric | `backend/routers/analytics.py` + `src/hooks/useAnalytics.js` + chart component |

---

## What Not To Do

- **Do not use port 9000** — it is owned by Zscaler on this machine
- **Do not call target APIs directly from the browser** — always go through `/proxy`
- **Do not use `localhost` in server-side httpx calls** — use `127.0.0.1`
- **Do not move `useSchema()` into `Explorer.jsx`** — schema state must survive navigation
- **Do not write raw Trace rows** — always use `save_trace()` from `services/tracer.py`
- **Do not add columns without a migration** — SQLite will throw on startup
- **Do not hardcode port numbers in component files** — use the Vite proxy (`/api/...`)
- **Do not use `print()` in backend code** — use `logging.getLogger()`
- **Do not mock the DB in tests** — integration tests hit the real DB

---

## Diagnostics

If something is broken, run this first:

```bash
# From project root, with all 3 services running:
python diagnose_network.py
```

It checks:
- DNS resolution for `localhost`
- TCP connectivity to each service on all address variants
- HTTP responses at each layer
- What process owns each port
- Full chain: backend calls target API end-to-end

Output tells you exactly which hop is failing and why.
