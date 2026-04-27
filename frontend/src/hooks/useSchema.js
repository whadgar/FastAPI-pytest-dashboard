import { useState, useCallback } from "react";
import client from "../api/client.js";

export function useSchema() {
  const [schema, setSchema]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [logs, setLogs]       = useState([]);

  function addLog(level, message) {
    const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLogs((prev) => [...prev, { ts, level, message }]);
    const prefix = `[Load Schema] [${ts}]`;
    if (level === "error") console.error(prefix, message);
    else if (level === "warn")  console.warn(prefix, message);
    else console.log(prefix, message);
  }

  const fetchSchema = useCallback(async (url) => {
    if (!url?.trim()) return;
    setLogs([]); setSchema(null); setError(null); setLoading(true);
    console.log("━".repeat(60));
    addLog("info", `▶ Load Schema clicked — target: ${url}`);

    // ── Step 1: ping the dashboard backend ──────────────────────────────────
    addLog("info", `[Step 1] Pinging dashboard backend at /api/ …`);
    const t0 = performance.now();
    try {
      await client.get("/", { timeout: 3000 });
      const ping = Math.round(performance.now() - t0);
      addLog("success", `[Step 1] ✓ Backend reachable (${ping}ms)`);
    } catch (e) {
      const ping = Math.round(performance.now() - t0);
      const code = e.code || e.message;
      addLog("error", `[Step 1] ✗ Backend NOT reachable (${ping}ms) — ${code}`);
      addLog("error", `         Vite proxy target http://127.0.0.1:9001 is down or wrong`);
      addLog("error", `         → Make sure backend is running: uvicorn backend.main:app --host 127.0.0.1 --port 9001`);
      setError(`Dashboard backend unreachable: ${code}`);
      setLoading(false);
      console.log("━".repeat(60));
      return;
    }

    // ── Step 2: fetch /api/schema ────────────────────────────────────────────
    addLog("info", `[Step 2] GET /api/schema?url=${url}`);
    addLog("info", `         Vite proxy → http://127.0.0.1:9001/schema`);
    const t1 = performance.now();
    try {
      const res = await client.get("/schema", {
        params: { url: url.replace(/\/$/, "") },
        timeout: 15000,
      });
      const ms = Math.round(performance.now() - t1);
      addLog("success", `[Step 2] ✓ Response received in ${ms}ms`);

      // ── Step 3 (reported by backend, shown here) ─────────────────────────
      addLog("success", `[Step 3] ✓ Backend fetched ${url}/openapi.json via httpx`);
      addLog("success", `[Step 4] ✓ OpenAPI parsed — title: ${res.data.title} v${res.data.version}`);
      addLog("success", `         Endpoints found: ${res.data.endpoints?.length ?? 0}`);
      addLog("success", `✓ Schema loaded successfully`);
      console.log("━".repeat(60));
      setSchema(res.data);
    } catch (e) {
      const ms = Math.round(performance.now() - t1);
      const detail  = e.response?.data?.detail || e.message || "Unknown error";
      const errCode = e.code || "—";
      addLog("error", `[Step 2] ✗ Failed after ${ms}ms`);
      addLog("error", `         axios error code : ${errCode}`);
      addLog("error", `         detail           : ${detail}`);
      if (errCode === "ECONNABORTED" || detail.includes("timeout")) {
        addLog("warn",  `         Timeout hint: backend reached but httpx call to ${url}/openapi.json hung`);
        addLog("warn",  `         Try entering http://127.0.0.1:8000 instead of localhost:8000`);
      }
      addLog("error", `✗ Schema load failed`);
      console.log("━".repeat(60));
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, []);

  const diagnose = useCallback(async (url) => {
    if (!url?.trim()) return null;
    try {
      const res = await client.get("/schema/diagnose", { params: { url }, timeout: 15000 });
      return res.data;
    } catch (e) {
      return { error: e.response?.data?.detail || e.message };
    }
  }, []);

  return { schema, loading, error, logs, fetchSchema, diagnose };
}
