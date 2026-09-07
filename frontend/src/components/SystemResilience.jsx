import { useEffect, useState } from "react";
import { ShieldAlert, Zap, Server, CheckCircle2, ExternalLink } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";

const BCP_ROWS = [
  { key: "power", icon: Zap, sevColor: "#2DC653" },
  { key: "network", icon: Server, sevColor: "#F4C542" },
  { key: "db", icon: Server, sevColor: "#F4C542" },
  { key: "gemini", icon: Server, sevColor: "#2DC653" },
];

export default function SystemResilience() {
  const { t, lang } = useLanguage();
  const [impact, setImpact] = useState(null);
  const [backup, setBackup] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.reliabilityImpact().then(setImpact).catch((e) => setError(e.message));
    api.backupStatus().then(setBackup).catch(() => {});
  }, []);

  return (
    <div className="panel">
      <p className="section-title"><ShieldAlert size={16} /> {t("resilienceTitle")}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 16px" }}>
        {t("resilienceSubtitle")}
      </p>

      <div style={{ background: "#14261A", border: "1px solid #2DC653", borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", gap: 10 }}>
        <CheckCircle2 size={16} color="#2DC653" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.55, margin: 0 }}>{t("resilienceKeyFact")}</p>
      </div>

      <table style={{ marginBottom: 20 }}>
        <thead>
          <tr>
            <th>{t("resilienceComponentCol")}</th>
            <th>{t("resilienceImpactCol")}</th>
            <th>{t("resilienceMitigationCol")}</th>
          </tr>
        </thead>
        <tbody>
          {BCP_ROWS.map((row) => {
            const isDbRow = row.key === "db";
            const liveMitigation = isDbRow && backup?.exists
              ? (lang === "az"
                  ? `✓ Qurulub — son backup ${backup.age_minutes} dəq əvvəl (${(backup.size_bytes / 1024 / 1024).toFixed(1)} MB)`
                  : `✓ Built — last backup ${backup.age_minutes} min ago (${(backup.size_bytes / 1024 / 1024).toFixed(1)} MB)`)
              : null;
            return (
              <tr key={row.key}>
                <td style={{ fontWeight: 600 }}>{t(`bcp_${row.key}_component`)}</td>
                <td>{t(`bcp_${row.key}_impact`)}</td>
                <td style={{ color: liveMitigation ? "#2DC653" : "#C7D1D9", fontWeight: liveMitigation ? 700 : 400 }}>
                  {liveMitigation || t(`bcp_${row.key}_mitigation`)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {error && <div className="error">{error}</div>}
      {impact && (
        <>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>{t("saidiSaifiTitle")}</p>
          <p style={{ fontSize: 11, color: "#6B7580", margin: "0 0 12px" }}>{t("saidiSaifiSubtitle")}</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ background: "#192026", border: "1px solid #F0813C", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: "#6B7580", marginBottom: 4 }}>SAIDI</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#F0813C", marginBottom: 6 }}>
                {"\u2212"}{impact.saidi.estimated_improvement_pct_range[0]}{"\u2013"}{impact.saidi.estimated_improvement_pct_range[1]}%
              </div>
              <p style={{ fontSize: 10.5, color: "#C7D1D9", lineHeight: 1.4, margin: 0 }}>
                {lang === "az" ? impact.saidi.mechanism_az : impact.saidi.mechanism_en}
              </p>
            </div>
            <div style={{ background: "#192026", border: "1px solid #3AA6B9", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: "#6B7580", marginBottom: 4 }}>SAIFI</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#3AA6B9", marginBottom: 6 }}>
                {"\u2212"}{impact.saifi.estimated_improvement_pct_range[0]}{"\u2013"}{impact.saifi.estimated_improvement_pct_range[1]}%
              </div>
              <p style={{ fontSize: 10.5, color: "#C7D1D9", lineHeight: 1.4, margin: 0 }}>
                {lang === "az" ? impact.saifi.mechanism_az : impact.saifi.mechanism_en}
              </p>
            </div>
          </div>

          <p style={{ fontSize: 10.5, color: "#6B7580", margin: "0 0 6px", fontWeight: 700 }}>{t("saidiBenchmarksLabel")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {Object.entries(impact.benchmarks).map(([key, b]) => (
              <div key={key} style={{ background: "#12171C", border: "1px solid #2A333A", borderRadius: 6, padding: "5px 10px", fontSize: 10 }}>
                <span style={{ color: "#6B7580" }}>{lang === "az" ? b.label_az : b.label_en}:</span>{" "}
                <strong style={{ color: "#fff" }}>{b.value} min/yr</strong>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 9.5, color: "#6B7580", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 4 }}>
            <ExternalLink size={10} /> {impact.benchmark_source}
          </p>

          <div style={{ background: "#2E1B10", border: "1px solid #F4C542", borderRadius: 8, padding: 10 }}>
            <p style={{ fontSize: 10.5, color: "#F4C542", lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
              {lang === "az" ? impact.disclaimer_az : impact.disclaimer_en}
            </p>
          </div>
        </>
      )}
    </div>
  );
}