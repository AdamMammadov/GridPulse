import { useEffect, useState } from "react";
import { Home, ThumbsUp, ThumbsDown, TrendingDown, TrendingUp, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";

// KONSEPT PROTOTİPİ — B2C/B2B2C genişlənməsi (Oracle Opower modeli: utility-yə
// satılır, son məhsul fərdi istifadəçiyə çatır). MÖVCUD backend datasından
// istifadə edir (yeni API yoxdur) — YALNIZ təqdimat tamamilə fərqlidir: heç
// bir jargon (z-score, risk balı) yoxdur, sadə, mobil-tərzi dizayn.
// Qeyd: konkret anomaliya növünə görə fərqli mesaj demək üçün backend-in
// /api/meters cavabına injected_type sahəsi əlavə olunmalıdır — hələlik
// ümumi, dürüst bir mesaj göstərilir.

export default function ConsumerHomeView() {
  const { t } = useLanguage();
  const [meters, setMeters] = useState([]);
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [history, setHistory] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.meters().then((list) => {
      const residential = list.filter((m) => m.anomaly_days > 0);
      setMeters(list);
      setSelectedMeter((residential[0] || list[0]).meter_id);
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedMeter) return;
    api.meterHistory(selectedMeter).then(setHistory).catch((e) => setError(e.message));
  }, [selectedMeter]);

  if (error) return <div className="error">{error}</div>;
  if (!history) return null;

  const last30 = history.history.slice(-30);
  const thisWeek = last30.slice(-7).reduce((s, d) => s + d.consumption_kwh, 0);
  const prevWeek = last30.slice(-14, -7).reduce((s, d) => s + d.consumption_kwh, 0);
  const pctChange = prevWeek ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : 0;
  const flaggedRecent = last30.filter((d) => d.is_anomaly);
  const isFlagged = flaggedRecent.length > 0;
  const maxVal = Math.max(...last30.map((d) => d.consumption_kwh), 1);
  const estMonthly = Math.round((thisWeek / 7) * 30);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{
        width: 380, background: "#0D1216", border: "1px solid #2A333A", borderRadius: 28,
        padding: "24px 20px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: "#F0813C22", display: "flex",
            alignItems: "center", justifyContent: "center", margin: "0 auto 8px",
          }}>
            <Home size={20} color="#F0813C" />
          </div>
          <p style={{ fontSize: 10, color: "#6B7580", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("consumerBrandedBy")}
          </p>
          <h2 style={{ fontSize: 18, color: "#fff", margin: "2px 0 0" }}>{t("consumerAppName")}</h2>
        </div>

        <select
          value={selectedMeter || ""}
          onChange={(e) => setSelectedMeter(e.target.value)}
          style={{ width: "100%", margin: "14px 0", fontSize: 11, textAlign: "center" }}
        >
          {meters.map((m) => (
            <option key={m.meter_id} value={m.meter_id}>{t("consumerHouseholdLabel")} {m.meter_id}</option>
          ))}
        </select>

        <div style={{
          background: isFlagged ? "#2E1B10" : "#14261A",
          border: `1px solid ${isFlagged ? "#F4C542" : "#2DC653"}`,
          borderRadius: 16, padding: 18, textAlign: "center", marginBottom: 16,
        }}>
          {isFlagged ? <AlertTriangle size={28} color="#F4C542" /> : <CheckCircle2 size={28} color="#2DC653" />}
          <p style={{ fontSize: 13, fontWeight: 700, color: isFlagged ? "#F4C542" : "#2DC653", margin: "8px 0 0" }}>
            {isFlagged ? t("consumerStatusAttention") : t("consumerStatusOk")}
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 10, color: "#6B7580", margin: 0 }}>{t("consumerEstMonthly")}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>{estMonthly} kWh</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: pctChange > 0 ? "#E85C4A" : "#2DC653", fontSize: 13, fontWeight: 700 }}>
            {pctChange > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            {Math.abs(pctChange)}%
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 50, marginBottom: 16 }}>
          {last30.map((d, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: 2, height: `${Math.max(6, (d.consumption_kwh / maxVal) * 100)}%`,
              background: d.is_anomaly ? "#E85C4A" : "#3AA6B9", opacity: d.is_anomaly ? 1 : 0.55,
            }} />
          ))}
        </div>

        {isFlagged && (
          <div style={{ background: "#12171C", border: "1px solid #2A333A", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: "#C7D1D9", lineHeight: 1.5, margin: "0 0 10px" }}>
              {"\u{1F50D}  "}{t("consumerGenericAnomalyNote")}
            </p>
            {feedback === null ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setFeedback("yes")} style={feedbackBtnStyle("#2DC653")}>
                  <ThumbsUp size={13} /> {t("consumerFeedbackYes")}
                </button>
                <button onClick={() => setFeedback("no")} style={feedbackBtnStyle("#E85C4A")}>
                  <ThumbsDown size={13} /> {t("consumerFeedbackNo")}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "#6B7580", margin: 0, fontStyle: "italic" }}>{t("consumerFeedbackThanks")}</p>
            )}
          </div>
        )}

        <p style={{ fontSize: 9, color: "#6B7580", textAlign: "center", margin: "8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Zap size={10} /> {t("consumerPoweredBy")}
        </p>
      </div>
    </div>
  );
}

function feedbackBtnStyle(color) {
  return {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    padding: "8px 0", borderRadius: 8, border: `1px solid ${color}`, background: `${color}18`,
    color, fontSize: 11, fontWeight: 700, cursor: "pointer",
  };
}