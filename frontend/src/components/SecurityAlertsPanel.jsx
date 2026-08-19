import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "../api";

const SEVERITY = {
  critical: { color: "#E85C4A", bg: "#E85C4A22", label: "KRİTİK" },
  high: { color: "#F0813C", bg: "#F0813C22", label: "YÜKSƏK" },
  medium: { color: "#F4C542", bg: "#F4C54222", label: "ORTA" },
  low: { color: "#3AA6B9", bg: "#3AA6B922", label: "AŞAĞI" },
};

export default function SecurityAlertsPanel() {
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.meterSecurityAlerts().then(setAlerts).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">Security alerts error: {error}</div>;
  if (!alerts) return null;

  const critical = alerts.filter((a) => a.type === "theft_drop");
  const rest = alerts.filter((a) => a.type !== "theft_drop");

  return (
    <div className="panel">
      <p className="section-title"><ShieldAlert size={16} /> Security &amp; Root-Cause Classification</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 14px" }}>
        Distinguishes suspected theft/tampering from ordinary technical faults — not every anomaly is the same kind of problem.
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
                  {"\u{1F6A8} "}{a.label} — {a.meter_id} ({a.zone})
                </span>
                <span style={{ fontSize: 10.5, color: "#6B7580" }}>{a.flagged_days} gün bayraqlı · {a.first_flagged}-dən</span>
              </div>
              <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.5, margin: "0 0 6px" }}>{a.explanation}</p>
              <p style={{ fontSize: 11.5, color: "#fff", margin: 0 }}>
                <strong>Tövsiyə:</strong> {a.recommended_action}
              </p>
            </div>
          ))}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Sayğac</th>
            <th>Zona</th>
            <th>Təsnifat</th>
            <th>Şiddət</th>
            <th>Bayraqlı gün</th>
          </tr>
        </thead>
        <tbody>
          {rest.map((a) => {
            const sev = SEVERITY[a.severity];
            return (
              <tr key={a.meter_id}>
                <td>{a.meter_id}</td>
                <td>{a.zone}</td>
                <td>{a.label}</td>
                <td>
                  <span className="status-pill" style={{ background: sev.bg, color: sev.color }}>
                    {sev.label}
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
        Sınaq datasında ground-truth tiplərə əsaslanır — real datada bu, davranış-əsaslı klassifikator olacaq.
      </div>
    </div>
  );
}