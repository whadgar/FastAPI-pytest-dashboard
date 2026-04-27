import { useAnalytics } from "../hooks/useAnalytics.js";
import PassFailPie from "../components/charts/PassFailPie.jsx";
import ResponseTimeLine from "../components/charts/ResponseTimeLine.jsx";
import CallsPerEndpoint from "../components/charts/CallsPerEndpoint.jsx";
import Badge from "../components/shared/Badge.jsx";
import Spinner from "../components/shared/Spinner.jsx";
import { useTraces } from "../hooks/useTraces.js";
import { useEffect } from "react";

function KpiCard({ label, value, sub }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value ?? "—"}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-sm font-semibold text-gray-300 mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { summary, passFail, responseTimes, callsPerEndpoint, loading } = useAnalytics();
  const { data: tracesData, fetchTraces } = useTraces();

  useEffect(() => {
    fetchTraces({ limit: 10 });
  }, [fetchTraces]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
        <Spinner /> Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Traces"     value={summary?.total_traces} />
        <KpiCard label="Test Runs"        value={summary?.total_test_runs} />
        <KpiCard label="Avg Response"     value={summary?.avg_response_time_ms != null ? `${summary.avg_response_time_ms} ms` : "—"} />
        <KpiCard label="Pass Rate"        value={summary?.pass_rate_pct != null ? `${summary.pass_rate_pct}%` : "—"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Pass / Fail">
          <PassFailPie data={passFail} />
        </ChartCard>
        <ChartCard title="Calls Per Endpoint">
          <CallsPerEndpoint data={callsPerEndpoint} />
        </ChartCard>
        <ChartCard title="Response Times Over Time">
          <ResponseTimeLine data={responseTimes} />
        </ChartCard>
      </div>

      {/* Recent Traces */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-300 mb-3">Recent Traces</p>
        {tracesData.items.length === 0 ? (
          <p className="text-gray-500 text-sm">No traces yet. Use the Explorer to fire some requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2">Timestamp</th>
                <th className="text-left pb-2">Method</th>
                <th className="text-left pb-2">Endpoint</th>
                <th className="text-left pb-2">Status</th>
                <th className="text-left pb-2">Time</th>
                <th className="text-left pb-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {tracesData.items.map((t) => (
                <tr key={t.trace_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 text-gray-500 text-xs">{new Date(t.timestamp).toLocaleString()}</td>
                  <td className="py-2 text-xs font-mono text-gray-300">{t.method}</td>
                  <td className="py-2 font-mono text-xs text-gray-300 max-w-xs truncate">{t.endpoint}</td>
                  <td className="py-2"><Badge status={t.status_code} /></td>
                  <td className="py-2 text-gray-400 text-xs">{t.time_taken_ms?.toFixed(1)} ms</td>
                  <td className="py-2 text-gray-500 text-xs">{t.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
