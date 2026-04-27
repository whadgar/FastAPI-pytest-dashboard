import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#22c55e", "#ef4444"];

export default function PassFailPie({ data }) {
  if (!data || data.total === 0) {
    return <p className="text-gray-500 text-sm text-center py-8">No test data yet.</p>;
  }
  const chartData = [
    { name: "Passed", value: data.passed },
    { name: "Failed", value: data.failed },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
