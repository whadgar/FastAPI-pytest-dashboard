import { useState } from "react";
import Spinner from "./shared/Spinner.jsx";

const METHOD_COLORS = {
  GET: "text-emerald-400",
  POST: "text-blue-400",
  PUT: "text-yellow-400",
  PATCH: "text-orange-400",
  DELETE: "text-red-400",
};

function StatusBadge({ passed, code }) {
  if (passed === null || passed === undefined) return <span className="text-gray-600 text-xs">—</span>;
  return (
    <span className={`text-xs font-semibold ${passed ? "text-emerald-400" : "text-red-400"}`}>
      {passed ? "PASS" : "FAIL"} {code ? `(${code})` : ""}
    </span>
  );
}

export default function TestCaseCard({ tc, onEdit, onDelete, onRun, runResult }) {
  const [running, setRunning] = useState(false);
  const [localResult, setLocalResult] = useState(null);

  const result = runResult || localResult;

  async function handleRun() {
    setRunning(true);
    setLocalResult(null);
    try {
      const r = await onRun(tc.test_case_id);
      setLocalResult(r);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={`bg-gray-900 border rounded-lg p-4 space-y-3 ${tc.status === "confirmed" ? "border-indigo-700" : "border-gray-800"}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase ${METHOD_COLORS[tc.method] || "text-gray-400"}`}>{tc.method}</span>
            <span className="font-mono text-sm text-white truncate">{tc.endpoint}</span>
            {tc.suite && <span className="text-xs bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded">{tc.suite}</span>}
            {tc.tag && <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{tc.tag}</span>}
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tc.status === "confirmed" ? "bg-indigo-900 text-indigo-300" : "bg-gray-800 text-gray-500"}`}>
              {tc.status}
            </span>
          </div>
          <p className="text-sm text-white font-medium mt-0.5">{tc.name}</p>
          {tc.description && <p className="text-xs text-gray-500 mt-0.5">{tc.description}</p>}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded"
          >
            {running && <Spinner size={3} />}
            {running ? "Running…" : "Run"}
          </button>
          <button onClick={() => onEdit(tc)} className="px-2 py-1 text-xs text-gray-400 hover:text-white rounded hover:bg-gray-800">
            Edit
          </button>
          <button onClick={() => onDelete(tc.test_case_id)} className="px-2 py-1 text-xs text-red-500 hover:text-red-400 rounded hover:bg-gray-800">
            Del
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Exp. {tc.expected_status}</span>
        <span className="text-gray-700">|</span>
        <span>Last run: <StatusBadge passed={tc.last_run_passed} code={tc.last_run_status} /></span>
        {tc.last_run_at && <span className="text-gray-600">{new Date(tc.last_run_at).toLocaleString()}</span>}
      </div>

      {/* Inline run result */}
      {result && (
        <div className={`rounded p-2.5 text-xs space-y-1 ${result.passed ? "bg-emerald-950 border border-emerald-800" : "bg-red-950 border border-red-900"}`}>
          <div className="flex items-center gap-3">
            <span className={`font-semibold ${result.passed ? "text-emerald-400" : "text-red-400"}`}>
              {result.passed ? "✓ PASSED" : "✗ FAILED"}
            </span>
            <span className="text-gray-400">HTTP {result.status_code}</span>
            <span className="text-gray-500">{result.time_taken_ms}ms</span>
          </div>
          {result.error_message && <p className="text-red-400">{result.error_message}</p>}
          <details className="cursor-pointer">
            <summary className="text-gray-500 select-none">Response body</summary>
            <pre className="mt-1 text-gray-300 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
              {typeof result.response_body === "string"
                ? result.response_body
                : JSON.stringify(result.response_body, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
