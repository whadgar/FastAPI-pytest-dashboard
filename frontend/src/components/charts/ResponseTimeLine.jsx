import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];

export default function ResponseTimeLine({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-8">No response time data yet.</p>;
  }

  // Pivot: [{date, endpoint, avg_ms}] → [{date, [endpoint]: avg_ms}]
  const dates = [...new Set(data.map((r) => r.date))].sort();
  const endpoints = [...new Set(data.map((r) => r.endpoint))];
  const pivoted = dates.map((date) => {
    const row = { date };
    for (const ep of endpoints) {
      const match = data.find((r) => r.date === date && r.endpoint === ep);
      row[ep] = match ? match.avg_ms : null;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={pivoted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} unit="ms" />
        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none" }} />
        <Legend />
        {endpoints.map((ep, i) => (
          <Line key={ep} type="monotone" dataKey={ep} stroke={COLORS[i % COLORS.length]} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
