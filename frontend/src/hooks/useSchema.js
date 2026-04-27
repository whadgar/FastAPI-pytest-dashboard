import { useState, useCallback } from "react";
import client from "../api/client.js";

export function useSchema() {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSchema = useCallback(async (url) => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get("/schema", { params: { url } });
      setSchema(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load schema");
    } finally {
      setLoading(false);
    }
  }, []);

  return { schema, loading, error, fetchSchema };
}
