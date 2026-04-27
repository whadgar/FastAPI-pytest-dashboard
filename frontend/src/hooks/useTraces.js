import { useState, useCallback } from "react";
import client from "../api/client.js";

export function useTraces() {
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(false);

  const fetchTraces = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await client.get("/traces", { params });
      setData(res.data);
    } catch (err) {
      console.warn("[useTraces] Could not fetch traces:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, fetchTraces };
}
