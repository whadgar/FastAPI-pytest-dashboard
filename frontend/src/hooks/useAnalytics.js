import { useState, useEffect } from "react";
import client from "../api/client.js";

export function useAnalytics(fromDate, toDate) {
  const [summary, setSummary]           = useState(null);
  const [passFail, setPassFail]         = useState(null);
  const [responseTimes, setResponseTimes] = useState([]);
  const [callsPerEndpoint, setCallsPerEndpoint] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const params = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate)   params.to_date   = toDate;

    setLoading(true);
    Promise.all([
      client.get("/analytics/summary",            { params }),
      client.get("/analytics/pass-fail",          { params }),
      client.get("/analytics/response-times",     { params }),
      client.get("/analytics/calls-per-endpoint", { params }),
    ])
      .then(([s, pf, rt, cpe]) => {
        setSummary(s.data);
        setPassFail(pf.data);
        setResponseTimes(rt.data);
        setCallsPerEndpoint(cpe.data);
      })
      .catch((err) => {
        console.warn("[useAnalytics] Could not fetch analytics:", err.message);
      })
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  return { summary, passFail, responseTimes, callsPerEndpoint, loading };
}
