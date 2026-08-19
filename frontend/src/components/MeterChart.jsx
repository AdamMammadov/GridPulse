import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from "recharts";

function AnomalyDot(props) {
  const { cx, cy, payload } = props;
  if (!payload.is_anomaly) return null;
  return <Dot cx={cx} cy={cy} r={5} fill="#e85c4a" stroke="#12171c" strokeWidth={1.5} />;
}

export default function MeterChart({ history }) {
  const data = history.map((h) => ({
    date: h.date.slice(5),
    real: h.consumption_kwh,
    expected: h.expected_kwh,
    is_anomaly: h.is_anomaly,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#2a333a" vertical={false} />
        <XAxis dataKey="date" stroke="#6b7580" fontSize={11} tickLine={false} />
        <YAxis stroke="#6b7580" fontSize={11} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1d242a", border: "1px solid #2a333a", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#fff" }}
        />
        <Line type="monotone" dataKey="expected" stroke="#6b7580" strokeDasharray="4 3" strokeWidth={1.5} dot={false} name="Gözlənilən" />
        <Line type="monotone" dataKey="real" stroke="#f0813c" strokeWidth={2} dot={<AnomalyDot />} name="Real istehlak" />
      </LineChart>
    </ResponsiveContainer>
  );
}