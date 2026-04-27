import { useState, useEffect } from "react";

function buildDefaultBody(requestBody) {
  if (!requestBody || requestBody.type !== "object") return "";
  const obj = {};
  for (const [name, prop] of Object.entries(requestBody.properties || {})) {
    const t = prop.type || "string";
    if (t === "string") obj[name] = "";
    else if (t === "integer" || t === "number") obj[name] = 0;
    else if (t === "boolean") obj[name] = false;
    else obj[name] = null;
  }
  return JSON.stringify(obj, null, 2);
}

export default function DynamicForm({ endpoint, onSubmit, onAddToTest, loading }) {
  const [pathParams, setPathParams] = useState({});
  const [queryParams, setQueryParams] = useState({});
  const [bodyText, setBodyText] = useState("");
  const [bodyError, setBodyError] = useState(null);

  useEffect(() => {
    if (!endpoint) return;
    const pp = {};
    for (const p of endpoint.path_params || []) pp[p.name] = "";
    const qp = {};
    for (const p of endpoint.query_params || []) qp[p.name] = "";
    setPathParams(pp);
    setQueryParams(qp);
    setBodyText(buildDefaultBody(endpoint.request_body));
    setBodyError(null);
  }, [endpoint]);

  if (!endpoint) return null;

  function parseForm() {
    let body = null;
    if (bodyText.trim()) {
      try {
        body = JSON.parse(bodyText);
        setBodyError(null);
      } catch {
        setBodyError("Invalid JSON");
        return null;
      }
    }
    return { pathParams, queryParams, body };
  }

  function handleSubmit(e) {
    e.preventDefault();
    const vals = parseForm();
    if (vals) onSubmit(vals);
  }

  function handleAddToTest(e) {
    e.preventDefault();
    const vals = parseForm();
    if (vals) onAddToTest?.(vals);
  }

  const hasBody = ["POST", "PUT", "PATCH"].includes(endpoint.method);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Path Params */}
      {endpoint.path_params?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Path Parameters</p>
          <div className="space-y-2">
            {endpoint.path_params.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <label className="text-sm text-gray-300 w-36 shrink-0">
                  {p.name}
                  {p.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <input
                  type="text"
                  value={pathParams[p.name] || ""}
                  onChange={(e) => setPathParams((prev) => ({ ...prev, [p.name]: e.target.value }))}
                  placeholder={p.type}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Query Params */}
      {endpoint.query_params?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Query Parameters</p>
          <div className="space-y-2">
            {endpoint.query_params.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <label className="text-sm text-gray-300 w-36 shrink-0">{p.name}</label>
                {p.type === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={queryParams[p.name] === "true"}
                    onChange={(e) =>
                      setQueryParams((prev) => ({ ...prev, [p.name]: e.target.checked ? "true" : "false" }))
                    }
                    className="w-4 h-4"
                  />
                ) : (
                  <input
                    type={p.type === "integer" || p.type === "number" ? "number" : "text"}
                    value={queryParams[p.name] || ""}
                    onChange={(e) => setQueryParams((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    placeholder={p.type}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Body */}
      {hasBody && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Request Body</p>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-indigo-500 resize-y"
          />
          {bodyError && <p className="text-red-400 text-xs mt-1">{bodyError}</p>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors"
        >
          {loading ? "Sending…" : "Send Request"}
        </button>
        {onAddToTest && (
          <button
            type="button"
            onClick={handleAddToTest}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded transition-colors border border-gray-600"
          >
            + Add to Test Cases
          </button>
        )}
      </div>
    </form>
  );
}
