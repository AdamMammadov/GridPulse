import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useLanguage } from "../i18n";

export default function ForecastChart({ forecast }) {
  const { t } = useLanguage();
  const ciLabel = t("forecastLegendCi");
  const data = forecast.map((f) => ({
    date: f.date.slice(5),
    kwh: f.forecast_kwh,
    range: [f.lower_kwh ?? f.forecast_kwh, f.upper_kwh ?? f.forecast_kwh],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#2a333a" vertical={false} />
        <XAxis dataKey="date" stroke="#6b7580" fontSize={11} tickLine={false} />
        <YAxis stroke="#6b7580" fontSize={11} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1d242a", border: "1px solid #2a333a", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#fff" }}
          formatter={(value, name) => {
            if (name === ciLabel && Array.isArray(value)) {
              return [`${value[0]} – ${value[1]} kWh`, name];
            }
            return [`${value} kWh`, name];
          }}
        />
        <Area
          type="monotone"
          dataKey="range"
          name={ciLabel}
          stroke="none"
          fill="#3aa6b9"
          fillOpacity={0.18}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="kwh"
          name={t("forecastLegendForecast")}
          stroke="#3aa6b9"
          strokeWidth={2}
          dot={{ r: 3, fill: "#3aa6b9" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}