import { useState, useEffect, useCallback } from "react";
import { useTraces } from "../hooks/useTraces.js";
import TraceCard from "../components/TraceCard.jsx";
import Badge from "../components/shared/Badge.jsx";
import Spinner from "../components/shared/Spinner.jsx";
import EmptyState from "../components/shared/EmptyState.jsx";
import client from "../api/client.js";

export default function History() {
  const { data, loading, fetchTraces } = useTraces();
  const [filters, setFilters] = useState({ method: "", source: "", passed: "", limit: 50, offset: 0 });
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(() => {
    const params = { limit: filters.limit, offset: filters.offset };
    if (filters.method)  params.method  = filters.method;
    if (filters.source)  params.source  = filters.source;
    if (filters.passed !== "") params.passed = filters.passed === "true";
    fetchTraces(params);
  }, [filters, fetchTraces]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val, offset: 0 }));
  }

  async function handleDelete(trace_id) {
    await client.delete(`/traces/${trace_id}`);
    load();
  }

  function exportCSV() {
    const headers = ["timestamp", "method", "endpoint", "status_code", "time_ms", "source", "passed"];
    const rows = data.items.map((t) =>
      [t.timestamp, t.method, t.endpoint, t.status_code, t.time_taken_ms, t.source, t.passed].join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "traces.csv";
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">History</h1>
        <button onClick={exportCSV} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white">
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-gray-900 border border-gray-800 rounded-lg p-3">
        <select
          value={filters.method}
          onChange={(e) => setFilter("method", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
        >
          <option value="">All Methods</option>
          {["GET","POST","PUT","PATCH","DELETE"].map((m) => <option key={m}>{m}</option>)}
        </select>

        <select
          value={filters.source}
          onChange={(e) => setFilter("source", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
        >
          <option value="">All Sources</option>
          <option value="portal">Portal</option>
          <option value="pytest">Pytest</option>
        </select>

        <select
          value={filters.passed}
          onChange={(e) => setFilter("passed", e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
        >
          <option value="">All Results</option>
          <option value="true">Passed</option>
          <option value="false">Failed</option>
        </select>

        <span className="ml-auto text-xs text-gray-500 self-center">{data.total} total</span>
      </div>

      {/* Expanded trace */}
      {expanded && (
        <TraceCard trace={expanded} onClose={() => setExpanded(null)} />
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : data.items.length === 0 ? (
        <EmptyState message="No traces match your filters." />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800 bg-gray-900/80">
                <th className="text-left px-4 py-2">Timestamp</th>
                <th className="text-left px-4 py-2">Method</th>
                <th className="text-left px-4 py-2">Endpoint</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2">Pass</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr
                  key={t.trace_id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                  onClick={() => setExpanded(t)}
                >
                  <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(t.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-300">{t.method}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-300 max-w-xs truncate">{t.endpoint}</td>
                  <td className="px-4 py-2"><Badge status={t.status_code} /></td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{t.time_taken_ms?.toFixed(1)} ms</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{t.source}</td>
                  <td className="px-4 py-2 text-xs">
                    {t.passed === null ? <span className="text-gray-600">—</span>
                      : t.passed ? <span className="text-green-400">✓</span>
                      : <span className="text-red-400">✗</span>}
                  </td>
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(t.trace_id)}
                      className="text-gray-600 hover:text-red-400 text-xs"
                    >
                      del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-800">
            <button
              disabled={filters.offset === 0}
              onClick={() => setFilter("offset", Math.max(0, filters.offset - filters.limit))}
              className="text-xs px-2 py-1 bg-gray-800 rounded disabled:opacity-40 hover:bg-gray-700"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">
              {filters.offset + 1}–{Math.min(filters.offset + filters.limit, data.total)} of {data.total}
            </span>
            <button
              disabled={filters.offset + filters.limit >= data.total}
              onClick={() => setFilter("offset", filters.offset + filters.limit)}
              className="text-xs px-2 py-1 bg-gray-800 rounded disabled:opacity-40 hover:bg-gray-700"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
