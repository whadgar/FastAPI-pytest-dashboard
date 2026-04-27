import { useState, useEffect } from "react";
import client from "../api/client.js";

const METHOD_COLORS = {
  GET: "text-emerald-400", POST: "text-blue-400",
  PUT: "text-yellow-400", PATCH: "text-orange-400", DELETE: "text-red-400",
};

export default function AddToTestModal({ endpoint, schema, formValues, onClose, onSaved }) {
  const [suites, setSuites] = useState([]);
  const [name, setName] = useState("");
  const [suite, setSuite] = useState("");
  const [tag, setTag] = useState("");
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill name and tag from endpoint
  useEffect(() => {
    if (endpoint) {
      setName(`${endpoint.method} ${endpoint.path}`);
      setTag(endpoint.tag || "");
    }
  }, [endpoint]);

  // Load existing suites for datalist
  useEffect(() => {
    client.get("/test-cases/meta/suites")
      .then((r) => setSuites(r.data))
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      await client.post("/test-cases", {
        name: name.trim(),
        endpoint: endpoint.path,
        method: endpoint.method,
        base_url: schema.base_url,
        path_params: formValues.pathParams || {},
        query_params: formValues.queryParams || {},
        body: formValues.body || {},
        expected_status: expectedStatus,
        tag: tag.trim() || null,
        suite: suite.trim() || null,
        status,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-white font-bold text-base">Add to Test Cases</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-bold uppercase ${METHOD_COLORS[endpoint?.method] || "text-gray-400"}`}>
              {endpoint?.method}
            </span>
            <span className="font-mono text-sm text-gray-300">{endpoint?.path}</span>
          </div>
        </div>

        {/* Test name */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Test Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="e.g. Create product - valid payload"
          />
        </div>

        {/* Suite */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Suite</label>
          <input
            value={suite}
            onChange={(e) => setSuite(e.target.value)}
            list="suites-list"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="e.g. products, auth, smoke"
          />
          <datalist id="suites-list">
            {suites.map((s) => <option key={s} value={s} />)}
          </datalist>
          <p className="text-xs text-gray-600 mt-0.5">Type a new name or pick an existing suite</p>
        </div>

        {/* Tag */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tag</label>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="e.g. happy-path, edge-case"
          />
        </div>

        {/* Expected status + Save as */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Expected Status</label>
            <input
              type="number"
              value={expectedStatus}
              onChange={(e) => setExpectedStatus(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Save as</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
        </div>

        {/* Payload preview */}
        <details className="text-xs">
          <summary className="text-gray-500 cursor-pointer select-none">Captured payload preview</summary>
          <pre className="mt-2 bg-gray-800 rounded p-2 text-gray-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
            {JSON.stringify(formValues, null, 2)}
          </pre>
        </details>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded border border-gray-700 hover:border-gray-500">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded"
          >
            {saving ? "Saving…" : "Save Test Case"}
          </button>
        </div>
      </div>
    </div>
  );
}
