import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useLanguage } from "../i18n";

// Fəlakətdən sonra xidmətin necə TƏDRİCƏN bərpa olunduğunu göstərən real
// (hesablanmış) əyri — yalnız təsirlənmiş sayğacların orta göstəricisi.
export default function RecoveryCurveChart({ curve, color, label, unit }) {
  const { t } = useLanguage();
  const data = curve.map((r) => ({ day_offset: r.day_offset, value: r.avg_value }));

  return (
    <div className="panel">
      <p className="section-title" style={{ fontSize: 13 }}>{label}</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#2a333a" vertical={false} />
          <XAxis dataKey="day_offset" stroke="#6b7580" fontSize={10} tickLine={false} tickFormatter={(v) => (v === 0 ? "T" : v > 0 ? `T+${v}` : `T${v}`)} />
          <YAxis stroke="#6b7580" fontSize={10} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#1d242a", border: "1px solid #2a333a", borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: "#fff" }}
            formatter={(v) => [`${v} ${unit}`, label]}
          />
          <ReferenceLine x={0} stroke="#E85C4A" strokeDasharray="4 3" />
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}