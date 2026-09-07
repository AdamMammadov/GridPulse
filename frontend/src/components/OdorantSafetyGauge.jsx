import { useEffect, useState } from "react";
import { Wind, AlertTriangle } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";

// Ayrıca, gözəçarpan widget — Odorizasiya Vahidinin (GI03) TƏK məqsədi:
// "əgər indi sızıntı olsaydı, insanlar qoxu ilə hiss edərdimi?" sualına
// birbaşa vizual cavab. Bu, siyahıdan tapmaq lazım olan bir detal deyil,
// dərhal görünən bir təhlükəsizlik göstəricisidir.
export default function OdorantSafetyGauge() {
  const { t, lang } = useLanguage();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.gasInfraDeviceDetail("GI03").then(setDetail).catch((e) => setError(e.message));
  }, []);

  if (error || !detail) return null;

  const baseline = detail.history[0]?.expected_reading || detail.rated_value;
  const current = detail.history[detail.history.length - 1]?.reading ?? detail.rated_value;
  const safeMin = baseline * 0.6;
  const maxScale = baseline * 1.3;
  const pct = Math.max(0, Math.min(100, (current / maxScale) * 100));
  const safeMinPct = (safeMin / maxScale) * 100;
  const isDanger = current < safeMin;
  const unit = pick(detail, "unit") || detail.unit_az;

  function pick(obj, field) {
    return obj?.[`${field}_${lang}`];
  }

  return (
    <div style={{
      background: isDanger ? "#2E1210" : "#0D1216",
      border: `1px solid ${isDanger ? "#E85C4A" : "#2A333A"}`,
      borderRadius: 10, padding: 16, marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Wind size={16} color={isDanger ? "#E85C4A" : "#3AA6B9"} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{t("odorantGaugeTitle")}</span>
        </div>
        {isDanger && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#E85C4A" }}>
            <AlertTriangle size={13} /> {t("odorantDangerBadge")}
          </span>
        )}
      </div>

      <div style={{ position: "relative", height: 26, background: "#192026", borderRadius: 6, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${safeMinPct}%`, background: "#E85C4A33" }} />
        <div style={{ position: "absolute", left: `${safeMinPct}%`, top: 0, bottom: 0, right: 0, background: "#2DC65322" }} />
        <div
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`,
            background: isDanger ? "#E85C4A" : "#3AA6B9", transition: "width 0.4s ease",
          }}
        />
        <div style={{ position: "absolute", left: `${safeMinPct}%`, top: 0, bottom: 0, width: 2, background: "#fff" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#6B7580" }}>
        <span>{t("odorantCurrentLabel")}: <strong style={{ color: isDanger ? "#E85C4A" : "#fff" }}>{current.toFixed(1)} {unit}</strong></span>
        <span>{t("odorantSafeMinLabel")}: {safeMin.toFixed(1)} {unit}</span>
      </div>
      <p style={{ fontSize: 11, color: "#C7D1D9", margin: "8px 0 0", lineHeight: 1.5 }}>
        {isDanger ? t("odorantDangerNote") : t("odorantSafeNote")}
      </p>
    </div>
  );
}