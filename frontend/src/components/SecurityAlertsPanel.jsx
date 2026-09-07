import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useLanguage } from "../i18n";

const SEVERITY_KEY = {
  critical: "sevCritical",
  high: "sevHigh",
  medium: "sevMedium",
  low: "sevLow",
};
const SEVERITY_COLOR = {
  critical: { color: "#E85C4A", bg: "#E85C4A22" },
  high: { color: "#F0813C", bg: "#F0813C22" },
  medium: { color: "#F4C542", bg: "#F4C54222" },
  low: { color: "#3AA6B9", bg: "#3AA6B922" },
};

// `fetchFn` və başlıq açarları prop kimi verilir ki, EYNİ komponent həm
// enerji, həm qaz təhlükəsizlik panelini göstərə bilsin (bax GasPage.jsx).
export default function SecurityAlertsPanel({
  fetchFn, criticalType = "theft_drop",
  titleKey = "securityPanelTitle", subtitleKey = "securityPanelSubtitle",
}) {
  const { t, pick } = useLanguage();
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFn().then(setAlerts).catch((e) => setError(e.message));
  }, [fetchFn]);

  if (error) return <div className="error">Security alerts error: {error}</div>;
  if (!alerts) return null;

  const critical = alerts.filter((a) => a.type === criticalType);
  const rest = alerts.filter((a) => a.type !== criticalType);

  return (
    <div className="panel">
      <p className="section-title"><ShieldAlert size={16} /> {t(titleKey)}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 14px" }}>
        {t(subtitleKey)}
      </p>

      {critical.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {critical.map((a) => (
            <div
              key={a.meter_id}
              style={{
                background: "#2E1210", border: "1px solid #E85C4A", borderRadius: 10,
                padding: 14, marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#E85C4A" }}>
                  {"\u{1F6A8} "}{pick(a, "label")} — {a.meter_id} ({a.zone})
                </span>
                <span style={{ fontSize: 10.5, color: "#6B7580" }}>{t("daysFlaggedSince", a.flagged_days, a.first_flagged)}</span>
              </div>
              <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.5, margin: "0 0 6px" }}>{pick(a, "explanation")}</p>
              <p style={{ fontSize: 11.5, color: "#fff", margin: 0 }}>
                <strong>{t("recommendationLabel")}</strong> {pick(a, "recommended_action")}
              </p>
            </div>
          ))}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>{t("colMeter")}</th>
            <th>{t("colZone")}</th>
            <th>{t("colClassification")}</th>
            <th>{t("colSeverity")}</th>
            <th>{t("colFlaggedDays")}</th>
          </tr>
        </thead>
        <tbody>
          {rest.map((a) => {
            const sev = SEVERITY_COLOR[a.severity];
            return (
              <tr key={a.meter_id}>
                <td>{a.meter_id}</td>
                <td>{a.zone}</td>
                <td>{pick(a, "label")}</td>
                <td>
                  <span className="status-pill" style={{ background: sev.bg, color: sev.color }}>
                    {t(SEVERITY_KEY[a.severity])}
                  </span>
                </td>
                <td>{a.flagged_days}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 10.5, color: "#6B7580" }}>
        <ShieldCheck size={13} />
        {t("securityFootnote")}
      </div>
    </div>
  );
}