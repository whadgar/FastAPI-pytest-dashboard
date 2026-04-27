import { useState, useCallback } from "react";
import client from "../api/client.js";

export function useTestCases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get("/test-cases");
      setCases(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (payload) => {
    const res = await client.post("/test-cases", payload);
    setCases((prev) => [res.data, ...prev]);
    return res.data;
  }, []);

  const update = useCallback(async (id, payload) => {
    const res = await client.put(`/test-cases/${id}`, payload);
    setCases((prev) => prev.map((tc) => (tc.test_case_id === id ? res.data : tc)));
    return res.data;
  }, []);

  const remove = useCallback(async (id) => {
    await client.delete(`/test-cases/${id}`);
    setCases((prev) => prev.filter((tc) => tc.test_case_id !== id));
  }, []);

  const runOne = useCallback(async (id) => {
    const res = await client.post(`/test-cases/${id}/run`);
    // Refresh the updated last_run fields
    setCases((prev) =>
      prev.map((tc) =>
        tc.test_case_id === id
          ? { ...tc, last_run_passed: res.data.passed, last_run_status: res.data.status_code, last_run_at: new Date().toISOString() }
          : tc
      )
    );
    return res.data;
  }, []);

  return { cases, loading, error, fetchAll, create, update, remove, runOne };
}
