import { Radio, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../i18n";

// Epicenter-dən başqa bütün zonaların "yayılma" riskini göstərir — kütləvi-
// hadisə həddinə çatmasa belə, yüngül yüksəlmə erkən xəbərdarlıqdır.
export default function CascadeRiskPanel({ energyRisk, gasRisk, anyWatch }) {
  const { t } = useLanguage();

  function Row({ z }) {
    return (
      <div key={z.zone} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", borderRadius: 8, marginBottom: 6,
        background: z.cascade_watch ? "#2E1B10" : "#192026",
        border: `1px solid ${z.cascade_watch ? "#F4C542" : "#2A333A"}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{z.zone}</span>
        <span style={{ fontSize: 11, color: "#6B7580" }}>{z.baseline_rate_pct}% → {z.post_disaster_rate_pct}%</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: z.cascade_watch ? "#F4C542" : "#6B7580", display: "flex", alignItems: "center", gap: 4 }}>
          {z.cascade_watch ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
          {z.elevation_ratio}x
        </span>
      </div>
    );
  }

  return (
    <div className="panel">
      <p className="section-title" style={{ fontSize: 13 }}><Radio size={14} /> {t("cascadeTitle")}</p>
      <p style={{ fontSize: 11, color: "#6B7580", margin: "-4px 0 12px" }}>{t("cascadeSubtitle")}</p>
      {anyWatch && (
        <div style={{ background: "#2E1B10", border: "1px solid #F4C542", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 11.5, color: "#F4C542", fontWeight: 700 }}>
          {t("cascadeWatchBanner")}
        </div>
      )}
      <div className="two-col">
        <div>
          <p style={{ fontSize: 10.5, color: "#6B7580", margin: "0 0 6px", textTransform: "uppercase" }}>{t("navEnergy")}</p>
          {energyRisk.map((z) => <Row key={z.zone} z={z} />)}
        </div>
        <div>
          <p style={{ fontSize: 10.5, color: "#6B7580", margin: "0 0 6px", textTransform: "uppercase" }}>{t("navGas")}</p>
          {gasRisk.map((z) => <Row key={z.zone} z={z} />)}
        </div>
      </div>
    </div>
  );
}