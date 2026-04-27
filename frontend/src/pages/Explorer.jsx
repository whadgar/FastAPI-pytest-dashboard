import { useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import DynamicForm from "../components/DynamicForm.jsx";
import ResponsePanel from "../components/ResponsePanel.jsx";
import AddToTestModal from "../components/AddToTestModal.jsx";
import Spinner from "../components/shared/Spinner.jsx";
import client from "../api/client.js";

export default function Explorer({ schemaProps }) {
  const [url, setUrl]           = useState("http://localhost:8000");
  const { schema, loading: schemaLoading, error: schemaError, logs, fetchSchema, diagnose } = schemaProps;
  const [selected, setSelected] = useState(null);
  const [sending, setSending]   = useState(false);
  const [response, setResponse] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg]     = useState(null);
  const [addModal, setAddModal] = useState(null);
  const [savedMsg, setSavedMsg] = useState(null);
  const [diagResult, setDiagResult] = useState(null);
  const [diagRunning, setDiagRunning] = useState(false);

  async function handleSend({ pathParams, queryParams, body }) {
    setSending(true);
    setResponse(null);
    try {
      const res = await client.post("/proxy", {
        base_url: schema.base_url,
        endpoint: selected.path,
        method: selected.method,
        path_params: pathParams,
        query_params: queryParams,
        body,
        tag: selected.tag,
      });
      setResponse(res.data);
    } catch (e) {
      setResponse({ status_code: e.response?.status || 0, time_taken_ms: 0, response_body: e.response?.data || e.message });
    } finally {
      setSending(false);
    }
  }

  function handleAddToTest(formValues) {
    setAddModal({ formValues });
  }

  function handleSaved() {
    setSavedMsg("Test case saved!");
    setTimeout(() => setSavedMsg(null), 3000);
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenMsg(null);
    try {
      const res = await client.post("/tests/generate", { base_url: schema.base_url });
      setGenMsg(`Generated ${res.data.test_count} tests covering ${res.data.endpoints_covered} endpoints`);
    } catch {
      setGenMsg("Failed to generate tests");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDiagnose() {
    setDiagResult(null);
    setDiagRunning(true);
    const result = await diagnose(url);
    setDiagResult(result);
    setDiagRunning(false);
  }

  return (
    <>
      {addModal && (
        <AddToTestModal
          endpoint={selected}
          schema={schema}
          formValues={addModal.formValues}
          onClose={() => setAddModal(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="flex gap-0 rounded-lg border border-gray-800 min-h-[600px]">
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 relative z-10">
          {/* URL input + controls */}
          <div className="p-3 border-b border-gray-800 space-y-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchSchema(url)}
              placeholder="http://localhost:8000"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => { setDiagResult(null); fetchSchema(url); }}
              disabled={schemaLoading}
              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded flex items-center justify-center gap-1"
            >
              {schemaLoading && <Spinner size={3} />}
              {schemaLoading ? "Loading…" : "Load Schema"}
            </button>

            {/* Error */}
            {schemaError && (
              <p className="text-red-400 text-xs break-words">{schemaError}</p>
            )}
          </div>

          {/* Endpoint list */}
          <div className="flex-1 overflow-y-auto">
            {schema && (
              <Sidebar schema={schema} selected={selected} onSelect={(ep) => { setSelected(ep); setResponse(null); }} />
            )}
          </div>

          {/* Generate Tests */}
          {schema && (
            <div className="p-3 border-t border-gray-800 space-y-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs rounded flex items-center justify-center gap-1"
              >
                {generating && <Spinner size={3} />}
                Generate Tests
              </button>
              {genMsg && <p className="text-xs text-gray-400">{genMsg}</p>}
            </div>
          )}
        </div>

        {/* Main panel */}
        <div className="flex-1 overflow-y-auto bg-gray-950 p-5 space-y-6">
          {/* Saved confirmation */}
          {savedMsg && (
            <div className="bg-emerald-900 border border-emerald-700 text-emerald-300 text-xs font-medium px-4 py-2 rounded">
              {savedMsg} — view it on the <a href="/test-cases" className="underline">Test Cases</a> page.
            </div>
          )}

          {/* Diagnostics panel */}
          {diagResult && (
            <DiagnosticsPanel result={diagResult} onClose={() => setDiagResult(null)} />
          )}

          {/* Load Schema log panel */}
          {logs.length > 0 && (
            <SchemaLogPanel logs={logs} />
          )}

          {!selected ? (
            <div className="flex items-center justify-center py-32 text-gray-600 text-sm pointer-events-none">
              {schema ? "Select an endpoint from the sidebar." : "Enter a URL and click Load Schema."}
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-bold text-indigo-400 uppercase">{selected.method}</span>
                  <span className="font-mono text-lg text-white">{selected.path}</span>
                </div>
                {selected.summary && <p className="text-sm text-gray-400">{selected.summary}</p>}
              </div>

              <DynamicForm
                endpoint={selected}
                onSubmit={handleSend}
                onAddToTest={handleAddToTest}
                loading={sending}
              />

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Response</p>
                <ResponsePanel response={response} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Schema log panel ─────────────────────────────────────────────────────────

const LEVEL_STYLE = {
  info:    "text-gray-400",
  success: "text-emerald-400",
  warn:    "text-yellow-400",
  error:   "text-red-400",
};

function SchemaLogPanel({ logs }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-xs space-y-0.5">
      <p className="text-gray-500 text-[10px] uppercase font-semibold mb-1 tracking-wider">Load Schema Trace</p>
      {logs.map((entry, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-gray-600 shrink-0">{entry.ts}</span>
          <span className={LEVEL_STYLE[entry.level] ?? "text-gray-300"}>{entry.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Diagnostics panel ────────────────────────────────────────────────────────

function DiagnosticsPanel({ result, onClose }) {
  if (result.error) {
    return (
      <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-xs text-red-300">
        <div className="flex justify-between mb-1">
          <span className="font-semibold">Diagnostics failed</span>
          <button onClick={onClose} className="text-red-500 hover:text-red-300">×</button>
        </div>
        <p>{result.error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs font-semibold text-gray-300 uppercase">Connection Diagnostics</p>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-sm">×</button>
      </div>

      {result.checks?.map((check, i) => (
        <div key={i} className={`rounded p-3 text-xs space-y-1 ${check.ok ? "bg-emerald-950 border border-emerald-800" : "bg-red-950 border border-red-900"}`}>
          <div className="flex items-center gap-2">
            <span className={`font-bold ${check.ok ? "text-emerald-400" : "text-red-400"}`}>
              {check.ok ? "✓" : "✗"}
            </span>
            <span className="font-mono text-gray-300 break-all">{check.url}</span>
            {check.elapsed_ms !== undefined && (
              <span className="text-gray-500 ml-auto shrink-0">{check.elapsed_ms}ms</span>
            )}
          </div>
          {check.ok && (
            <div className="text-gray-400 pl-4 space-y-0.5">
              <p>HTTP {check.status_code} · OpenAPI: {check.is_openapi ? "yes" : "no"}</p>
              {check.is_openapi && <p>Title: {check.title} · {check.endpoints} paths</p>}
              {!check.is_openapi && check.parse_error && <p className="text-yellow-400">{check.parse_error}</p>}
            </div>
          )}
          {check.error && <p className="text-red-400 pl-4">{check.error}</p>}
        </div>
      ))}

      {result.recommendation && (
        <div className="bg-gray-800 rounded p-3 text-xs text-gray-300">
          <span className="font-semibold text-gray-400">Recommendation: </span>
          {result.recommendation}
        </div>
      )}
    </div>
  );
}
