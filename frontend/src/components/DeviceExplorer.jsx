import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from "recharts";
import { AlertTriangle, CheckCircle2, Wrench, TrendingUp, Clock } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";

const CATEGORY_ICON = {
  pump: "\u{1F4A7}", compressor: "\u{1F32A}\uFE0F", hvac: "\u2744\uFE0F",
  motor: "\u2699\uFE0F", lighting: "\u{1F4A1}", safety_pump: "\u{1F6A8}",
  it_load: "\u{1F5A5}\uFE0F", hydraulic: "\u{1F6E0}\uFE0F",
};

function AnomalyDot(props) {
  const { cx, cy, payload } = props;
  if (!payload.is_anomaly) return null;
  return <Dot cx={cx} cy={cy} r={4} fill="#e85c4a" stroke="#12171c" strokeWidth={1} />;
}

export default function DeviceExplorer() {
  const { t, pick } = useLanguage();
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.devices()
      .then((list) => {
        setDevices(list);
        const firstFlagged = list.find((d) => d.status === "flagged") || list[0];
        setSelectedId(firstFlagged.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.deviceDetail(selectedId).then(setDetail).catch((e) => setError(e.message));
  }, [selectedId]);

  if (error) return <div className="error">Device data error: {error}</div>;
  if (!devices.length) return null;

  const chartData = detail
    ? detail.history.map((h) => ({
        date: h.date.slice(5),
        power: h.power_kw,
        expected: h.expected_kw,
        is_anomaly: h.is_anomaly,
      }))
    : [];

  return (
    <div className="panel">
      <p className="section-title"><Wrench size={16} /> {t("deviceFleetTitle")}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 14px" }}>
        {t("deviceFleetSubtitle")}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto" }}>
          {devices.map((d) => {
            const isSelected = d.id === selectedId;
            const flagged = d.status === "flagged";
            return (
              <div
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                style={{
                  padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                  background: isSelected ? "#F0813C22" : "#192026",
                  border: `1px solid ${isSelected ? "#F0813C" : "#2A333A"}`,
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "border-color 0.15s ease",
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
                  ? <AlertTriangle size={15} color="#F4C542" />
                  : <CheckCircle2 size={15} color="#2DC653" />}
              </div>
            );
          })}
        </div>

        <div>
          {detail && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{pick(detail, "name")}</div>
                  <div style={{ fontSize: 11, color: "#6B7580" }}>{pick(detail, "zone")} · {detail.rated_kw} kW {t("ratedKw")}</div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#2a333a" vertical={false} />
                  <XAxis dataKey="date" stroke="#6b7580" fontSize={10} tickLine={false} />
                  <YAxis stroke="#6b7580" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#1d242a", border: "1px solid #2a333a", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#fff" }} />
                  <Line type="monotone" dataKey="expected" stroke="#6b7580" strokeDasharray="4 3" strokeWidth={1.3} dot={false} name={t("legendBaseline")} />
                  <Line type="monotone" dataKey="power" stroke="#f0813c" strokeWidth={1.8} dot={<AnomalyDot />} name={t("legendActualKw")} />
                </LineChart>
              </ResponsiveContainer>

              {detail.diagnosis ? (
                <div style={{ background: "#2E1B10", border: "1px solid #F0813C", borderRadius: 10, padding: 14, marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#F0813C" }}>{pick(detail.diagnosis, "label")}</span>
                    <span style={{ fontSize: 11, color: "#F4C542", fontWeight: 700 }}>{detail.diagnosis.confidence_pct}% {t("confidenceSuffix")}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.5, margin: "0 0 8px" }}>{pick(detail.diagnosis, "explanation")}</p>
                  <p style={{ fontSize: 11.5, color: "#fff", margin: "0 0 8px" }}>
                    <strong>{t("recommendedActionLabel")}</strong> {pick(detail.diagnosis, "recommended_action")}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#2DC653" }}>
                    <TrendingUp size={13} />
                    {t("estSavingsLabel", detail.diagnosis.est_savings_azn_per_year)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#3AA6B9", marginTop: 4 }}>
                    <span style={{ fontSize: 13 }}>{"\u{1F343}"}</span>
                    {t("avoidedCo2Label", detail.diagnosis.est_co2_tons_per_year)}
                  </div>

                  {detail.diagnosis.predictive && (
                    <div style={{
                      marginTop: 10, paddingTop: 10, borderTop: "1px solid #F0813C44",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <Clock size={15} color="#F4C542" />
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#F4C542" }}>
                          {t("predictiveMaintenanceLabel")}{" "}
                        </span>
                        <span style={{ fontSize: 12, color: "#fff" }}>
                          {detail.diagnosis.predictive.days_remaining === 0
                            ? t("predictiveAtCritical")
                            : t("predictiveDaysRemaining", detail.diagnosis.predictive.days_remaining)}
                          {" "}({detail.diagnosis.predictive.trend_pct_per_month > 0 ? "+" : ""}{detail.diagnosis.predictive.trend_pct_per_month}%/{t("perMonthTrend")})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "#14261A", border: "1px solid #2DC653", borderRadius: 10, padding: 14, marginTop: 10, fontSize: 12, color: "#2DC653" }}>
                  <CheckCircle2 size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {t("noAnomalyLong")}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}