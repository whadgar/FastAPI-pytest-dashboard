import { useState, useEffect } from "react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const EMPTY = {
  name: "",
  description: "",
  endpoint: "",
  method: "GET",
  base_url: "http://localhost:8000",
  path_params: "{}",
  query_params: "{}",
  body: "{}",
  expected_status: 200,
  tag: "",
  suite: "",
  status: "draft",
};

function JsonField({ label, value, onChange }) {
  const [err, setErr] = useState(null);

  function handleChange(v) {
    onChange(v);
    try {
      JSON.parse(v);
      setErr(null);
    } catch {
      setErr("Invalid JSON");
    }
  }

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 resize-none"
      />
      {err && <p className="text-red-400 text-xs mt-0.5">{err}</p>}
    </div>
  );
}

export default function TestCaseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || "",
        description: initial.description || "",
        endpoint: initial.endpoint || "",
        method: initial.method || "GET",
        base_url: initial.base_url || "http://localhost:8000",
        path_params: JSON.stringify(initial.path_params ?? {}, null, 2),
        query_params: JSON.stringify(initial.query_params ?? {}, null, 2),
        body: JSON.stringify(initial.body ?? {}, null, 2),
        expected_status: initial.expected_status ?? 200,
        tag: initial.tag || "",
        suite: initial.suite || "",
        status: initial.status || "draft",
      });
    } else {
      setForm(EMPTY);
    }
  }, [initial]);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    let path_params, query_params, body;
    try {
      path_params = JSON.parse(form.path_params || "{}");
      query_params = JSON.parse(form.query_params || "{}");
      body = JSON.parse(form.body || "{}");
    } catch {
      alert("One or more JSON fields are invalid.");
      return;
    }
    onSave({
      ...form,
      path_params,
      query_params,
      body,
      expected_status: Number(form.expected_status),
      suite: form.suite.trim() || null,
      tag: form.tag.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            placeholder="e.g. Create product - happy path"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <input
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          placeholder="Optional notes"
        />
      </div>

      {/* Base URL */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Base URL *</label>
        <input
          required
          value={form.base_url}
          onChange={(e) => set("base_url", e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Suite + Tag */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Suite</label>
          <input
            value={form.suite}
            onChange={(e) => set("suite", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            placeholder="e.g. products, smoke, auth"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tag</label>
          <input
            value={form.tag}
            onChange={(e) => set("tag", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            placeholder="e.g. happy-path, edge-case"
          />
        </div>
      </div>

      {/* Method + Endpoint + Expected Status */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Method *</label>
          <select
            value={form.method}
            onChange={(e) => set("method", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Endpoint *</label>
          <input
            required
            value={form.endpoint}
            onChange={(e) => set("endpoint", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            placeholder="/products/{id}"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Exp. Status</label>
          <input
            type="number"
            value={form.expected_status}
            onChange={(e) => set("expected_status", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* JSON fields */}
      <div className="grid grid-cols-3 gap-3">
        <JsonField label="Path Params (JSON)" value={form.path_params} onChange={(v) => set("path_params", v)} />
        <JsonField label="Query Params (JSON)" value={form.query_params} onChange={(v) => set("query_params", v)} />
        <JsonField label="Request Body (JSON)" value={form.body} onChange={(v) => set("body", v)} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded border border-gray-700 hover:border-gray-500">
          Cancel
        </button>
        <button type="submit" className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded">
          {initial ? "Update" : "Save Test Case"}
        </button>
      </div>
    </form>
  );
}
