import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useLanguage } from "../i18n";

// Kütləvi-hadisə statistikasını rəqəm kimi deyil, HƏQİQİ görünən bir "spike"
// kimi göstərir — fəlakət günündə enerji+qaz bayraqlı sayğac sayının necə
// kəskin artdığını vizual olaraq sübut edir.
export default function AnomalySpikeChart({ energySeries, gasSeries }) {
  const { t } = useLanguage();
  const byOffset = {};
  energySeries.forEach((r) => { byOffset[r.day_offset] = { day_offset: r.day_offset, energy: r.flagged_count }; });
  gasSeries.forEach((r) => {
    byOffset[r.day_offset] = { ...(byOffset[r.day_offset] || { day_offset: r.day_offset }), gas: r.flagged_count };
  });
  const data = Object.values(byOffset).sort((a, b) => a.day_offset - b.day_offset);

  return (
    <div className="panel">
      <p className="section-title" style={{ fontSize: 13 }}>{t("disasterSpikeTitle")}</p>
      <p style={{ fontSize: 11, color: "#6B7580", margin: "-4px 0 10px" }}>{t("disasterSpikeSubtitle")}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#2a333a" vertical={false} />
          <XAxis dataKey="day_offset" stroke="#6b7580" fontSize={10} tickLine={false} tickFormatter={(v) => (v === 0 ? "T" : v > 0 ? `T+${v}` : `T${v}`)} />
          <YAxis stroke="#6b7580" fontSize={10} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#1d242a", border: "1px solid #2a333a", borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: "#fff" }}
            labelFormatter={(v) => (v === 0 ? t("disasterDayLabel") : `${v > 0 ? "+" : ""}${v} ${t("daysSuffix")}`)}
          />
          <ReferenceLine x={0} stroke="#E85C4A" strokeDasharray="4 3" label={{ value: t("disasterDayLabel"), fill: "#E85C4A", fontSize: 10, position: "top" }} />
          <Line type="monotone" dataKey="energy" stroke="#F0813C" strokeWidth={2} dot={false} name={t("navEnergy")} />
          <Line type="monotone" dataKey="gas" stroke="#3AA6B9" strokeWidth={2} dot={false} name={t("navGas")} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}