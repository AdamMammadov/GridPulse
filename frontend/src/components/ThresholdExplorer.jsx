import { useEffect, useState } from "react";
import { SlidersHorizontal, Lightbulb } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { api } from "../api";
import { useLanguage } from "../i18n";

export default function ThresholdExplorer() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    api.thresholdSweep()
      .then((d) => {
        setData(d);
        const defaultIdx = d.sweep.findIndex((p) => Math.abs(p.threshold - 2.5) < 0.05);
        setIdx(defaultIdx >= 0 ? defaultIdx : Math.floor(d.sweep.length / 2));
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">Threshold sweep error: {error}</div>;
  if (!data) return null;

  const current = data.sweep[idx];
  const chartData = data.sweep.map((p) => ({
    threshold: p.threshold, recall: p.recall_pct, precision: p.precision_pct,
  }));

  return (
    <div className="panel">
      <p className="section-title"><SlidersHorizontal size={16} /> {t("thresholdTitle")}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 14px" }}>
        {t("thresholdSubtitle")}
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
          <CartesianGrid stroke="#2a333a" vertical={false} />
          <XAxis
            dataKey="threshold" stroke="#6b7580" fontSize={10} tickLine={false}
            label={{ value: t("thresholdXAxis"), position: "insideBottom", offset: -4, fontSize: 10, fill: "#6b7580" }}
          />
          <YAxis stroke="#6b7580" fontSize={11} tickLine={false} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ background: "#1d242a", border: "1px solid #2a333a", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#fff" }}
            formatter={(value, name) => [`${value}%`, name]}
            labelFormatter={(v) => `${t("thresholdXAxis")}: ${v}`}
          />
          <Line type="monotone" dataKey="recall" stroke="#3AA6B9" strokeWidth={2} dot={false} name={t("thresholdRecallLine")} isAnimationActive={false} />
          <Line type="monotone" dataKey="precision" stroke="#F0813C" strokeWidth={2} dot={false} name={t("thresholdPrecisionLine")} isAnimationActive={false} />
          <ReferenceLine x={current.threshold} stroke="#fff" strokeDasharray="3 3" strokeOpacity={0.6} />
        </LineChart>
      </ResponsiveContainer>

      <input
        type="range"
        min={0}
        max={data.sweep.length - 1}
        step={1}
        value={idx}
        onChange={(e) => setIdx(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#F0813C", margin: "4px 0 14px" }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ background: "#192026", border: "1px solid #2A333A", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#6B7580", marginBottom: 6 }}>
            {t("thresholdYourChoice")} (th={current.threshold})
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12.5 }}>
            <span style={{ color: "#3AA6B9", fontWeight: 700 }}>{t("thresholdRecallLabel")}: {current.recall_pct}%</span>
            <span style={{ color: "#F0813C", fontWeight: 700 }}>{t("thresholdPrecisionLabel")}: {current.precision_pct}%</span>
            <span style={{ color: "#6B7580" }}>{t("thresholdFlaggedLabel")}: {current.flagged_count}</span>
          </div>
        </div>

        <div style={{ background: "#14261A", border: "1px solid #2DC653", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#2DC653", marginBottom: 6, fontWeight: 700 }}>
            {t("thresholdOurSystem")}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12.5 }}>
            <span style={{ color: "#3AA6B9", fontWeight: 700 }}>{t("thresholdRecallLabel")}: {data.our_system.recall_pct}%</span>
            <span style={{ color: "#F0813C", fontWeight: 700 }}>{t("thresholdPrecisionLabel")}: {data.our_system.precision_pct}%</span>
            <span style={{ color: "#6B7580" }}>{t("thresholdFlaggedLabel")}: {data.our_system.flagged_count}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, background: "#12171C", border: "1px solid #2A333A", borderRadius: 10, padding: 12 }}>
        <Lightbulb size={14} color="#F4C542" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.55, margin: 0 }}>
          {t("thresholdInsight")}
        </p>
      </div>
    </div>
  );
}