import { useEffect, useState } from "react";
import { Flame, Gauge, Activity, ListChecks, ShieldAlert, Radio, Target, Leaf, TrendingUp } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";
import SubNav from "./SubNav";
import ZoneRiskMap from "./ZoneRiskMap";
import MeterChart from "./MeterChart";
import ForecastChart from "./ForecastChart";
import AnomalyTable from "./AnomalyTable";
import SecurityAlertsPanel from "./SecurityAlertsPanel";
import GasInfraExplorer from "./GasInfraExplorer";
import OdorantSafetyGauge from "./OdorantSafetyGauge";
import DispatchQueue from "./DispatchQueue";

const TABS = [
  { id: "overview", labelKey: "tabOverview", freqKey: "freqDaily" },
  { id: "deepdive", labelKey: "tabDeepDive", freqKey: "freqAsNeeded" },
];

export default function GasPage() {
  const { t, lang } = useLanguage();
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [meters, setMeters] = useState([]);
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [meterHistory, setMeterHistory] = useState(null);
  const [zones, setZones] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [forecast, setForecast] = useState({});
  const [selectedZone, setSelectedZone] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.gasSummary(), api.gasMeters(), api.gasZoneRisk(), api.gasAnomalies(30), api.gasForecast()])
      .then(([s, m, z, a, f]) => {
        setSummary(s);
        setMeters(m);
        setZones(z);
        setAnomalies(a.map((row) => ({ ...row, consumption_kwh: row.consumption_m3 })));
        setForecast(f);
        setSelectedZone(Object.keys(f)[0]);
        const sorted = [...m].sort((a, b) => a.anomaly_days - b.anomaly_days);
        const midFlagged = sorted.find((mm) => mm.anomaly_days >= 2 && mm.anomaly_days <= 10) || sorted[sorted.length - 1];
        setSelectedMeter(midFlagged.meter_id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedMeter) return;
    api.gasMeterHistory(selectedMeter)
      .then((d) => setMeterHistory({
        ...d,
        history: d.history.map((h) => ({
          date: h.date, consumption_kwh: h.consumption_m3, expected_kwh: h.expected_m3,
          zscore: h.zscore, is_anomaly: h.is_anomaly,
        })),
      }))
      .catch((e) => setError(e.message));
  }, [selectedMeter]);

  if (error) {
    return (
      <div className="error">
        {t("connectionErrorPrefix")}{error}
        <br />
        {t("connectionErrorHint")}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((i) => <div className="skeleton" key={i} />)}
      </div>
    );
  }

  const kpis = [
    { label: t("kpiMeters"), value: summary.meters_monitored, icon: Radio, color: "#fff" },
    { label: t("gasCriticalAlerts"), value: summary.critical_safety_alerts, icon: ShieldAlert, color: "#E85C4A" },
    { label: t("gasRecoveryM3"), value: summary.est_annual_leak_recovery_m3.toLocaleString(), icon: Target, color: "#3AA6B9" },
    { label: t("gasRecoveryAzn"), value: `${summary.est_annual_leak_recovery_azn.toLocaleString()} AZN`, icon: Leaf, color: "#2DC653" },
  ];

  return (
    <div>
      <SubNav tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <>
          <div className="kpi-grid">
            {kpis.map((c) => {
              const Icon = c.icon;
              return (
                <div className="kpi-card" key={c.label}>
                  <div>
                    <p className="label">{c.label}</p>
                    <p className="value" style={{ color: c.color }}>{c.value}</p>
                  </div>
                  <div className="icon-wrap"><Icon size={17} strokeWidth={2} /></div>
                </div>
              );
            })}
          </div>

          <OdorantSafetyGauge />

          <div style={{ display: "flex", gap: 8, background: "#12171C", border: "1px solid #2A333A", borderRadius: 10, padding: 12, margin: "0 0 20px" }}>
            <ShieldAlert size={14} color="#F4C542" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#F4C542", marginBottom: 3 }}>{t("gasSafetyNoteTitle")}</div>
              <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.5, margin: 0 }}>
                {lang === "az" ? summary.safety_note_az : summary.safety_note_en}
              </p>
            </div>
          </div>

          <p className="section-title"><Gauge size={16} /> {t("zoneRiskMapTitle")}</p>
          <ZoneRiskMap zones={zones} />

          <div className="panel">
            <p className="section-title"><ListChecks size={16} /> {t("anomalyTableTitle")}</p>
            <AnomalyTable anomalies={anomalies} />
          </div>

          <SecurityAlertsPanel
            fetchFn={api.gasSecurityAlerts}
            criticalType="leak_suspected"
            titleKey="gasSecurityPanelTitle"
            subtitleKey="gasSecuritySubtitle"
          />
          <DispatchQueue fetchFn={api.gasDispatchQueue} titleKey="gasDispatchTitle" />
        </>
      )}

      {tab === "deepdive" && (
        <>
          <GasInfraExplorer />

          <div className="two-col">
            <div className="panel">
              <div className="panel-header">
                <p className="section-title" style={{ margin: 0 }}><Activity size={15} /> {t("meterHistoryTitle")}</p>
                <select value={selectedMeter || ""} onChange={(e) => setSelectedMeter(e.target.value)}>
                  {meters.map((m) => (
                    <option key={m.meter_id} value={m.meter_id}>
                      {m.meter_id} — {m.zone} {m.anomaly_days > 0 ? `(${m.anomaly_days} ${t("flagsSuffix")})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {meterHistory && <MeterChart history={meterHistory.history} />}
              <p style={{ fontSize: 10.5, color: "#6B7580", margin: "6px 0 0" }}>{t("gasMethodNote")}</p>
            </div>

            <div className="panel">
              <div className="panel-header">
                <p className="section-title" style={{ margin: 0 }}><TrendingUp size={15} /> {t("forecastTitle")}</p>
                <select value={selectedZone || ""} onChange={(e) => setSelectedZone(e.target.value)}>
                  {Object.keys(forecast).map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
              {selectedZone && forecast[selectedZone] && (
                <>
                  <ForecastChart forecast={forecast[selectedZone]} />
                  <p style={{ fontSize: 10.5, color: "#6B7580", margin: "2px 0 0" }}>
                    {t("forecastCiCaption")}
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}