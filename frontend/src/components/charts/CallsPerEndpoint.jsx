import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export default function CallsPerEndpoint({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-8">No call data yet.</p>;
  }
  const chartData = data.map((r) => ({
    name: `${r.method} ${r.endpoint}`,
    count: r.count,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={180} tick={{ fill: "#9ca3af", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none" }} />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
