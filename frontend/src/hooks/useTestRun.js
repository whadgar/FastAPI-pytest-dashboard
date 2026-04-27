import { useState, useRef, useCallback } from "react";

export function useTestRun() {
  const [logs, setLogs]       = useState([]);
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState(null);
  const esRef = useRef(null);

  const runTests = useCallback((targetUrl) => {
    setLogs([]);
    setResult(null);
    setRunning(true);

    // POST to /api/tests/run, then open SSE on same endpoint isn't standard.
    // We use fetch + ReadableStream to handle SSE from a POST response.
    fetch("/api/tests/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_url: targetUrl }),
    }).then((response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            setRunning(false);
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop(); // keep incomplete last line

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === "log") {
                  setLogs((prev) => [...prev, event.line]);
                } else if (event.type === "result") {
                  setResult(event);
                } else if (event.type === "done") {
                  setRunning(false);
                }
              } catch (_) {}
            }
          }
          read();
        });
      }
      read();
    }).catch(() => setRunning(false));
  }, []);

  const stop = useCallback(() => {
    esRef.current?.close();
    setRunning(false);
  }, []);

  return { logs, running, result, runTests, stop };
}
