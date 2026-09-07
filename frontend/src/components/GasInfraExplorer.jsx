import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from "recharts";
import { AlertTriangle, CheckCircle2, Wind, TrendingUp, Clock, ShieldAlert, Flame } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";
import GasFlowDiagram from "./GasFlowDiagram";

const CATEGORY_ICON = {
  compressor: "\u{1F300}", regulator: "\u{1F39B}\uFE0F", odorizer: "\u{1F443}",
  safety_valve: "\u{1F6D1}", metering: "\u{1F4CA}", corrosion_protection: "\u26A1",
};
const SEVERITY_COLOR = { critical: "#E85C4A", high: "#F0813C", medium: "#F4C542" };

function AnomalyDot(props) {
  const { cx, cy, payload } = props;
  if (!payload.is_anomaly) return null;
  return <Dot cx={cx} cy={cy} r={4} fill="#e85c4a" stroke="#12171c" strokeWidth={1} />;
}

export default function GasInfraExplorer() {
  const { t, pick } = useLanguage();
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.gasInfraDevices()
      .then((list) => {
        setDevices(list);
        const firstCritical = list.find((d) => d.diagnosis?.severity === "critical")
          || list.find((d) => d.status === "flagged") || list[0];
        setSelectedId(firstCritical.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.gasInfraDeviceDetail(selectedId).then(setDetail).catch((e) => setError(e.message));
  }, [selectedId]);

  if (error) return <div className="error">Gas infra data error: {error}</div>;
  if (!devices.length) return null;

  const chartData = detail
    ? detail.history.map((h) => ({
        date: h.date.slice(5), reading: h.reading, expected: h.expected_reading, is_anomaly: h.is_anomaly,
      }))
    : [];
  const unit = detail ? pick(detail, "unit") : "";

  return (
    <div className="panel">
      <p className="section-title"><Flame size={16} /> {t("gasInfraTitle")}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 14px" }}>
        {t("gasInfraSubtitle")}
      </p>

      <GasFlowDiagram devices={devices} selectedId={selectedId} onSelect={setSelectedId} />

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto" }}>
          {devices.map((d) => {
            const isSelected = d.id === selectedId;
            const flagged = d.status === "flagged";
            const sevColor = flagged ? SEVERITY_COLOR[d.diagnosis?.severity] || "#F4C542" : null;
            return (
              <div
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                style={{
                  padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                  background: isSelected ? "#F0813C22" : "#192026",
                  border: `1px solid ${isSelected ? "#F0813C" : "#2A333A"}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{ fontSize: 15 }}>{CATEGORY_ICON[d.category] || "\u2699\uFE0F"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {pick(d, "name")}
                  </div>
                  <div style={{ fontSize: 10, color: "#6B7580" }}>{pick(d, "zone")}</div>
                </div>
                {flagged
                  ? <AlertTriangle size={15} color={sevColor} />
                  : <CheckCircle2 size={15} color="#2DC653" />}
              </div>
            );
          })}
        </div>

        <div>
          {detail && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{pick(detail, "name")}</div>
                <div style={{ fontSize: 11, color: "#6B7580" }}>{pick(detail, "zone")} · {detail.rated_value} {unit} {t("ratedKw")}</div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6, background: "#12171C", border: "1px solid #2A333A", borderRadius: 8, padding: "8px 10px" }}>
                  <ShieldAlert size={13} color="#3AA6B9" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: "#C7D1D9" }}>
                    <strong style={{ color: "#3AA6B9" }}>{t("criticalityLabel")}</strong> {pick(detail, "criticality")}
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 10, left: -6, bottom: 0 }}>
                  <CartesianGrid stroke="#2a333a" vertical={false} />
                  <XAxis dataKey="date" stroke="#6b7580" fontSize={10} tickLine={false} />
                  <YAxis stroke="#6b7580" fontSize={10} tickLine={false} width={44} />
                  <Tooltip contentStyle={{ background: "#1d242a", border: "1px solid #2a333a", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#fff" }} formatter={(v, n) => [`${v} ${unit}`, n]} />
                  <Line type="monotone" dataKey="expected" stroke="#6b7580" strokeDasharray="4 3" strokeWidth={1.3} dot={false} name={t("legendBaseline")} />
                  <Line type="monotone" dataKey="reading" stroke="#3AA6B9" strokeWidth={1.8} dot={<AnomalyDot />} name={unit} />
                </LineChart>
              </ResponsiveContainer>

              {detail.diagnosis ? (
                <div style={{
                  background: detail.diagnosis.severity === "critical" ? "#2E1210" : "#2E1B10",
                  border: `1px solid ${SEVERITY_COLOR[detail.diagnosis.severity]}`, borderRadius: 10, padding: 14, marginTop: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: SEVERITY_COLOR[detail.diagnosis.severity] }}>{pick(detail.diagnosis, "label")}</span>
                    <span style={{ fontSize: 11, color: "#F4C542", fontWeight: 700 }}>{detail.diagnosis.confidence_pct}% {t("confidenceSuffix")}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.5, margin: "0 0 8px" }}>{pick(detail.diagnosis, "explanation")}</p>
                  <p style={{ fontSize: 11.5, color: "#fff", margin: "0 0 8px" }}>
                    <strong>{t("recommendedActionLabel")}</strong> {pick(detail.diagnosis, "recommended_action")}
                  </p>
                  {detail.diagnosis.predictive && (
                    <div style={{ marginTop: 4, paddingTop: 10, borderTop: "1px solid #F0813C44", display: "flex", alignItems: "center", gap: 8 }}>
                      <Clock size={15} color="#F4C542" />
                      <span style={{ fontSize: 12, color: "#fff" }}>{pick(detail.diagnosis.predictive, "note")}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "#14261A", border: "1px solid #2DC653", borderRadius: 10, padding: 14, marginTop: 10, fontSize: 12, color: "#2DC653" }}>
                  <CheckCircle2 size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {t("criticalDeviceHealthy")}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}