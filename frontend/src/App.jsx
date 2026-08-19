import { useEffect, useState } from "react";
import { Activity, Gauge, TrendingUp, ListChecks } from "lucide-react";
import { api } from "./api";
import KpiCards from "./components/KpiCards";
import ZoneRiskMap from "./components/ZoneRiskMap";
import DeviceExplorer from "./components/DeviceExplorer";
import MeterChart from "./components/MeterChart";
import ForecastChart from "./components/ForecastChart";
import AnomalyTable from "./components/AnomalyTable";
import SecurityAlertsPanel from "./components/SecurityAlertsPanel";
import DispatchQueue from "./components/DispatchQueue";
import FacilityMap from "./components/FacilityMap";
import CoPilotChat from "./components/CoPilotChat";

export default function App() {
  const [summary, setSummary] = useState(null);
  const [meters, setMeters] = useState([]);
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [meterHistory, setMeterHistory] = useState(null);
  const [zones, setZones] = useState([]);
  const [forecast, setForecast] = useState({});
  const [selectedZone, setSelectedZone] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
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
        Backend-ə qoşulmaq mümkün olmadı: {error}
        <br />
        Backend-in <code>http://localhost:8000</code> ünvanında işlədiyinə əmin ol
        (<code>uvicorn app.main:app --reload --port 8000</code>).
      </div>
    );
  }

  if (!summary) {
    return (
      <div>
        <div className="header">
          <div className="header-title">
            <div className="header-title-icon"><Activity size={18} /></div>
            <div>
              <h1>GridPulse</h1>
              <p>Yüklənir…</p>
            </div>
          </div>
        </div>
        <div className="skeleton-grid">
          {[1, 2, 3, 4].map((i) => <div className="skeleton" key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="header">
        <div className="header-title">
          <div className="header-title-icon"><Activity size={18} /></div>
          <div>
            <h1>GridPulse</h1>
            <p>Smart Energy Loss &amp; Risk Intelligence Platform</p>
          </div>
        </div>
        <span className="badge-live"><span className="dot" /> Canlı — backend qoşulub</span>
      </div>

      <KpiCards summary={summary} />

      <p className="section-title"><Gauge size={16} /> Zona risk xəritəsi</p>
      <ZoneRiskMap zones={zones} />
      <FacilityMap />
      <DeviceExplorer />

      <div className="two-col">
        <div className="panel">
          <div className="panel-header">
            <p className="section-title" style={{ margin: 0 }}><Activity size={15} /> Sayğac tarixçəsi</p>
            <select value={selectedMeter || ""} onChange={(e) => setSelectedMeter(e.target.value)}>
              {meters.map((m) => (
                <option key={m.meter_id} value={m.meter_id}>
                  {m.meter_id} — {m.zone} {m.anomaly_days > 0 ? `(${m.anomaly_days} bayraq)` : ""}
                </option>
              ))}
            </select>
          </div>
          {meterHistory && <MeterChart history={meterHistory.history} />}
        </div>

        <div className="panel">
          <div className="panel-header">
            <p className="section-title" style={{ margin: 0 }}><TrendingUp size={15} /> 7 günlük tələbat proqnozu</p>
            <select value={selectedZone || ""} onChange={(e) => setSelectedZone(e.target.value)}>
              {Object.keys(forecast).map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          {selectedZone && forecast[selectedZone] && <ForecastChart forecast={forecast[selectedZone]} />}
        </div>
      </div>

      <div className="panel">
        <p className="section-title"><ListChecks size={16} /> Son aşkarlanan anomaliyalar (30 gün)</p>
        <AnomalyTable anomalies={anomalies} />
      </div>
      <SecurityAlertsPanel />
      <DispatchQueue />
      <CoPilotChat />
    </div>
  );
}