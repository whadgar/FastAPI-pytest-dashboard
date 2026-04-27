import Badge from "./shared/Badge.jsx";

export default function ResponsePanel({ response }) {
  if (!response) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
        Send a request to see the response here.
      </div>
    );
  }

  const { status_code, time_taken_ms, response_body, trace_id } = response;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Badge status={status_code} />
        <span className="text-sm text-gray-400">{time_taken_ms?.toFixed(1)} ms</span>
        {trace_id && (
          <span className="ml-auto text-xs text-green-500">✓ Trace saved</span>
        )}
      </div>
      <pre className="bg-gray-900 rounded p-3 text-sm text-green-300 font-mono overflow-auto max-h-96 border border-gray-800">
        {JSON.stringify(response_body, null, 2)}
      </pre>
    </div>
  );
}
