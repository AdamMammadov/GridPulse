import { useEffect, useState } from "react";
import { Activity, Gauge, TrendingUp, ListChecks, Building2, HeartPulse } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";
import SubNav from "./SubNav";
import KpiCards from "./KpiCards";
import ZoneRiskMap from "./ZoneRiskMap";
import DeviceExplorer from "./DeviceExplorer";
import CriticalInfraExplorer from "./CriticalInfraExplorer";
import MeterChart from "./MeterChart";
import ForecastChart from "./ForecastChart";
import AnomalyTable from "./AnomalyTable";
import SecurityAlertsPanel from "./SecurityAlertsPanel";
import DispatchQueue from "./DispatchQueue";
import FacilityMap from "./FacilityMap";
import CoPilotChat from "./CoPilotChat";
import RoiSummary from "./RoiSummary";
import ThresholdExplorer from "./ThresholdExplorer";
import RealDataValidation from "./RealDataValidation";

const TABS = [
  { id: "overview", labelKey: "tabOverview", freqKey: "freqDaily" },
  { id: "deepdive", labelKey: "tabDeepDive", freqKey: "freqAsNeeded" },
  { id: "reports", labelKey: "tabReports", freqKey: "freqRare" },
];

function FacilitySelector({ facility, setFacility }) {
  const { t } = useLanguage();
  const opt = (id, Icon, labelKey) => (
    <button
      onClick={() => setFacility(id)}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6,
        fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: "none",
        background: facility === id ? "#F0813C" : "transparent",
        color: facility === id ? "#12171C" : "#C7D1D9",
      }}
    >
      <Icon size={13} /> {t(labelKey)}
    </button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 11.5, color: "#6B7580" }}>{t("facilitySelectorLabel")}</span>
      <div style={{ display: "flex", gap: 4, background: "#12171C", padding: 3, borderRadius: 8, border: "1px solid #2A333A" }}>
        {opt("industrial", Building2, "facilityIndustrial")}
        {opt("critical", HeartPulse, "facilityCritical")}
      </div>
    </div>
  );
}

export default function EnergyPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [meters, setMeters] = useState([]);
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [meterHistory, setMeterHistory] = useState(null);
  const [zones, setZones] = useState([]);
  const [forecast, setForecast] = useState({});
  const [selectedZone, setSelectedZone] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [facility, setFacility] = useState("industrial");
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.summary(), api.meters(), api.zoneRisk(), api.forecast(), api.anomalies(30)])
      .then(([s, m, z, f, a]) => {
        setSummary(s);
        setMeters(m);
        setZones(z);
        setForecast(f);
        setAnomalies(a);
        const sorted = [...m].sort((a, b) => a.anomaly_days - b.anomaly_days);
        const midFlagged = sorted.find((mm) => mm.anomaly_days >= 2 && mm.anomaly_days <= 6) || sorted[0];
        setSelectedMeter(midFlagged.meter_id);
        setSelectedZone(Object.keys(f)[0]);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedMeter) return;
    api.meterHistory(selectedMeter).then((d) => setMeterHistory(d)).catch((e) => setError(e.message));
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

  return (
    <div>
      <SubNav tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <>
          <KpiCards summary={summary} />
          <p className="section-title"><Gauge size={16} /> {t("zoneRiskMapTitle")}</p>
          <ZoneRiskMap zones={zones} />
          <div className="panel">
            <p className="section-title"><ListChecks size={16} /> {t("anomalyTableTitle")}</p>
            <AnomalyTable anomalies={anomalies} />
          </div>
          <SecurityAlertsPanel fetchFn={api.meterSecurityAlerts} criticalType="theft_drop" />
          <DispatchQueue fetchFn={api.dispatchQueue} />
        </>
      )}

      {tab === "deepdive" && (
        <>
          <FacilitySelector facility={facility} setFacility={setFacility} />
          {facility === "industrial" ? (
            <>
              <FacilityMap />
              <DeviceExplorer />
            </>
          ) : (
            <CriticalInfraExplorer />
          )}

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

          <CoPilotChat />
        </>
      )}

      {tab === "reports" && (
        <>
          <RoiSummary />
          <ThresholdExplorer />
          <RealDataValidation />
        </>
      )}
    </div>
  );
}