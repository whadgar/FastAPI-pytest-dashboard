import Badge from "./shared/Badge.jsx";

export default function TraceCard({ trace, onClose }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">{trace.method}</span>
          <span className="font-mono text-sm text-white">{trace.endpoint}</span>
          <Badge status={trace.status_code} />
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
        <div><span className="text-gray-600">Source:</span> {trace.source}</div>
        <div><span className="text-gray-600">Time:</span> {trace.time_taken_ms?.toFixed(1)} ms</div>
        <div><span className="text-gray-600">Tag:</span> {trace.tag || "—"}</div>
        <div>
          <span className="text-gray-600">Passed:</span>{" "}
          {trace.passed === null ? "—" : trace.passed ? (
            <span className="text-green-400">✓ yes</span>
          ) : (
            <span className="text-red-400">✗ no</span>
          )}
        </div>
      </div>

      {trace.error_message && (
        <pre className="bg-red-950 border border-red-800 rounded p-2 text-xs text-red-300 font-mono overflow-auto max-h-32">
          {trace.error_message}
        </pre>
      )}

      <div>
        <p className="text-xs text-gray-500 mb-1">Payload</p>
        <pre className="bg-gray-800 rounded p-2 text-xs text-gray-300 font-mono overflow-auto max-h-32">
          {JSON.stringify(trace.payload, null, 2)}
        </pre>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Response</p>
        <pre className="bg-gray-800 rounded p-2 text-xs text-green-300 font-mono overflow-auto max-h-32">
          {JSON.stringify(trace.response_body, null, 2)}
        </pre>
      </div>
    </div>
  );
}
