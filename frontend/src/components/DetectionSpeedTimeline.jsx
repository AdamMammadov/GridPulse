import { Clock } from "lucide-react";
import { useLanguage } from "../i18n";

// Ənənəvi aşkarlanma (aylarla) vs GridPulse (eyni gün) — sadə, güclü vizual
// timeline. Layihənin əvvəldən bəri əsas hekayəsi (90+ gün → 1 gün) burda
// fəlakət kontekstinə tətbiq olunur.
export default function DetectionSpeedTimeline({ comparison, lang }) {
  const { t } = useLanguage();
  const traditionalPct = 100;
  const gridpulsePct = Math.max(2, (comparison.gridpulse_hours / 24 / comparison.traditional_days) * 100);

  return (
    <div className="panel">
      <p className="section-title" style={{ fontSize: 13 }}><Clock size={14} /> {t("detectionSpeedTitle")}</p>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: "#E85C4A", fontWeight: 700 }}>{t("traditionalLabel")}: {comparison.traditional_days} {t("daysSuffix")}</span>
        </div>
        <div style={{ height: 14, background: "#192026", borderRadius: 7, overflow: "hidden" }}>
          <div style={{ width: `${traditionalPct}%`, height: "100%", background: "#E85C4A" }} />
        </div>
        <p style={{ fontSize: 10.5, color: "#6B7580", margin: "4px 0 0" }}>
          {lang === "az" ? comparison.traditional_method_az : comparison.traditional_method_en}
        </p>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
          <span style={{ color: "#2DC653", fontWeight: 700 }}>GridPulse: {comparison.gridpulse_hours} {t("hoursSuffix")}</span>
        </div>
        <div style={{ height: 14, background: "#192026", borderRadius: 7, overflow: "hidden" }}>
          <div style={{ width: `${gridpulsePct}%`, height: "100%", background: "#2DC653" }} />
        </div>
        <p style={{ fontSize: 10.5, color: "#6B7580", margin: "4px 0 0" }}>
          {lang === "az" ? comparison.gridpulse_method_az : comparison.gridpulse_method_en}
        </p>
      </div>
    </div>
  );
}