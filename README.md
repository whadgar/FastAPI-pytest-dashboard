# ⚡ API Dev Dashboard

A local-first developer tool for exploring, testing, and monitoring REST APIs — built with FastAPI, React, and SQLite.

Point it at any OpenAPI-compliant API, explore endpoints interactively, save test cases, run them in batch, and track every request in a searchable history with analytics.

![Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.11%2B-blue) ![React](https://img.shields.io/badge/react-18-61DAFB) ![FastAPI](https://img.shields.io/badge/fastapi-0.110%2B-009688) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Features

| Feature | Description |
|---|---|
| **Schema Explorer** | Load any OpenAPI 3.x API by URL, browse endpoints grouped by tag |
| **Interactive Forms** | Auto-generated forms for path params, query params, and JSON body |
| **Request Proxy** | Fire requests through the dashboard — every call is recorded |
| **Test Cases** | Save requests as named test cases, organise by suite and tag |
| **Batch Runner** | Run test cases at suite / tag / all level, live-streamed results |
| **History** | Searchable, filterable log of every API call with timing |
| **Analytics** | Pass/fail charts, response time trends, calls-per-endpoint |
| **Test Generation** | Auto-generate pytest files from any OpenAPI schema |
| **Diagnostics** | Built-in connection diagnostics for troubleshooting API reachability |

---

## Project Structure

```
project-apimu/
├── api-dashboard/
│   ├── backend/                    # FastAPI application
│   │   ├── main.py                 # App entry point, middleware, router mounts
│   │   ├── config.py               # Pydantic settings (reads .env)
│   │   ├── database/
│   │   │   ├── db.py               # SQLAlchemy engine, session, init_db()
│   │   │   └── models.py           # ORM models: Trace, TestRun, TestCase
│   │   ├── routers/
│   │   │   ├── schema.py           # GET  /schema
│   │   │   ├── proxy.py            # POST /proxy
│   │   │   ├── generator.py        # POST /tests/generate
│   │   │   ├── runner.py           # POST /tests/run  (SSE)
│   │   │   ├── traces.py           # GET/DELETE /traces
│   │   │   ├── analytics.py        # GET /analytics/*
│   │   │   └── test_cases.py       # CRUD + run /test-cases
│   │   └── services/
│   │       ├── schema_parser.py    # Parse OpenAPI JSON → endpoint list
│   │       ├── test_generator.py   # Generate pytest file from endpoints
│   │       ├── tracer.py           # Persist traces to DB
│   │       └── result_parser.py    # Parse pytest-json-report → traces
│   │
│   ├── frontend/                   # React + Vite application
│   │   ├── vite.config.js          # Dev server + /api proxy config
│   │   └── src/
│   │       ├── App.jsx             # Router, nav, global schema state
│   │       ├── pages/
│   │       │   ├── Dashboard.jsx   # KPIs and charts
│   │       │   ├── Explorer.jsx    # Interactive API explorer
│   │       │   ├── History.jsx     # Trace browser
│   │       │   └── TestCases.jsx   # Test case manager and runner
│   │       ├── components/         # Shared UI components
│   │       └── hooks/              # Data-fetching hooks (axios + SSE)
│   │
│   ├── sample_app/                 # Example target API (Product Inventory)
│   │   ├── main.py                 # FastAPI app with CRUD endpoints
│   │   └── tests/
│   │       └── test_main.py        # pytest integration tests
│   │
│   ├── generated_tests/            # Output directory for auto-generated pytest files
│   ├── .env.example                # Environment variable template
│   └── traces.db                   # SQLite database (auto-created on first run)
│
└── diagnose_network.py             # Standalone network diagnostics script
```

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend dev server |
| npm | 9+ | Frontend package manager |

---

## Quick Start

### 1. Clone the repository

```bash
git clone <repo-url>
cd project-apimu
```

### 2. Set up the Python environment

```bash
cd api-dashboard
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env if you need non-default ports (defaults work out of the box)
```

### 4. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 5. Start all three services (3 separate terminals)

**Terminal 1 — Sample target API**
```bash
cd api-dashboard
uvicorn sample_app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Dashboard backend**
```bash
cd api-dashboard
uvicorn backend.main:app --host 127.0.0.1 --port 9001 --reload
```

**Terminal 3 — Frontend**
```bash
cd api-dashboard/frontend
npm run dev
```

### 6. Open the dashboard

```
http://localhost:5173
```

In the Explorer page, enter `http://127.0.0.1:8000` and click **Load Schema** to explore the sample Product Inventory API.

---

## Configuration

All settings are read from `api-dashboard/.env` (copy from `.env.example`).

| Variable | Default | Description |
|---|---|---|
| `DASHBOARD_PORT` | `9001` | Backend server port |
| `DATABASE_URL` | `sqlite:///./traces.db` | Database connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `GENERATED_TESTS_DIR` | `./generated_tests` | Output directory for generated pytest files |
| `PYTEST_TIMEOUT` | `60` | Timeout (seconds) for pytest runs |

> **Port 9000 conflict:** Port 9000 is commonly used by enterprise security tools (e.g., Zscaler). The dashboard defaults to **9001** to avoid this conflict. Run `netstat -ano | findstr ":9000"` to verify port availability before changing.

---

## Usage Guide

### Explorer

1. Enter the base URL of any OpenAPI-compatible API (e.g., `http://127.0.0.1:8000`)
2. Click **Load Schema** — endpoints appear in the sidebar grouped by tag
3. Select an endpoint to see its auto-generated form
4. Fill in params/body and click **Send** — response appears with status, timing, and body
5. Click **Add to Test Cases** to save the request for later

### Test Cases

1. Navigate to **Test Cases**
2. Saved cases appear as cards with last-run status
3. Use suite/tag filters to narrow down
4. Click **Run** on a card to execute a single test (live result shown inline)
5. Use **Run Suite / Run Tag / Run All** to batch-execute and see streamed results

### History

1. Navigate to **History**
2. Filter by method, source (portal / pytest / test_case), or pass/fail
3. Click a row to expand full request + response detail
4. Export filtered results as CSV

### Dashboard

Real-time metrics from all recorded traces:
- **Pass rate** across all test executions
- **Response time trends** per endpoint over time
- **Calls per endpoint** — see which endpoints are hit most
- **Recent activity** — last 10 traces

### Diagnostics

If **Load Schema** fails, a **Diagnose Connection** button appears. It tests:
- DNS resolution of `localhost`
- TCP reachability on each address variant
- HTTP response from the target API
- Full chain: backend → target → parse

---

## API Reference

The dashboard backend exposes a self-documenting API at:

```
http://127.0.0.1:9001/docs      # Swagger UI
http://127.0.0.1:9001/redoc     # ReDoc
```

### Key endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/schema` | Fetch and parse OpenAPI schema from `?url=` |
| `GET` | `/schema/diagnose` | Run connectivity diagnostics for `?url=` |
| `POST` | `/proxy` | Forward a request to target API and record trace |
| `POST` | `/tests/generate` | Generate pytest file from API schema |
| `POST` | `/tests/run` | Run generated pytest file (SSE stream) |
| `GET` | `/traces` | Query recorded traces with filters |
| `DELETE` | `/traces/{id}` | Delete a single trace |
| `GET` | `/analytics/summary` | Aggregate KPIs |
| `GET` | `/test-cases` | List all saved test cases |
| `POST` | `/test-cases` | Create a test case |
| `PUT` | `/test-cases/{id}` | Update a test case |
| `DELETE` | `/test-cases/{id}` | Delete a test case |
| `POST` | `/test-cases/{id}/run` | Execute a single test case |
| `POST` | `/test-cases/run-batch` | Batch run test cases (SSE stream) |

---

## Running Tests

### Sample app unit tests

```bash
cd api-dashboard
pytest sample_app/tests/ -v
```

### Auto-generated API tests

```bash
# First generate tests from the Explorer UI (Generate Tests button)
# Then run the output file:
cd api-dashboard
pytest generated_tests/test_generated.py -v
```

### Network diagnostics

```bash
# Run with all three services active to check connectivity
python diagnose_network.py
```

---

## Troubleshooting

### Load Schema times out

1. Run `python diagnose_network.py` to identify which hop is failing
2. Check that the target API is running and reachable via `127.0.0.1` (not `localhost`)
3. Verify no other process owns port 9001: `netstat -ano | findstr ":9001"`

### Backend not reachable from browser

- The Vite proxy targets `http://127.0.0.1:9001` — start the backend with `--host 127.0.0.1`
- On Windows, check if a corporate security tool (Zscaler, VPN agent) has claimed the port

### Blank UI after code changes

```bash
# Clear Vite cache
cd frontend
rm -rf node_modules/.vite
npm run dev
```

### `suite` column missing error

The DB migrates automatically on startup via `init_db()`. If you see this error, restart the backend — it will apply the migration.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Run `pytest sample_app/tests/` to verify
5. Open a pull request with a clear description

Please follow existing code style — no unnecessary abstractions, no unused imports, comments only where the *why* is non-obvious.

---

## License

MIT — see [LICENSE](LICENSE) for details.
