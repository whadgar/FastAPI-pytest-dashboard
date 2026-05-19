# Functional Specification — API Dev Dashboard

**Version:** 1.0  
**Status:** Implemented

---

## 1. Overview

API Dev Dashboard is a local developer tool that provides a unified interface for:

- Exploring any OpenAPI 3.x REST API interactively
- Saving and organizing API requests as reusable test cases
- Running test cases individually or in batch with live streaming results
- Browsing the full history of every API call with timing and pass/fail data
- Viewing analytics charts across all recorded activity

The system has no external dependencies — it runs entirely on the developer's machine with SQLite for storage.

---

## 2. User Personas

| Persona | Goal |
|---|---|
| **Backend Developer** | Explore a new API they're building, fire test requests, catch regressions |
| **QA Engineer** | Build a suite of named test cases against an API, run them on demand |
| **Tech Lead / Reviewer** | Review API call history and pass/fail trends over time |

---

## 3. Feature Specifications

---

### 3.1 Schema Explorer

**Goal:** Load any OpenAPI-compliant API and browse its endpoints without leaving the dashboard.

**Inputs:**
- Base URL of the target API (e.g., `http://127.0.0.1:8000`)

**Process:**
1. Dashboard backend appends `/openapi.json` to the URL
2. Fetches the OpenAPI JSON via httpx with a 10s timeout
3. Parses the schema: extracts endpoints, path/query params, request body shape, response codes
4. Returns a structured endpoint list to the frontend
5. Frontend renders endpoints in a sidebar grouped by tag

**Edge Cases:**
- `localhost` is converted to `127.0.0.1` server-side to avoid Windows IPv6 dual-stack slowness (2s DNS penalty)
- If fetch fails → 502 with descriptive error message
- If JSON cannot be parsed as valid OpenAPI → 502 with parse error
- A **Diagnose Connection** button appears on error, running TCP + HTTP checks on all address variants

**Outputs:**
- Sidebar populated with endpoints grouped by tag
- Schema trace log panel showing each step with timestamps (Load Schema Trace)

---

### 3.2 Interactive Request Form

**Goal:** Allow developers to fire any API request with auto-generated, type-aware form fields.

**Inputs:** Selected endpoint from sidebar

**Rendered Fields:**
- **Path parameters**: one text input per `{param}` in path
- **Query parameters**: one text input per declared query param
- **Request body**: a JSON textarea pre-populated from schema example values

**Behaviour:**
- JSON body is validated on submit — malformed JSON shows an inline error
- All fields pre-populate with sensible example values from the schema
- Form resets when a different endpoint is selected

**Send button:**
- Fires `POST /proxy` with all form values
- Shows spinner during request
- Displays response in the Response Panel on completion

---

### 3.3 Request Proxy & Trace Recording

**Goal:** Every request sent through the dashboard is forwarded to the target API and persisted as a trace.

**Inputs:**
```
base_url, endpoint, method, path_params, query_params, body, tag
```

**Process:**
1. Backend resolves the full URL (path params substituted)
2. Fires the HTTP request to the target API via httpx
3. Captures: status code, response body, response headers, elapsed time
4. Persists a `Trace` record with `source = "portal"`
5. Returns the trace result to the frontend

**Trace fields recorded:**
- `trace_id` (UUID)
- `endpoint` (pattern, e.g., `/products/{id}`)
- `method`, `url`, `payload`, `response_body`
- `status_code`, `time_taken_ms`
- `source`: `portal` | `pytest` | `test_case`
- `tag`, `passed`, `error_message`, `timestamp`

---

### 3.4 Add to Test Cases

**Goal:** Save any request with its current form values as a reusable named test case.

**Trigger:** "Add to Test Cases" button in the Explorer form

**Modal fields:**
| Field | Type | Required | Notes |
|---|---|---|---|
| Name | Text | Yes | Human-readable label |
| Suite | Text with datalist | No | Groups test cases (e.g., "smoke", "regression") |
| Tag | Text | No | Secondary grouping |
| Expected Status | Number | Yes | Default: 200 |
| Status | Select | Yes | `draft` or `confirmed` |

**Pre-filled from form:** path params, query params, body, endpoint, method, base URL

**On save:** test case appears immediately on the Test Cases page

---

### 3.5 Test Cases Management

**Goal:** Organise saved API requests into named test cases, run them individually or in batch.

**List view features:**
- Filter by: status (draft / confirmed), suite, tag, free-text search
- Batch run scope: "Run Suite X", "Run Tag Y", or "Run All Confirmed"

**TestCase fields:**
```
name, description, endpoint, method, base_url,
path_params, query_params, body,
expected_status, tag, suite, status,
last_run_at, last_run_passed, last_run_status
```

**Single run:**
- Executes the HTTP request
- Compares `status_code` to `expected_status` → `passed = true/false`
- Updates `last_run_*` fields
- Records a `Trace` with `source = "test_case"`
- Result shown inline on the card

**Batch run (SSE):**
- Streams results one case at a time
- Each event: `{type, index, total, name, passed, status_code, time_taken_ms}`
- Final event: `{type: "done", total, passed, failed, duration_ms}`
- Frontend shows a live progress bar and per-case result list

---

### 3.6 Test Generation

**Goal:** Auto-generate a runnable pytest file from any OpenAPI schema.

**Trigger:** "Generate Tests" button in Explorer (requires schema loaded)

**Generated tests per endpoint:**
| Variant | Condition | Assertion |
|---|---|---|
| Happy path | Always | `status_code < 500` |
| Validation error | POST/PUT/PATCH with body | `status_code == 422` |
| Not found | GET/PUT/PATCH/DELETE with path params | `status_code == 404` |

**Output:** `generated_tests/test_generated.py` (overwrites on each generation)

**Feedback:** Brief message in Explorer sidebar: "Generated N tests covering M endpoints"

> **Planned:** LLM-powered test generation to produce more semantically rich tests with realistic payloads and detailed assertions.

---

### 3.7 History

**Goal:** Browse and filter all recorded API traces.

**Filter options:**
- Method (GET, POST, PUT, DELETE, PATCH)
- Source (portal, pytest, test_case)
- Pass/Fail status

**Pagination:** 50 traces per page (configurable up to 500 via API)

**Trace detail (expandable row):**
- Full request: URL, method, headers, body
- Full response: status, headers, body (pretty-printed JSON)
- Timing, source, tag, test name

**Export:** Download filtered traces as CSV (client-side)

**Delete:** Remove individual traces or bulk-delete by filter

---

### 3.8 Analytics Dashboard

**Goal:** Give a high-level view of API health and test coverage over time.

**KPI cards:**
- Total traces recorded
- Total test runs completed
- Average response time (ms)
- Overall pass rate (%)

**Charts:**
| Chart | Type | Data |
|---|---|---|
| Pass / Fail | Pie | Passed vs failed traces |
| Calls per Endpoint | Bar | Count per endpoint+method pair |
| Response Times | Line | Avg ms per endpoint per day |

**Date range filter:** All charts support optional `from_date` / `to_date` query params.

---

## 4. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| **Startup time** | All 3 services ready within 10 seconds |
| **Schema load** | < 500ms for local APIs once DNS is resolved |
| **Proxy overhead** | < 20ms added latency over direct HTTP call |
| **Batch run streaming** | First SSE event within 1s of run start |
| **Storage** | SQLite default; PostgreSQL supported via `DATABASE_URL` |
| **Browser support** | Chrome 110+, Firefox 110+, Edge 110+ |
| **Platform** | macOS, Linux, Windows 10/11 (with IPv6 workaround) |

---

## 5. Data Retention

- Traces are retained indefinitely until manually deleted
- Test runs are retained indefinitely
- Test cases are retained until deleted
- Generated pytest files are overwritten on each generation (no history)

---

## 6. Security Considerations

- Dashboard is designed for **local development use only** — do not expose to public networks
- CORS is restricted to `CORS_ORIGINS` (default: `http://localhost:5173`)
- No authentication — assumes trusted local environment
- The proxy endpoint forwards to any URL provided — do not run on shared/multi-user machines with untrusted users

---

## 7. Out of Scope (v1.0)

- Authentication / authorisation
- Multi-user / team collaboration
- Cloud deployment
- LLM-powered test generation (planned for v2.0)
- GraphQL or gRPC support
- Webhook / event-driven testing
