import { useState } from "react";
import { Database, Loader2, ExternalLink, Lightbulb, Calendar, MapPin } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";

export default function RealDataValidation() {
  const { lang, t } = useLanguage();
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState(null);
  const [azData, setAzData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function run() {
    setLoading(true);
    setError(null);
    Promise.all([api.realDataValidation(), api.realDataValidationRecent(), api.realDataValidationAz()])
      .then(([d, r, az]) => { setData(d); setRecent(r); setAzData(az); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  return (
    <div className="panel">
      <p className="section-title"><Database size={16} /> {t("realDataTitle")}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 14px" }}>
        {t("realDataSubtitle")}
      </p>

      {!data && (
        <button
          onClick={run}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 8, background: "#F0813C",
            border: "none", borderRadius: 8, padding: "10px 16px", color: "#12171C",
            fontSize: 12.5, fontWeight: 700, cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? <Loader2 size={14} className="spin" /> : <Database size={14} />}
          {loading ? t("realDataLoading") : t("realDataRunButton")}
        </button>
      )}

      {error && <div className="error" style={{ marginTop: 10 }}>{t("realDataError")} ({error})</div>}

      {data && (
        <>
          <p style={{ fontSize: 10.5, color: "#6B7580", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 5 }}>
            <ExternalLink size={11} />
            {t("realDataSource", data.injected_regions_count + data.clean_regions_count)}
            <span style={{ marginLeft: 8, color: "#F4C542", fontWeight: 700 }}>{"2002\u20132018"}</span>
          </p>

          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>{t("realDataSyntheticCol")}</th>
                  <th>{t("realDataNaiveCol")}</th>
                  <th>{t("realDataRobustCol")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: "#6B7580" }}>{t("realDataRecallRow")}</td>
                  <td>{data.synthetic_benchmark_recall_pct}%</td>
                  <td>{data.naive.recall_pct}%</td>
                  <td style={{ color: "#2DC653", fontWeight: 700 }}>{data.robust.recall_pct}%</td>
                </tr>
                <tr>
                  <td style={{ color: "#6B7580" }}>{t("realDataPrecisionRow")}</td>
                  <td>{data.synthetic_benchmark_precision_pct}%</td>
                  <td>{data.naive.precision_pct}%</td>
                  <td style={{ color: "#2DC653", fontWeight: 700 }}>{data.robust.precision_pct}%</td>
                </tr>
                <tr>
                  <td style={{ color: "#6B7580" }}>{t("realDataFpRow")}</td>
                  <td>{"\u2014"}</td>
                  <td style={{ color: "#E85C4A", fontWeight: 700 }}>{data.naive.clean_false_positive_rate_pct}%</td>
                  <td style={{ color: "#2DC653", fontWeight: 700 }}>{data.robust.clean_false_positive_rate_pct}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, background: "#12171C", border: "1px solid #2A333A", borderRadius: 10, padding: 12, marginBottom: 18 }}>
            <Lightbulb size={14} color="#F4C542" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#F4C542", marginBottom: 4 }}>{t("realDataFindingTitle")}</div>
              <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.55, margin: 0 }}>
                {lang === "az" ? data.finding_az : data.finding_en}
              </p>
            </div>
          </div>

          {recent && (
            <>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#3AA6B9", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={13} /> {t("realDataRecentTitle")}
                <span style={{ color: "#F4C542" }}>{"2020\u20132024"}</span>
              </p>
              <p style={{ fontSize: 10.5, color: "#6B7580", margin: "0 0 8px" }}>
                {t("realDataRecentSource", recent.region_count, recent.window_days)}
              </p>
              <div style={{ overflowX: "auto", marginBottom: 10 }}>
                <table>
                  <thead>
                    <tr><th></th><th>{t("realDataNaiveCol")}</th><th>{t("realDataRobustCol")}</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ color: "#6B7580" }}>{t("realDataPrecisionRow")}</td>
                      <td>{recent.naive.precision_pct}%</td>
                      <td style={{ color: "#2DC653", fontWeight: 700 }}>{recent.robust.precision_pct}%</td>
                    </tr>
                    <tr>
                      <td style={{ color: "#6B7580" }}>{t("realDataFpRow")}</td>
                      <td style={{ color: "#E85C4A", fontWeight: 700 }}>{recent.naive.clean_false_positive_rate_pct}%</td>
                      <td style={{ color: "#F4C542", fontWeight: 700 }}>{recent.robust.clean_false_positive_rate_pct}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11, color: "#C7D1D9", lineHeight: 1.5, margin: "0 0 18px" }}>
                {lang === "az" ? recent.note_az : recent.note_en}
              </p>
            </>
          )}

          {azData && (
            <>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#2DC653", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={13} /> {t("realDataAzTitle")}
              </p>

              <div style={{ background: "#2E1B10", border: "1px solid #F4C542", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <p style={{ fontSize: 10.5, color: "#F4C542", lineHeight: 1.5, margin: 0, fontWeight: 700 }}>
                  {t("realDataAzNotProofLabel")}
                </p>
                <p style={{ fontSize: 10.5, color: "#F4C542", lineHeight: 1.5, margin: "4px 0 0" }}>
                  {lang === "az" ? azData.purpose_az : azData.purpose_en}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10, opacity: 0.7 }}>
                <span style={{ fontSize: 10, color: "#6B7580" }}>
                  {t("realDataRecallRow")}: <strong style={{ color: "#C7D1D9" }}>{azData.recall_pct}%</strong>
                </span>
                <span style={{ fontSize: 10, color: "#6B7580" }}>
                  {t("realDataPrecisionRow")}: <strong style={{ color: "#C7D1D9" }}>{azData.precision_pct}%</strong>
                </span>
                <span style={{ fontSize: 9.5, color: "#6B7580", fontStyle: "italic" }}>{t("realDataAzCircularNote")}</span>
              </div>

              <div style={{ background: "#14261A", border: "1px solid #2DC653", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <p style={{ fontSize: 10.5, color: "#2DC653", lineHeight: 1.5, margin: 0, fontWeight: 700 }}>
                  {t("realDataAzPathLabel")}
                </p>
                <p style={{ fontSize: 10.5, color: "#C7D1D9", lineHeight: 1.5, margin: "4px 0 0" }}>
                  {lang === "az" ? azData.path_to_real_validation_az : azData.path_to_real_validation_en}
                </p>
              </div>

              <p style={{ fontSize: 9.5, color: "#6B7580", lineHeight: 1.5, margin: 0 }}>
                {lang === "az" ? azData.disclaimer_az : azData.disclaimer_en}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}