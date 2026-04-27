import { useState, useEffect } from "react";
import { useTestCases } from "../hooks/useTestCases.js";
import TestCaseForm from "../components/TestCaseForm.jsx";
import TestCaseCard from "../components/TestCaseCard.jsx";
import Spinner from "../components/shared/Spinner.jsx";

export default function TestCases() {
  const { cases, loading, error, fetchAll, create, update, remove, runOne } = useTestCases();
  const [statusTab, setStatusTab] = useState("all");
  const [suiteFilter, setSuiteFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchLog, setBatchLog] = useState([]);
  const [batchSummary, setBatchSummary] = useState(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── derived lists ─────────────────────────────────────────────────────────

  const allSuites = [...new Set(cases.map((tc) => tc.suite).filter(Boolean))].sort();
  const allTags   = [...new Set(cases.map((tc) => tc.tag).filter(Boolean))].sort();

  const visible = cases.filter((tc) => {
    if (statusTab !== "all" && tc.status !== statusTab) return false;
    if (suiteFilter !== "all" && tc.suite !== suiteFilter) return false;
    if (tagFilter !== "all" && tc.tag !== tagFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        tc.name.toLowerCase().includes(q) ||
        tc.endpoint.toLowerCase().includes(q) ||
        (tc.tag || "").toLowerCase().includes(q) ||
        (tc.suite || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const visibleConfirmed = visible.filter((tc) => tc.status === "confirmed");

  // ── form actions ──────────────────────────────────────────────────────────

  async function handleSave(payload) {
    if (editing) {
      await update(editing.test_case_id, payload);
    } else {
      await create(payload);
    }
    setShowForm(false);
    setEditing(null);
  }

  function handleEdit(tc) { setEditing(tc); setShowForm(true); }
  async function handleDelete(id) {
    if (!confirm("Delete this test case?")) return;
    await remove(id);
  }
  function handleCancel() { setShowForm(false); setEditing(null); }

  // ── batch run (SSE) ───────────────────────────────────────────────────────

  async function handleBatchRun() {
    if (!visibleConfirmed.length) {
      alert("No confirmed test cases in the current view.");
      return;
    }
    setBatchRunning(true);
    setBatchLog([]);
    setBatchSummary(null);

    // Build the right request body based on active filter
    let body;
    if (suiteFilter !== "all") {
      body = { suite: suiteFilter };
    } else if (tagFilter !== "all") {
      body = { tag: tagFilter };
    } else {
      body = { test_case_ids: visibleConfirmed.map((tc) => tc.test_case_id) };
    }

    try {
      const resp = await fetch("/api/test-cases/run-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "progress") setBatchLog((prev) => [...prev, evt]);
            else if (evt.type === "done") {
              setBatchSummary({ total: evt.total, passed: evt.passed, failed: evt.failed });
              setBatchRunning(false);
              fetchAll();
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setBatchLog((prev) => [...prev, { name: "error", passed: false, error_message: e.message }]);
      setBatchRunning(false);
    }
  }

  // ── run label ─────────────────────────────────────────────────────────────

  function runLabel() {
    if (batchRunning) return "Running…";
    const count = visibleConfirmed.length;
    if (suiteFilter !== "all") return `Run Suite "${suiteFilter}" (${count})`;
    if (tagFilter !== "all")   return `Run Tag "${tagFilter}" (${count})`;
    return `Run All Confirmed (${count})`;
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-bold text-xl">Test Cases</h1>
          <p className="text-gray-500 text-sm">
            {cases.length} total · {cases.filter((tc) => tc.status === "confirmed").length} confirmed
            {allSuites.length > 0 && ` · ${allSuites.length} suites`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBatchRun}
            disabled={batchRunning || visibleConfirmed.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded"
          >
            {batchRunning && <Spinner size={3} />}
            {runLabel()}
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded"
          >
            + New Test Case
          </button>
        </div>
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
          <h2 className="text-white font-semibold text-sm mb-4">{editing ? "Edit Test Case" : "New Test Case"}</h2>
          <TestCaseForm initial={editing} onSave={handleSave} onCancel={handleCancel} />
        </div>
      )}

      {/* Batch run results */}
      {(batchLog.length > 0 || batchSummary) && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase">Run Results</p>
            <button onClick={() => { setBatchLog([]); setBatchSummary(null); }} className="text-xs text-gray-600 hover:text-gray-400">Clear</button>
          </div>
          {batchSummary && (
            <div className="flex gap-4 text-sm">
              <span className="text-emerald-400 font-semibold">{batchSummary.passed} passed</span>
              <span className="text-red-400 font-semibold">{batchSummary.failed} failed</span>
              <span className="text-gray-500">{batchSummary.total} total</span>
            </div>
          )}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {batchLog.map((entry, i) => (
              <div key={i} className={`flex items-center gap-3 text-xs px-2 py-1 rounded ${entry.passed ? "bg-emerald-950 text-emerald-300" : "bg-red-950 text-red-300"}`}>
                <span className="font-semibold">{entry.passed ? "✓" : "✗"}</span>
                <span className="flex-1 truncate">{entry.name}</span>
                <span>HTTP {entry.status_code}</span>
                {entry.error_message && <span className="text-red-400 truncate max-w-xs">{entry.error_message}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status */}
        <div className="flex gap-1">
          {["all", "confirmed", "draft"].map((t) => (
            <button key={t} onClick={() => setStatusTab(t)}
              className={`px-3 py-1 text-xs rounded capitalize font-medium ${statusTab === t ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Suite filter */}
        {allSuites.length > 0 && (
          <select
            value={suiteFilter}
            onChange={(e) => setSuiteFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Suites</option>
            {allSuites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* Tag filter */}
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, endpoint, suite, tag…"
          className="flex-1 min-w-48 max-w-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
        />

        {/* Active filter chips */}
        {suiteFilter !== "all" && (
          <span className="flex items-center gap-1 bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5 rounded-full">
            Suite: {suiteFilter}
            <button onClick={() => setSuiteFilter("all")} className="text-indigo-400 hover:text-white ml-0.5">×</button>
          </span>
        )}
        {tagFilter !== "all" && (
          <span className="flex items-center gap-1 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
            Tag: {tagFilter}
            <button onClick={() => setTagFilter("all")} className="text-gray-400 hover:text-white ml-0.5">×</button>
          </span>
        )}
      </div>

      {/* Loading / error */}
      {loading && <div className="flex justify-center py-8"><Spinner size={6} /></div>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Empty state */}
      {!loading && visible.length === 0 && (
        <div className="text-center py-16 text-gray-600 text-sm">
          {cases.length === 0
            ? "No test cases yet. Use the Explorer to add endpoint payloads as test cases."
            : "No test cases match the current filter."}
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {visible.map((tc) => (
          <TestCaseCard
            key={tc.test_case_id}
            tc={tc}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRun={runOne}
          />
        ))}
      </div>
    </div>
  );
}
