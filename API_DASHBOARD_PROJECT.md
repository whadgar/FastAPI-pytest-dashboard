# API Dev Dashboard — Full Project Documentation

> A standalone API Observability + Testing Platform that connects to any FastAPI app,
> provides a Swagger-like explorer, auto-generates pytest tests, runs them, and stores
> every request as a traceable record with analytics.

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack](#3-tech-stack)
4. [Directory Structure](#4-directory-structure)
5. [Database Design](#5-database-design)
6. [Backend — Module by Module](#6-backend--module-by-module)
7. [Frontend — Page by Page](#7-frontend--page-by-page)
8. [Sample App](#8-sample-app)
9. [Test Suite](#9-test-suite)
10. [API Reference — Dashboard Backend](#10-api-reference--dashboard-backend)
11. [Data Flow Diagrams](#11-data-flow-diagrams)
12. [Setup & Running Locally](#12-setup--running-locally)
13. [Environment Variables](#13-environment-variables)
14. [Build Phases & Checklist](#14-build-phases--checklist)
15. [Future Enhancements](#15-future-enhancements)

---

## 1. Project Vision

Most teams use Swagger for API exploration and pytest for testing — but they live in completely separate worlds. There is no single place where you can:

- Browse all your endpoints visually
- Fire test requests with a dynamic form (no hardcoding)
- See every request ever made — payload, response, timing
- Run your pytest suite and map results back to each endpoint
- Visualise pass/fail trends, response time graphs, and failure hotspots over time

**This dashboard solves all of that in one place.**

It is a **standalone tool** — you point it at any running FastAPI app via its `openapi.json` URL. The dashboard reads the schema, builds the UI dynamically, proxies your test requests, stores every trace in SQLite, auto-generates pytest files, runs them, and shows you everything in a clean analytics dashboard.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER (React)                   │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │Dashboard │  │  Explorer    │  │   History     │ │
│  │(graphs)  │  │(try-it-out)  │  │(trace table)  │ │
│  └──────────┘  └──────────────┘  └───────────────┘ │
└────────────────────────┬────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────┐
│              DASHBOARD BACKEND (FastAPI)             │
│                                                     │
│  /schema   → fetches openapi.json from target app   │
│  /proxy    → forwards requests   → saves trace      │
│  /tests    → generates pytest file from schema      │
│  /runner   → runs pytest → SSE stream → saves trace │
│  /traces   → CRUD on trace history                  │
│  /analytics→ aggregated queries for graphs          │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
    ┌──────▼──────┐       ┌────────▼────────┐
    │  SQLite DB  │       │  TARGET APP     │
    │ (traces.db) │       │ (your FastAPI)  │
    └─────────────┘       └─────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Dashboard Backend | **FastAPI** | Same ecosystem as target apps, async, great OpenAPI support |
| Database ORM | **SQLAlchemy 2.x** | Mature, supports SQLite natively, easy migration to Postgres |
| Database | **SQLite** | Zero config for local dev, swap to Postgres for production |
| HTTP Client | **httpx** | Async-capable, used to proxy requests to target app |
| Test Runner | **pytest + pytest-json-report** | JSON output makes result parsing trivial |
| Frontend | **React 18 + Vite** | Fast dev server, component model suits complex UI |
| Charts | **Recharts** | Native React, supports pie/line/bar, easy aggregation binding |
| Styling | **Tailwind CSS** | Utility-first, simplistic yet polished |
| SSE Streaming | **FastAPI StreamingResponse** | Streams pytest stdout live to browser |
| API calls (FE) | **axios** | Clean interceptors for global error handling |

---

## 4. Directory Structure

```
api-dashboard/
│
├── sample_app/                        # The FastAPI app the dashboard tests against
│   ├── __init__.py
│   └── main.py                        # Product Inventory API (GET, POST, PUT, DELETE)
│
├── backend/                           # Dashboard backend
│   ├── main.py                        # FastAPI app entry point, registers all routers
│   ├── config.py                      # Settings via pydantic-settings (.env support)
│   │
│   ├── database/
│   │   ├── __init__.py
│   │   ├── db.py                      # SQLAlchemy engine + session factory
│   │   └── models.py                  # ORM models: Trace, TestRun
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── schema.py                  # GET /schema — fetch & parse openapi.json
│   │   ├── proxy.py                   # POST /proxy — forward request, save trace
│   │   ├── generator.py               # POST /tests/generate — build pytest file
│   │   ├── runner.py                  # POST /tests/run — run pytest, SSE stream
│   │   ├── traces.py                  # GET/DELETE /traces — history & filtering
│   │   └── analytics.py               # GET /analytics — aggregated graph data
│   │
│   └── services/
│       ├── __init__.py
│       ├── schema_parser.py           # Parses OpenAPI JSON into structured endpoint list
│       ├── tracer.py                  # Writes every request/response to DB as a Trace
│       ├── test_generator.py          # Generates pytest file from parsed endpoints
│       └── result_parser.py          # Parses pytest JSON report → trace records
│
├── frontend/                          # React dashboard UI
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx                   # React entry point
│       ├── App.jsx                    # Router setup (react-router-dom)
│       ├── api/
│       │   └── client.js              # axios instance pointing to dashboard backend
│       ├── pages/
│       │   ├── Dashboard.jsx          # KPI cards + Pie + Line + Bar charts
│       │   ├── Explorer.jsx           # Sidebar + dynamic form + response panel
│       │   └── History.jsx            # Trace table with filters and grouping
│       ├── components/
│       │   ├── Sidebar.jsx            # Endpoint list grouped by OpenAPI tags
│       │   ├── DynamicForm.jsx        # Auto-renders path/query/body fields from schema
│       │   ├── ResponsePanel.jsx      # Shows status, time, headers, body for a request
│       │   ├── TraceCard.jsx          # Single trace detail (expandable)
│       │   ├── TestRunner.jsx         # Pytest controls + live SSE log output
│       │   ├── charts/
│       │   │   ├── PassFailPie.jsx    # Recharts PieChart: pass vs fail
│       │   │   ├── ResponseTimeLine.jsx # Recharts LineChart: response time over time
│       │   │   └── CallsPerEndpoint.jsx # Recharts BarChart: volume per endpoint
│       │   └── shared/
│       │       ├── Badge.jsx          # Status code badge (green/red/yellow)
│       │       ├── Spinner.jsx
│       │       └── EmptyState.jsx
│       └── hooks/
│           ├── useSchema.js           # Fetches + caches parsed schema from backend
│           ├── useTraces.js           # Fetches trace history with filter params
│           ├── useAnalytics.js        # Fetches aggregated data for charts
│           └── useTestRun.js          # Manages SSE connection for live pytest output
│
├── generated_tests/
│   └── test_generated.py              # Auto-generated by the dashboard — do not edit manually
│
├── traces.db                          # SQLite database (auto-created on first run)
├── requirements.txt                   # Python dependencies
├── .env.example                       # Example environment config
└── README.md                          # Quick start guide
```

---

## 5. Database Design

### Table: `traces`

Every single API call — whether fired from the portal explorer or executed by pytest — writes one row here.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `trace_id` | TEXT UNIQUE | UUID, e.g. `a3f9c1d2-...` |
| `endpoint` | TEXT | Path template, e.g. `/products/{product_id}` |
| `method` | TEXT | `GET`, `POST`, `PUT`, `DELETE` |
| `url` | TEXT | Full resolved URL called |
| `payload` | TEXT | JSON string: `{path_params, query_params, body}` |
| `response_body` | TEXT | JSON string of response |
| `status_code` | INTEGER | HTTP status code |
| `time_taken_ms` | REAL | Request duration in milliseconds |
| `source` | TEXT | `"portal"` or `"pytest"` |
| `test_name` | TEXT | Nullable — pytest test function name |
| `test_run_id` | TEXT | Nullable — FK to `test_runs.run_id` |
| `tag` | TEXT | OpenAPI tag the endpoint belongs to |
| `passed` | BOOLEAN | Nullable — True/False for test traces, NULL for manual |
| `error_message` | TEXT | Nullable — assertion or exception message if failed |
| `timestamp` | DATETIME | UTC timestamp of the call |

---

### Table: `test_runs`

One row per full pytest session.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `run_id` | TEXT UNIQUE | UUID |
| `triggered_at` | DATETIME | UTC start time |
| `completed_at` | DATETIME | UTC end time |
| `duration_ms` | REAL | Total run duration |
| `total` | INTEGER | Total tests collected |
| `passed` | INTEGER | Number passed |
| `failed` | INTEGER | Number failed |
| `skipped` | INTEGER | Number skipped |
| `target_url` | TEXT | The app URL tests ran against |

---

### SQLAlchemy Models (backend/database/models.py)

```python
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class Trace(Base):
    __tablename__ = "traces"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    trace_id      = Column(String, unique=True, default=lambda: str(uuid.uuid4()))
    endpoint      = Column(String, nullable=False)
    method        = Column(String, nullable=False)
    url           = Column(String, nullable=False)
    payload       = Column(Text, default="{}")
    response_body = Column(Text, default="{}")
    status_code   = Column(Integer)
    time_taken_ms = Column(Float)
    source        = Column(String, default="portal")   # "portal" | "pytest"
    test_name     = Column(String, nullable=True)
    test_run_id   = Column(String, nullable=True)
    tag           = Column(String, nullable=True)
    passed        = Column(Boolean, nullable=True)
    error_message = Column(Text, nullable=True)
    timestamp     = Column(DateTime, default=datetime.utcnow)


class TestRun(Base):
    __tablename__ = "test_runs"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    run_id       = Column(String, unique=True, default=lambda: str(uuid.uuid4()))
    triggered_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_ms  = Column(Float, nullable=True)
    total        = Column(Integer, default=0)
    passed       = Column(Integer, default=0)
    failed       = Column(Integer, default=0)
    skipped      = Column(Integer, default=0)
    target_url   = Column(String, nullable=True)
```

---

## 6. Backend — Module by Module

### `backend/main.py`
Entry point. Creates the FastAPI app, initialises the DB (creates tables on startup), registers all routers, and adds CORS middleware so the React frontend can communicate.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.db import init_db
from routers import schema, proxy, generator, runner, traces, analytics

app = FastAPI(title="API Dev Dashboard", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    init_db()

app.include_router(schema.router,    prefix="/schema",    tags=["Schema"])
app.include_router(proxy.router,     prefix="/proxy",     tags=["Proxy"])
app.include_router(generator.router, prefix="/tests",     tags=["Tests"])
app.include_router(runner.router,    prefix="/tests",     tags=["Tests"])
app.include_router(traces.router,    prefix="/traces",    tags=["Traces"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
```

---

### `backend/routers/schema.py`
Fetches `openapi.json` from any URL the user provides and returns a clean structured list of endpoints.

**Endpoint:** `GET /schema?url=http://localhost:8000`

**Returns:**
```json
{
  "title": "Product Inventory API",
  "version": "1.0.0",
  "base_url": "http://localhost:8000",
  "endpoints": [
    {
      "path": "/products/{product_id}",
      "method": "GET",
      "summary": "Get product by ID",
      "tag": "products",
      "path_params": [{"name": "product_id", "type": "string", "required": true}],
      "query_params": [],
      "request_body": null,
      "responses": {"200": "ProductResponse", "404": "ErrorResponse"}
    }
  ]
}
```

The `schema_parser.py` service handles all the OpenAPI traversal logic — extracting `paths`, resolving `$ref` references in request bodies, and mapping parameter locations (`path`, `query`, `body`).

---

### `backend/routers/proxy.py`
Takes a request from the portal, forwards it to the target app using `httpx`, records the full trace (payload + response + timing), saves it to DB, and returns everything back to the frontend.

**Endpoint:** `POST /proxy`

**Request body:**
```json
{
  "base_url": "http://localhost:8000",
  "endpoint": "/products/{product_id}",
  "method": "GET",
  "path_params": {"product_id": "p001"},
  "query_params": {},
  "body": null,
  "tag": "products"
}
```

**Response:**
```json
{
  "trace_id": "a3f9c1d2-...",
  "status_code": 200,
  "time_taken_ms": 12.4,
  "response_body": {"id": "p001", "name": "Wireless Mouse", ...},
  "passed": null
}
```

The `tracer.py` service handles all DB writes so the proxy router stays clean.

---

### `backend/routers/generator.py`
Reads the parsed schema and generates a `generated_tests/test_generated.py` file with pytest test cases per endpoint.

**Endpoint:** `POST /tests/generate`

**Request body:**
```json
{
  "base_url": "http://localhost:8000",
  "schema_url": "http://localhost:8000/openapi.json"
}
```

**What gets generated per endpoint:**
- **Happy path** — uses example values from the schema, asserts `2xx` status
- **Validation error** — sends empty/invalid body, asserts `422`
- **Not found** — uses a fake ID, asserts `404` (for endpoints with path params)

Example generated test:
```python
def test_get_products_happy_path():
    """GET /products — expects 200"""
    response = httpx.get(f"{BASE_URL}/products", timeout=10)
    assert response.status_code == 200

def test_create_product_happy_path():
    """POST /products — expects 201"""
    payload = {"name": "Test Product", "category": "Electronics", "price": 9.99, "stock": 10}
    response = httpx.post(f"{BASE_URL}/products", json=payload, timeout=10)
    assert response.status_code == 201

def test_create_product_validation_error():
    """POST /products — missing required fields, expects 422"""
    response = httpx.post(f"{BASE_URL}/products", json={}, timeout=10)
    assert response.status_code == 422
```

---

### `backend/routers/runner.py`
Runs pytest as a subprocess, streams stdout line-by-line via **Server-Sent Events (SSE)**, then parses the JSON report and saves each test result as a `Trace` row linked to a `TestRun`.

**Endpoint:** `POST /tests/run` → `text/event-stream`

**SSE stream format:**
```
data: {"type": "log",    "line": "collected 9 items"}
data: {"type": "log",    "line": "PASSED test_generated.py::test_get_products_happy_path"}
data: {"type": "log",    "line": "FAILED test_generated.py::test_create_product_validation_error"}
data: {"type": "result", "run_id": "...", "passed": 7, "failed": 2, "total": 9}
data: {"type": "done"}
```

**How it works:**
1. Runs: `pytest generated_tests/ --json-report --json-report-file=report.json -v`
2. Streams stdout in real time to the browser
3. After completion, reads `report.json`
4. Calls `result_parser.py` to map each test result to endpoint + payload
5. Writes one `Trace` row per test, all linked to one `TestRun` row

---

### `backend/routers/traces.py`
Full CRUD + filtering on the trace history.

| Endpoint | Description |
|---|---|
| `GET /traces` | List traces with filters |
| `GET /traces/{trace_id}` | Single trace detail |
| `DELETE /traces/{trace_id}` | Delete one trace |
| `DELETE /traces` | Bulk delete (by filter) |

**Filter params for `GET /traces`:**
```
endpoint, method, status_code, source, tag,
passed, from_date, to_date, test_run_id,
group_by (endpoint | tag | date | test_run),
limit, offset
```

---

### `backend/routers/analytics.py`
Aggregation queries that power the dashboard charts.

| Endpoint | Returns | Chart |
|---|---|---|
| `GET /analytics/pass-fail` | `{passed: N, failed: N, total: N}` | Pie chart |
| `GET /analytics/response-times` | `[{timestamp, avg_ms, endpoint}]` | Line chart |
| `GET /analytics/calls-per-endpoint` | `[{endpoint, count, method}]` | Bar chart |
| `GET /analytics/status-codes` | `[{status_code, count}]` | Bar chart |
| `GET /analytics/summary` | KPI cards data | Cards |

All endpoints accept optional `from_date` and `to_date` query params for time-range filtering.

---

## 7. Frontend — Page by Page

### Page 1: Dashboard (Home)

The landing page. Shows the overall health of all API testing at a glance.

**Components:**
- **KPI Cards row** — Total traces | Total test runs | Avg response time | Overall pass rate %
- **Pass/Fail Pie** (`PassFailPie.jsx`) — Ratio of passed vs failed across all test traces
- **Response Time Line** (`ResponseTimeLine.jsx`) — Average response time per endpoint over time. X-axis: date, Y-axis: ms, one line per endpoint
- **Calls Per Endpoint Bar** (`CallsPerEndpoint.jsx`) — How many times each endpoint has been called, coloured by pass/fail
- **Recent Traces Table** — Last 10 traces with status badge, endpoint, method, time taken

---

### Page 2: Explorer

The API try-it-out interface. Works like Swagger UI but with tracing built in.

**Layout:**
```
┌─────────────────┬───────────────────────────────────┐
│   SIDEBAR       │   ENDPOINT PANEL                  │
│                 │                                   │
│  ▼ products     │  GET /products/{product_id}       │
│    GET /products│  ─────────────────────────────    │
│  ► GET /{id}    │  Path Params                      │
│    POST /       │    product_id: [__________]       │
│    PUT /{id}    │                                   │
│    DELETE /{id} │  Query Params                     │
│                 │    (none)                         │
│  ▼ health       │                                   │
│    GET /health  │  [ Send Request ]                 │
│                 │  ─────────────────────────────    │
│  ─────────────  │  ✅ 200 OK  |  12.4ms             │
│  [Generate      │  {                                │
│   Tests]        │    "id": "p001",                  │
│  [Run Tests]    │    "name": "Wireless Mouse"       │
│                 │  }                                │
└─────────────────┴───────────────────────────────────┘
```

**DynamicForm.jsx** — This is the core component. It reads the parsed endpoint schema and renders:
- **Path params** → text input per param (e.g. `product_id`)
- **Query params** → text/checkbox/number input based on schema type
- **Request body** → JSON editor (textarea with syntax highlight) pre-filled with the schema's example values

When the user clicks **Send Request**:
1. Calls `POST /proxy` on the dashboard backend
2. Shows the response (status badge, time taken, formatted JSON body)
3. The trace is automatically saved — user sees a small `✓ Trace saved` indicator

---

### Page 3: History

Full searchable, filterable, groupable trace history.

**Features:**
- **Filter bar** — endpoint (dropdown), method, status code, source (portal/pytest), date range, tag
- **Group by** toggle — None | Endpoint | Tag | Test Run | Date
- **Table columns** — timestamp, endpoint, method, status, time_ms, source, pass/fail badge
- **Click a row** → expands `TraceCard` showing full payload + response body + error message if any
- **Export button** → downloads filtered results as CSV

---

### `DynamicForm.jsx` — Detailed Logic

This component is critical — it's what makes the portal actually usable for any API.

```
Input: endpoint object from schema parser
  {
    path: "/products/{product_id}",
    method: "PUT",
    path_params: [{name: "product_id", type: "string", required: true}],
    query_params: [],
    request_body: {
      type: "object",
      properties: {
        name:     {type: "string"},
        price:    {type: "number"},
        stock:    {type: "integer"},
        category: {type: "string"}
      },
      required: ["name"]
    }
  }

Output: Rendered form with:
  - Text input labeled "product_id" (path param, marked required)
  - JSON editor pre-filled with: {"name": "", "price": 0, "stock": 0, "category": ""}
```

Type mapping for form fields:

| OpenAPI type | Form element |
|---|---|
| `string` | `<input type="text">` |
| `integer` / `number` | `<input type="number">` |
| `boolean` | `<input type="checkbox">` |
| `object` | JSON textarea editor |
| `array` | JSON textarea editor |

---

## 8. Sample App

**Location:** `sample_app/main.py`

A fully working Product Inventory API used to develop and test the dashboard against. It uses an in-memory dict as a fake database so it needs no setup.

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check, returns status + product count |
| `GET` | `/products` | List all products (filter by category, in_stock, price range) |
| `GET` | `/products/{product_id}` | Get single product by ID |
| `POST` | `/products` | Create a new product |
| `PUT` | `/products/{product_id}` | Update an existing product |
| `DELETE` | `/products/{product_id}` | Delete a product |

### Seed Data

The app starts with 3 products pre-loaded:

| ID | Name | Category | Price | Stock |
|---|---|---|---|---|
| p001 | Wireless Mouse | Electronics | $29.99 | 150 |
| p002 | Mechanical Keyboard | Electronics | $89.99 | 75 |
| p003 | USB-C Hub | Accessories | $45.00 | 0 (out of stock) |

### Validation Rules

- `name` — 2–100 chars, must be unique (409 if duplicate)
- `category` — 2–50 chars
- `price` — must be `> 0`, auto-rounded to 2 decimal places
- `stock` — must be `>= 0`

### Status Codes Used

| Code | When |
|---|---|
| `200` | Successful GET / PUT |
| `201` | Successful POST (created) |
| `204` | Successful DELETE (no content) |
| `404` | Product ID not found |
| `409` | Duplicate product name on POST |
| `422` | Validation error (missing/invalid fields) |

---

## 9. Test Suite

**Location:** `sample_app/tests/test_main.py`

Uses `fastapi.testclient.TestClient` — no running server needed.

### Test Coverage

| Category | Tests |
|---|---|
| Health check | Returns 200, correct fields present |
| List products | Returns all 3 seeds, filter by category, filter by in_stock, filter by price range |
| Get product | Returns correct product, 404 for unknown ID |
| Create product | 201 with valid data, 409 on duplicate name, 422 on missing fields, 422 on negative price |
| Update product | Partial update works, full update works, 404 for unknown ID |
| Delete product | 204 on success, 404 on unknown ID, product actually removed |
| Edge cases | Empty string fields, zero stock allowed, price rounding |

### Fixtures

```python
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(autouse=True)
def reset_products():
    # Restores seed data before every test — tests are fully independent
    ...
```

### Running Tests

```bash
# Basic run
pytest sample_app/tests/test_main.py -v

# With JSON report (for dashboard integration)
pytest sample_app/tests/test_main.py -v --json-report --json-report-file=report.json

# With coverage
pytest sample_app/tests/test_main.py -v --cov=sample_app --cov-report=term-missing
```

---

## 10. API Reference — Dashboard Backend

### Schema Router

```
GET /schema?url={openapi_url}
  → Fetches and parses openapi.json from any URL
  → Returns structured endpoint list with param shapes
```

### Proxy Router

```
POST /proxy
  Body: { base_url, endpoint, method, path_params, query_params, body, tag }
  → Forwards request to target app
  → Saves trace to DB
  → Returns: { trace_id, status_code, time_taken_ms, response_body }
```

### Test Generator

```
POST /tests/generate
  Body: { base_url, schema_url }
  → Writes generated_tests/test_generated.py
  → Returns: { file_path, test_count, endpoints_covered }
```

### Test Runner

```
POST /tests/run
  Body: { target_url }
  → Runs pytest, streams SSE
  → Event types: "log" | "result" | "done" | "error"
```

### Traces Router

```
GET    /traces                  → List with filters
GET    /traces/{trace_id}       → Single trace
DELETE /traces/{trace_id}       → Delete one
DELETE /traces?endpoint=...     → Bulk delete by filter
```

### Analytics Router

```
GET /analytics/summary          → KPI card data
GET /analytics/pass-fail        → Pie chart data
GET /analytics/response-times   → Line chart data
GET /analytics/calls-per-endpoint → Bar chart data
GET /analytics/status-codes     → Status distribution
```

---

## 11. Data Flow Diagrams

### Flow 1: User fires a request from Explorer

```
User fills DynamicForm → clicks Send
         ↓
Frontend: POST /proxy  {base_url, endpoint, method, params, body}
         ↓
proxy.py: resolves path params → builds full URL
         ↓
httpx.request(method, url, params, json) → target app
         ↓
Record start time → get response → record end time
         ↓
tracer.py: save Trace row {endpoint, method, payload, response, status, ms, source="portal"}
         ↓
Return to frontend: {trace_id, status_code, time_ms, response_body}
         ↓
ResponsePanel renders result + "Trace saved ✓"
```

---

### Flow 2: User generates and runs tests

```
User clicks "Generate Tests"
         ↓
POST /tests/generate {base_url, schema_url}
         ↓
schema_parser.py: parse all endpoints + example values
         ↓
test_generator.py: write test_generated.py
         ↓
Return: {test_count, file_path}
         ↓
User clicks "Run Tests"
         ↓
POST /tests/run  →  SSE stream opens in browser
         ↓
subprocess: pytest generated_tests/ --json-report -v
         ↓
stdout lines → SSE events → live log in TestRunner.jsx
         ↓
pytest finishes → read report.json
         ↓
result_parser.py: map each test → {endpoint, passed, error_message}
         ↓
tracer.py: save one Trace per test, all linked to one TestRun
         ↓
SSE: final "result" event with summary → SSE: "done"
         ↓
Frontend: History + Dashboard update with new data
```

---

## 12. Setup & Running Locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- pip, npm

---

### Step 1 — Clone and install backend

```bash
cd api-dashboard
pip install -r requirements.txt
```

**requirements.txt:**
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.35
httpx==0.27.0
pydantic-settings==2.5.0
pytest==8.3.0
pytest-json-report==1.5.0
pytest-asyncio==0.24.0
```

---

### Step 2 — Start the sample app

```bash
uvicorn sample_app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` to confirm it's running.

---

### Step 3 — Start the dashboard backend

```bash
uvicorn backend.main:app --reload --port 9000
```

The SQLite database `traces.db` is created automatically on first start.

---

### Step 4 — Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` — the dashboard is live.

---

### Step 5 — Connect to the sample app

In the dashboard, enter:
```
http://localhost:8000
```

Click **Load Schema** — all 6 endpoints appear in the sidebar. Start exploring, testing, and running pytest from the UI.

---

## 13. Environment Variables

Create a `.env` file in the project root:

```env
# Dashboard backend settings
DASHBOARD_PORT=9000
DATABASE_URL=sqlite:///./traces.db
CORS_ORIGINS=http://localhost:5173
GENERATED_TESTS_DIR=./generated_tests

# Pytest settings
PYTEST_TIMEOUT=60
```

`.env.example` is committed to the repo. `.env` is gitignored.

---

## 14. Build Phases & Checklist

### Phase 1 — Core Backend ✅ (start here)
- [ ] `database/models.py` — Trace + TestRun ORM models
- [ ] `database/db.py` — SQLAlchemy engine, session, init_db
- [ ] `services/tracer.py` — save_trace() function
- [ ] `routers/schema.py` + `services/schema_parser.py`
- [ ] `routers/proxy.py` — proxy + trace save
- [ ] `backend/main.py` — wire everything up

### Phase 2 — Test Pipeline
- [ ] `services/test_generator.py` — generate pytest file from schema
- [ ] `routers/generator.py` — expose generator via API
- [ ] `services/result_parser.py` — parse pytest JSON report
- [ ] `routers/runner.py` — SSE streaming pytest runner

### Phase 3 — Trace History & Analytics
- [ ] `routers/traces.py` — list/filter/delete traces
- [ ] `routers/analytics.py` — aggregation queries

### Phase 4 — Frontend
- [ ] Project scaffold: Vite + React + Tailwind + Recharts + axios
- [ ] `App.jsx` + router setup
- [ ] `api/client.js`
- [ ] `Sidebar.jsx` + `useSchema.js`
- [ ] `DynamicForm.jsx` — the most complex component
- [ ] `ResponsePanel.jsx`
- [ ] `Explorer.jsx` — wires sidebar + form + response together
- [ ] `Dashboard.jsx` — KPI cards + 3 charts
- [ ] `History.jsx` — trace table + filters
- [ ] `TestRunner.jsx` — SSE log + run button

### Phase 5 — Sample App Tests
- [ ] `sample_app/tests/test_main.py` — full test suite

---

## 15. Future Enhancements

| Feature | Description |
|---|---|
| **Auth support** | Add Bearer token / API key fields to proxy requests |
| **Environments** | Save multiple target URLs (dev/staging/prod) and switch between them |
| **Test editing** | Edit generated tests inline in the portal before running |
| **Scheduled runs** | Run pytest on a cron schedule, track pass/fail trends over time |
| **PostgreSQL** | Swap SQLite for Postgres for team/multi-user use |
| **Export** | Export traces as CSV or Postman collection JSON |
| **Webhooks** | Post test results to Slack / Teams on completion |
| **Diff view** | Compare response body between two traces side by side |
| **WebSocket support** | Extend beyond REST to test WebSocket endpoints |

---

*Document version: 1.0 — corresponds to Phase 1 build start*
*Last updated: April 2026*
