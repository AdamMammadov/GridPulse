import { useEffect, useState } from "react";
import { Wallet, Leaf, Globe, Gauge } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";

export default function RoiSummary() {
  const { lang, t } = useLanguage();
  const [roi, setRoi] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.roi().then(setRoi).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">ROI error: {error}</div>;
  if (!roi) return null;

  const { pilot, national_context: ctx } = roi;

  return (
    <div className="panel">
      <p className="section-title"><Wallet size={16} /> {t("roiTitle")}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 14px" }}>
        {t("roiSubtitle")}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "#192026", border: "1px solid #2A333A", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10.5, color: "#6B7580", marginBottom: 4 }}>{t("roiDeviceSavings")}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{pilot.device_savings_azn_per_year.toLocaleString()} <span style={{ fontSize: 12, color: "#6B7580" }}>AZN/il</span></div>
          <div style={{ fontSize: 10, color: "#6B7580", marginTop: 2 }}>{t("roiDeviceSavingsSub", pilot.device_count_flagged, pilot.device_count_total)}</div>
        </div>

        <div style={{ background: "#192026", border: "1px solid #2A333A", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10.5, color: "#6B7580", marginBottom: 4 }}>{t("roiMeterRecovery")}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{pilot.meter_recovery_azn_per_year.toLocaleString()} <span style={{ fontSize: 12, color: "#6B7580" }}>AZN/il</span></div>
          <div style={{ fontSize: 10, color: "#6B7580", marginTop: 2 }}>{t("roiMeterRecoverySub", pilot.meter_count_flagged)}</div>
        </div>

        <div style={{ background: "#2E1B10", border: "1px solid #F0813C", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10.5, color: "#F4C542", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Gauge size={12} /> {t("roiCombinedTotal")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#F0813C" }}>{pilot.combined_azn_per_year.toLocaleString()} <span style={{ fontSize: 12, color: "#F4C542" }}>AZN/il</span></div>
        </div>

        <div style={{ background: "#192026", border: "1px solid #2A333A", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10.5, color: "#6B7580", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Leaf size={12} /> {t("roiCo2Card")}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#3AA6B9" }}>{pilot.device_co2_tons_per_year} <span style={{ fontSize: 12, color: "#6B7580" }}>ton/il</span></div>
        </div>
      </div>

      <div style={{ background: "#12171C", border: "1px solid #2A333A", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Globe size={14} color="#3AA6B9" />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#3AA6B9" }}>{t("roiNationalContextTitle")}</span>
        </div>
        <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.6, margin: "0 0 8px" }}>
          {lang === "az" ? ctx.note_az : ctx.note_en}
        </p>
        <p style={{ fontSize: 10.5, color: "#6B7580", margin: "0 0 2px" }}>
          {t("roiTdLossLine", ctx.az_td_loss_pct_2023)}
        </p>
        <p style={{ fontSize: 10.5, color: "#6B7580", margin: 0 }}>
          {t("roiTariffLine", ctx.residential_tariff_azn_per_kwh, ctx.industrial_tariff_azn_per_kwh)}
        </p>
      </div>
    </div>
  );
}