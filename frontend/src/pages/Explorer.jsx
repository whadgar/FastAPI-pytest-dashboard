import { useState } from "react";
import { useSchema } from "../hooks/useSchema.js";
import Sidebar from "../components/Sidebar.jsx";
import DynamicForm from "../components/DynamicForm.jsx";
import ResponsePanel from "../components/ResponsePanel.jsx";
import TestRunner from "../components/TestRunner.jsx";
import Spinner from "../components/shared/Spinner.jsx";
import client from "../api/client.js";

export default function Explorer() {
  const [url, setUrl]             = useState("http://localhost:8000");
  const { schema, loading: schemaLoading, error: schemaError, fetchSchema } = useSchema();
  const [selected, setSelected]   = useState(null);
  const [sending, setSending]     = useState(false);
  const [response, setResponse]   = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg]       = useState(null);

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

  async function handleGenerate() {
    setGenerating(true);
    setGenMsg(null);
    try {
      const res = await client.post("/tests/generate", { base_url: schema.base_url });
      setGenMsg(`✓ Generated ${res.data.test_count} tests covering ${res.data.endpoints_covered} endpoints`);
    } catch {
      setGenMsg("✗ Failed to generate tests");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex gap-0 rounded-lg border border-gray-800 min-h-[600px]">
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 relative z-10">
        {/* URL input */}
        <div className="p-3 border-b border-gray-800 space-y-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => fetchSchema(url)}
            disabled={schemaLoading}
            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded flex items-center justify-center gap-1"
          >
            {schemaLoading && <Spinner size={3} />}
            {schemaLoading ? "Loading…" : "Load Schema"}
          </button>
          {schemaError && <p className="text-red-400 text-xs">{schemaError}</p>}
        </div>

        {/* Endpoint list */}
        <div className="flex-1 overflow-y-auto">
          {schema && (
            <Sidebar schema={schema} selected={selected} onSelect={(ep) => { setSelected(ep); setResponse(null); }} />
          )}
        </div>

        {/* Test actions */}
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
        {!selected ? (
          <div className="flex items-center justify-center py-32 text-gray-600 text-sm pointer-events-none">
            {schema ? "Select an endpoint from the sidebar." : "Enter a URL and click Load Schema."}
          </div>
        ) : (
          <>
            {/* Endpoint header */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-bold text-indigo-400 uppercase">{selected.method}</span>
                <span className="font-mono text-lg text-white">{selected.path}</span>
              </div>
              {selected.summary && <p className="text-sm text-gray-400">{selected.summary}</p>}
            </div>

            {/* Form */}
            <DynamicForm endpoint={selected} onSubmit={handleSend} loading={sending} />

            {/* Response */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Response</p>
              <ResponsePanel response={response} />
            </div>

            {/* Test Runner */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Test Runner</p>
              <TestRunner targetUrl={schema?.base_url} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
