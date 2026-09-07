import { useEffect, useState } from "react";
import { AlertTriangle, Zap, Flame, CheckCircle2, XCircle, Lightbulb, Loader2, MapPin } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";
import DisasterZoneMap from "./DisasterZoneMap";
import AlertFloodComparison from "./AlertFloodComparison";
import AnomalySpikeChart from "./AnomalySpikeChart";
import RecoveryCurveChart from "./RecoveryCurveChart";
import CascadeRiskPanel from "./CascadeRiskPanel";
import DetectionSpeedTimeline from "./DetectionSpeedTimeline";
import EmergencyTeamCard from "./EmergencyTeamCard";

function ZoneSelector({ zones, selected, onSelect, loading }) {
  const { t } = useLanguage();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11.5, color: "#6B7580", display: "flex", alignItems: "center", gap: 4 }}>
        <MapPin size={13} /> {t("disasterZoneSelectorLabel")}
      </span>
      <div style={{ display: "flex", gap: 4, background: "#12171C", padding: 3, borderRadius: 8, border: "1px solid #2A333A" }}>
        {zones.map((z) => (
          <button
            key={z}
            onClick={() => onSelect(z)}
            disabled={loading}
            style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 11.5, fontWeight: 700,
              cursor: loading ? "default" : "pointer", border: "none",
              background: selected === z ? "#F0813C" : "transparent",
              color: selected === z ? "#12171C" : "#C7D1D9",
            }}
          >
            {z}
          </button>
        ))}
      </div>
      {loading && <Loader2 size={14} className="spin" color="#6B7580" />}
    </div>
  );
}

export default function DisasterScenarioPage() {
  const { t, lang } = useLanguage();
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState("Zona D");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.disasterScenarioZones().then(setZones).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.disasterScenario(selectedZone)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [selectedZone]);

  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <p className="section-title"><AlertTriangle size={16} /> {t("disasterPageTitle")}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 16px" }}>
        {t("disasterPageSubtitle")}
      </p>

      {zones.length > 0 && (
        <ZoneSelector zones={zones} selected={selectedZone} onSelect={setSelectedZone} loading={loading} />
      )}

      {!data ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#6B7580", padding: "40px 0", justifyContent: "center" }}>
          <Loader2 size={18} className="spin" /> {t("loading")}
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.2s ease" }}>
              <p style={{ fontSize: 12, color: "#C7D1D9", lineHeight: 1.6, margin: "0 0 10px" }}>
                {t("disasterSetupDesc", data.scenario.zone, data.scenario.date)}
              </p>
              <DisasterZoneMap scenario={data.scenario} />

              <div className="panel">
                <p className="section-title" style={{ fontSize: 13 }}>{t("disasterDetectionTitle")}</p>

                {data.detection.dual_utility_confirmed && (
                  <div style={{
                    background: "#2E1210", border: "1px solid #E85C4A", borderRadius: 10, padding: "10px 14px",
                    marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <AlertTriangle size={16} color="#E85C4A" />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#E85C4A" }}>{t("disasterDualConfirmed")}</span>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: t("navEnergy"), Icon: Zap, event: data.detection.energy_event, detected: data.detection.energy_mass_event_detected },
                    { label: t("navGas"), Icon: Flame, event: data.detection.gas_event, detected: data.detection.gas_mass_event_detected },
                  ].map(({ label, Icon, event, detected }) => (
                    <div key={label} style={{
                      background: "#192026", border: `1px solid ${detected ? "#2DC653" : "#2A333A"}`, borderRadius: 10, padding: 14,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Icon size={15} color={detected ? "#2DC653" : "#6B7580"} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{label}</span>
                        {detected ? <CheckCircle2 size={14} color="#2DC653" style={{ marginLeft: "auto" }} /> : <XCircle size={14} color="#6B7580" style={{ marginLeft: "auto" }} />}
                      </div>
                      {event ? (
                        <>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{event.affected_fraction_pct}%</div>
                          <div style={{ fontSize: 10.5, color: "#6B7580" }}>{t("disasterFractionFlagged", event.affected_fraction_pct)} · z={event.z_score_of_event}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: "#6B7580" }}>—</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <AnomalySpikeChart energySeries={data.timeline.energy_series} gasSeries={data.timeline.gas_series} />

              <div className="two-col">
                <RecoveryCurveChart curve={data.recovery.energy_curve} color="#F0813C" label={t("recoveryEnergyTitle")} unit="kWh" />
                <RecoveryCurveChart curve={data.recovery.gas_curve} color="#3AA6B9" label={t("recoveryGasTitle")} unit="m³" />
              </div>

              <CascadeRiskPanel energyRisk={data.cascade_risk.energy} gasRisk={data.cascade_risk.gas} anyWatch={data.cascade_risk.any_watch} />

              <p className="section-title" style={{ fontSize: 13 }}>{t("disasterFloodTitle")}</p>
              <AlertFloodComparison
                withoutCount={data.without_consolidation.individual_tickets_created}
                withCount={data.with_consolidation.consolidated_alerts}
              />
              <div className="two-col" style={{ marginTop: -4, marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: "#6B7580", lineHeight: 1.5, margin: 0 }}>
                  {lang === "az" ? data.without_consolidation.note_az : data.without_consolidation.note_en}
                </p>
                <p style={{ fontSize: 11, color: "#6B7580", lineHeight: 1.5, margin: 0 }}>
                  {lang === "az" ? data.with_consolidation.note_az : data.with_consolidation.note_en}
                </p>
              </div>

              <div className="two-col">
                <DetectionSpeedTimeline comparison={data.detection_speed_comparison} lang={lang} />
                <EmergencyTeamCard teams={data.emergency_teams} lang={lang} />
              </div>

              <div style={{ display: "flex", gap: 8, background: "#12171C", border: "1px solid #2A333A", borderRadius: 10, padding: 14 }}>
                <Lightbulb size={14} color="#F4C542" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#F4C542", marginBottom: 4 }}>{t("disasterRoadmapTitle")}</div>
                  <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.55, margin: 0 }}>
                    {lang === "az" ? data.roadmap_note_az : data.roadmap_note_en}
                  </p>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}