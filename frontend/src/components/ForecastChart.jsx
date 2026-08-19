import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export default function ForecastChart({ forecast }) {
  const data = forecast.map((f) => ({ date: f.date.slice(5), kwh: f.forecast_kwh }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#2a333a" vertical={false} />
        <XAxis dataKey="date" stroke="#6b7580" fontSize={11} tickLine={false} />
        <YAxis stroke="#6b7580" fontSize={11} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1d242a", border: "1px solid #2a333a", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#fff" }}
        />
        <Line type="monotone" dataKey="kwh" stroke="#3aa6b9" strokeWidth={2} dot={{ r: 3, fill: "#3aa6b9" }} name="Proqnoz (kWh)" />
      </LineChart>
    </ResponsiveContainer>
  );
}