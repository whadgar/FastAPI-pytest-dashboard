# Architecture — API Dev Dashboard

---

## 1. System Overview

The dashboard is a three-process local application:

```
┌─────────────────────────────────────────────────────┐
│                  Developer's Machine                │
│                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌────────┐ │
│  │  Frontend    │    │  Backend     │    │ Target │ │
│  │  React/Vite  │◄──►│  FastAPI     │◄──►│  API   │ │
│  │  :5173       │    │  :9001       │    │  :8000 │ │
│  └──────────────┘    └──────┬───────┘    └────────┘ │
│                             │                       │
│                      ┌──────▼───────┐               │
│                      │   SQLite     │               │
│                      │   traces.db  │               │
│                      └──────────────┘               │
└─────────────────────────────────────────────────────┘
```

| Process | Technology | Port | Role |
|---|---|---|---|
| Frontend | React 18 + Vite + Tailwind | 5173 | UI, state management |
| Backend | FastAPI + SQLAlchemy | 9001 | API proxy, data persistence, analytics |
| Sample API | FastAPI | 8000 | Example target API for testing |

The frontend never calls the target API directly. All requests are proxied through the backend, which records every call as a trace.

---

## 2. Application Workflow

```mermaid
flowchart TD
    User["👤 Developer"]

    subgraph Frontend["Frontend :5173"]
        Explorer["Explorer Page"]
        TestCasesPage["Test Cases Page"]
        HistoryPage["History Page"]
        DashboardPage["Dashboard Page"]
    end

    subgraph Backend["Backend :9001"]
        SchemaRouter["/schema"]
        ProxyRouter["/proxy"]
        TestCasesRouter["/test-cases"]
        TracesRouter["/traces"]
        AnalyticsRouter["/analytics"]
        GeneratorRouter["/tests/generate"]
        RunnerRouter["/tests/run SSE"]
    end

    subgraph Services["Backend Services"]
        SchemaParser["schema_parser.py"]
        Tracer["tracer.py"]
        TestGenerator["test_generator.py"]
        ResultParser["result_parser.py"]
    end

    DB[("SQLite\ntraces.db")]
    TargetAPI["Target API :8000"]
    PyTestProcess["pytest subprocess"]

    User -->|"Enter URL + Load Schema"| Explorer
    Explorer -->|"GET /api/schema?url=..."| SchemaRouter
    SchemaRouter -->|"GET /openapi.json"| TargetAPI
    SchemaRouter --> SchemaParser
    SchemaParser -->|"Parsed endpoints"| Explorer

    User -->|"Fill form + Send"| Explorer
    Explorer -->|"POST /api/proxy"| ProxyRouter
    ProxyRouter -->|"HTTP request"| TargetAPI
    ProxyRouter --> Tracer
    Tracer -->|"INSERT trace"| DB

    User -->|"Add to Test Cases"| Explorer
    Explorer -->|"POST /api/test-cases"| TestCasesRouter
    TestCasesRouter -->|"INSERT test_case"| DB

    User -->|"Run batch"| TestCasesPage
    TestCasesPage -->|"POST /api/test-cases/run-batch SSE"| TestCasesRouter
    TestCasesRouter -->|"HTTP per case"| TargetAPI
    TestCasesRouter --> Tracer

    User -->|"Generate Tests"| Explorer
    Explorer -->|"POST /api/tests/generate"| GeneratorRouter
    GeneratorRouter --> TestGenerator
    TestGenerator -->|"Write .py file"| PyTestProcess

    User -->|"Run pytest"| RunnerRouter
    RunnerRouter -->|"subprocess"| PyTestProcess
    PyTestProcess -->|"report.json"| ResultParser
    ResultParser --> Tracer

    User -->|"Browse history"| HistoryPage
    HistoryPage -->|"GET /api/traces"| TracesRouter
    TracesRouter -->|"SELECT"| DB

    User -->|"View charts"| DashboardPage
    DashboardPage -->|"GET /api/analytics/*"| AnalyticsRouter
    AnalyticsRouter -->|"SELECT aggregate"| DB
```

---

## 3. User Workflow

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant UI as Frontend :5173
    participant BE as Backend :9001
    participant API as Target API :8000
    participant DB as SQLite

    Note over Dev,DB: ── Load Schema ──────────────────────────────
    Dev->>UI: Enter URL, click Load Schema
    UI->>BE: GET /schema?url=http://127.0.0.1:8000
    BE->>API: GET /openapi.json
    API-->>BE: OpenAPI JSON
    BE-->>UI: Parsed endpoint list
    UI-->>Dev: Sidebar populated with endpoints

    Note over Dev,DB: ── Explore & Send Request ───────────────────
    Dev->>UI: Select endpoint, fill form, click Send
    UI->>BE: POST /proxy {endpoint, method, params, body}
    BE->>API: HTTP request (path params resolved)
    API-->>BE: Response {status, body, headers}
    BE->>DB: INSERT trace (source=portal)
    BE-->>UI: {status_code, body, time_taken_ms}
    UI-->>Dev: Response panel with result

    Note over Dev,DB: ── Save as Test Case ─────────────────────────
    Dev->>UI: Click "Add to Test Cases", fill modal
    UI->>BE: POST /test-cases {name, suite, tag, expected_status}
    BE->>DB: INSERT test_case
    BE-->>UI: Saved test case
    UI-->>Dev: Confirmation + link to Test Cases page

    Note over Dev,DB: ── Run Batch ─────────────────────────────────
    Dev->>UI: Go to Test Cases, click "Run Suite X"
    UI->>BE: POST /test-cases/run-batch {suite: "X"} (SSE)
    loop For each test case in suite
        BE->>API: HTTP request
        API-->>BE: Response
        BE->>DB: INSERT trace (source=test_case), UPDATE test_case last_run_*
        BE-->>UI: SSE event {index, total, name, passed, status_code}
    end
    BE-->>UI: SSE event {type: done, summary}
    UI-->>Dev: Live results + final summary
```

---

## 4. Backend Architecture

```mermaid
graph TD
    subgraph Routers
        R1["/schema"]
        R2["/proxy"]
        R3["/tests/generate"]
        R4["/tests/run"]
        R5["/traces"]
        R6["/analytics"]
        R7["/test-cases"]
    end

    subgraph Services
        SP["schema_parser\nParse OpenAPI JSON"]
        TG["test_generator\nWrite pytest file"]
        TR["tracer\nPersist traces"]
        RP["result_parser\nRead pytest report"]
    end

    subgraph Database
        T["traces table"]
        TC["test_cases table"]
        TRun["test_runs table"]
    end

    R1 --> SP
    R2 --> TR --> T
    R3 --> TG
    R4 --> RP --> TR
    R5 --> T
    R6 --> T
    R7 --> TC
    R7 --> TR --> T
```

### Router responsibilities

| Router | File | Responsibility |
|---|---|---|
| `schema` | `routers/schema.py` | Fetch + parse OpenAPI from target URL |
| `proxy` | `routers/proxy.py` | Forward requests to target; record traces |
| `generator` | `routers/generator.py` | Generate pytest file from schema |
| `runner` | `routers/runner.py` | Run pytest; stream logs via SSE |
| `traces` | `routers/traces.py` | CRUD + filter on trace records |
| `analytics` | `routers/analytics.py` | Aggregate queries on traces table |
| `test_cases` | `routers/test_cases.py` | CRUD + single/batch execution of test cases |

---

## 5. Frontend Architecture

```mermaid
graph TD
    App["App.jsx\n(Router + global schema state)"]

    App --> Dashboard
    App --> Explorer
    App --> History
    App --> TestCases

    subgraph Explorer["Explorer Page"]
        Sidebar["Sidebar\n(endpoint list by tag)"]
        DynamicForm["DynamicForm\n(path/query/body inputs)"]
        ResponsePanel["ResponsePanel\n(status + body)"]
        AddToTestModal["AddToTestModal\n(save request)"]
        SchemaLogPanel["SchemaLogPanel\n(load trace)"]
    end

    subgraph TestCases["Test Cases Page"]
        TestCaseForm["TestCaseForm\n(create/edit)"]
        TestCaseCard["TestCaseCard\n(display + run)"]
    end

    subgraph Hooks["Custom Hooks"]
        useSchema["useSchema\n(load + diagnose)"]
        useTraces["useTraces\n(query traces)"]
        useTestCases["useTestCases\n(CRUD test cases)"]
        useAnalytics["useAnalytics\n(charts data)"]
        useTestRun["useTestRun\n(SSE pytest stream)"]
    end

    App --> useSchema
    Explorer --> useSchema
    History --> useTraces
    TestCases --> useTestCases
    Dashboard --> useAnalytics
    TestCases --> useTestRun
```

### State management strategy

| State | Location | Why |
|---|---|---|
| Loaded schema | `App.jsx` via `useSchema` | Survives page navigation — one load serves all pages |
| Selected endpoint | `Explorer.jsx` local | Only relevant within Explorer |
| Traces query results | `useTraces` hook | Refetched on filter change |
| Test cases | `useTestCases` hook | Refetched after mutations |
| Analytics | `useAnalytics` hook | Fetched once on Dashboard mount |
| Batch run stream | `useTestRun` hook | SSE lifecycle tied to run button |

---

## 6. Database Schema

```mermaid
erDiagram
    traces {
        int id PK
        string trace_id UK
        string endpoint
        string method
        string url
        text payload
        text response_body
        int status_code
        float time_taken_ms
        string source
        string test_name
        string test_run_id FK
        string tag
        bool passed
        text error_message
        datetime timestamp
    }

    test_runs {
        int id PK
        string run_id UK
        datetime triggered_at
        datetime completed_at
        float duration_ms
        int total
        int passed
        int failed
        int skipped
        string target_url
    }

    test_cases {
        int id PK
        string test_case_id UK
        string name
        text description
        string endpoint
        string method
        string base_url
        text path_params
        text query_params
        text body
        int expected_status
        string tag
        string suite
        string status
        datetime last_run_at
        bool last_run_passed
        int last_run_status
        datetime created_at
        datetime updated_at
    }

    traces ||--o{ test_runs : "test_run_id"
```

---

## 7. Network Flow & Port Map

```mermaid
flowchart LR
    Browser["Browser\nlocalhost:5173"]

    subgraph Vite["Vite Dev Server :5173"]
        Proxy["/api/* proxy"]
    end

    subgraph BE["FastAPI Backend :9001"]
        CORS["CORS Middleware"]
        Routes["Routers"]
        httpx["httpx client"]
    end

    subgraph Target["Target API :8000"]
        App["FastAPI App"]
    end

    DB[("SQLite")]

    Browser --> Vite
    Vite -->|"/api/* → http://127.0.0.1:9001"| BE
    BE --> DB
    httpx -->|"http://127.0.0.1:8000"| Target
    BE --> httpx
```

> **Windows note:** On Windows, `localhost` resolves to `::1` (IPv6) before `127.0.0.1` (IPv4). The backend automatically replaces `localhost` with `127.0.0.1` when fetching target APIs to avoid a ~2 second DNS penalty when the target is IPv4-only. Start all uvicorn processes with `--host 127.0.0.1` to ensure consistent IPv4 binding.

---

## 8. SSE Streaming Architecture

Two features use Server-Sent Events to stream results in real time:

### Pytest runner (`POST /tests/run`)

```
Client (EventSource)          Backend
      │                           │
      │── POST /tests/run ───────►│
      │                           │ spawn pytest subprocess
      │◄── data: {type:log} ──────│ stream stdout line-by-line
      │◄── data: {type:log} ──────│
      │      ...                  │ pytest completes
      │◄── data: {type:result} ───│ parse report.json
      │◄── data: {type:done} ─────│
      │                           │
```

### Batch test case runner (`POST /test-cases/run-batch`)

```
Client (fetch + ReadableStream)  Backend
      │                              │
      │── POST /run-batch ──────────►│
      │                              │ filter test cases
      │◄── data: {type:start} ───────│
      │◄── data: {type:result, i=1} ─│ run case 1 via httpx
      │◄── data: {type:result, i=2} ─│ run case 2
      │      ...                     │
      │◄── data: {type:done} ────────│ all cases complete
```

---

## 9. Key Design Decisions

| Decision | Rationale |
|---|---|
| **SQLite default** | Zero setup — works out of the box. Swap to PostgreSQL via `DATABASE_URL` for teams. |
| **httpx over requests** | Async-native; works seamlessly in FastAPI async routes |
| **Vite proxy for /api** | Browser → backend calls go through Vite proxy, avoiding CORS and making the base URL configurable in one place (`vite.config.js`) |
| **Schema state in App.jsx** | Prevents schema loss when navigating between pages — one load, available everywhere |
| **SSE for streaming** | Simpler than WebSockets for unidirectional server→client streams; works with native browser `EventSource` |
| **Source field on traces** | Distinguishes portal (manual), pytest (automated), and test_case (saved) — critical for analytics segmentation |
| **`localhost` → `127.0.0.1` fix** | Windows DNS dual-stack behavior causes a 2s penalty; hardcoding IPv4 eliminates it |
| **Port 9001 not 9000** | Port 9000 is used by Zscaler (corporate VPN) on Cognizant machines — confirmed via `netstat` |
