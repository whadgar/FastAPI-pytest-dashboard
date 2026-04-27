import { useRef, useEffect } from "react";
import { useTestRun } from "../hooks/useTestRun.js";
import Spinner from "./shared/Spinner.jsx";

export default function TestRunner({ targetUrl, onComplete }) {
  const { logs, running, result, runTests } = useTestRun();
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (result && onComplete) onComplete(result);
  }, [result, onComplete]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => runTests(targetUrl)}
          disabled={running || !targetUrl}
          className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors flex items-center gap-2"
        >
          {running && <Spinner size={4} />}
          {running ? "Running…" : "Run Tests"}
        </button>
        {result && (
          <span className="text-sm text-gray-300">
            <span className="text-green-400 font-bold">{result.passed}</span> passed ·{" "}
            <span className="text-red-400 font-bold">{result.failed}</span> failed ·{" "}
            {result.total} total
          </span>
        )}
      </div>

      {logs.length > 0 && (
        <div
          ref={logRef}
          className="bg-gray-950 border border-gray-800 rounded p-3 h-48 overflow-y-auto font-mono text-xs text-gray-300 space-y-0.5"
        >
          {logs.map((line, i) => (
            <div
              key={i}
              className={
                line.includes("PASSED") ? "text-green-400" :
                line.includes("FAILED") || line.includes("ERROR") ? "text-red-400" :
                "text-gray-400"
              }
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
