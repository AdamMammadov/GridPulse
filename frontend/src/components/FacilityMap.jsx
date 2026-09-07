import { useEffect, useState } from "react";
import { Map, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { api } from "../api";
import { useLanguage } from "../i18n";

// "zone" açarları backend-dəki neytral (ingiliscə) identifikatorlarla eynidir
// — yerləşmə/uyğunluq üçün dəyişməz saxlanılır, göstərilən mətn isə ZONE_LABELS-dən gəlir.
const ZONES = {
  "Berth / Loading Dock": { x: 20, y: 20, w: 760, h: 70, color: "#1E3A4A" },
  "Tank Farm": { x: 20, y: 108, w: 370, h: 100, color: "#243424" },
  "Safety Systems": { x: 410, y: 108, w: 370, h: 100, color: "#3A2020" },
  "Pump Station": { x: 20, y: 226, w: 235, h: 100, color: "#20304A" },
  "Compression Unit": { x: 265, y: 226, w: 235, h: 100, color: "#2A2440" },
  "Utilities": { x: 520, y: 226, w: 260, h: 100, color: "#1E3A3A" },
  "Admin Building": { x: 20, y: 344, w: 370, h: 96, color: "#2E2A1E" },
  "Perimeter": { x: 410, y: 344, w: 370, h: 96, color: "#282828" },
};

const ZONE_LABELS = {
  "Berth / Loading Dock": { az: "İskələ / Yükləmə Dokku", en: "Berth / Loading Dock" },
  "Tank Farm": { az: "Çən Təsərrüfatı", en: "Tank Farm" },
  "Safety Systems": { az: "Təhlükəsizlik Sistemləri", en: "Safety Systems" },
  "Pump Station": { az: "Nasos Stansiyası", en: "Pump Station" },
  "Compression Unit": { az: "Sıxılma Bölməsi", en: "Compression Unit" },
  "Utilities": { az: "Kommunal Xidmətlər", en: "Utilities" },
  "Admin Building": { az: "İnzibati Bina", en: "Admin Building" },
  "Perimeter": { az: "Perimetr", en: "Perimeter" },
};

const STATUS_COLOR = (d) => {
  if (d.status !== "flagged") return "#2DC653";
  if (d.diagnosis?.cause_id === "unexpected_activation") return "#E85C4A";
  return "#F4C542";
};

export default function FacilityMap() {
  const { lang, t, pick } = useLanguage();
  const [devices, setDevices] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.devices().then(setDevices).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">Facility map error: {error}</div>;
  if (!devices) return null;

  const byZone = {};
  devices.forEach((d) => {
    if (!byZone[d.zone]) byZone[d.zone] = [];
    byZone[d.zone].push(d);
  });

  const markers = [];
  Object.entries(byZone).forEach(([zoneName, list]) => {
    const z = ZONES[zoneName];
    if (!z) return;
    const spacing = z.w / (list.length + 1);
    list.forEach((d, i) => {
      markers.push({
        device: d,
        cx: z.x + spacing * (i + 1),
        cy: z.y + z.h / 2 + 14,
      });
    });
  });

  const selectedDevice = selected && devices.find((d) => d.id === selected);

  return (
    <div className="panel">
      <p className="section-title"><Map size={16} /> {t("facilityMapTitle")}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 14px" }}>
        {t("facilityMapSubtitle")}
      </p>

      <svg viewBox="0 0 800 460" style={{ width: "100%", height: "auto", background: "#12171C", borderRadius: 10 }}>
        {Object.entries(ZONES).map(([name, z]) => (
          <g key={name}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={8} fill={z.color} stroke="#2A333A" strokeWidth={1} />
            <text x={z.x + 10} y={z.y + 20} fontSize={11} fontWeight={700} fill="#C7D1D9" fontFamily="Segoe UI, sans-serif">
              {ZONE_LABELS[name]?.[lang] || name}
            </text>
          </g>
        ))}

        {markers.map(({ device, cx, cy }) => {
          const color = STATUS_COLOR(device);
          const isSelected = selected === device.id;
          return (
            <g key={device.id} onClick={() => setSelected(device.id)} style={{ cursor: "pointer" }}>
              {color === "#E85C4A" && (
                <circle cx={cx} cy={cy} r={16} fill={color} opacity={0.25}>
                  <animate attributeName="r" values="12;20;12" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.35;0.05;0.35" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={cx} cy={cy} r={isSelected ? 11 : 9} fill={color} stroke={isSelected ? "#fff" : "#12171C"} strokeWidth={2} />
              <text x={cx} y={cy + 24} fontSize={9} fill="#6B7580" textAnchor="middle" fontFamily="Segoe UI, sans-serif">
                {device.id}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10.5, color: "#6B7580" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2DC653", display: "inline-block" }} />{t("legendHealthy")}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F4C542", display: "inline-block" }} />{t("legendFlagged")}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E85C4A", display: "inline-block" }} />{t("legendCritical")}</span>
      </div>

      {selectedDevice && (
        <div style={{ marginTop: 14, background: "#1D242A", border: "1px solid #2A333A", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{pick(selectedDevice, "name")}</div>
          <div style={{ fontSize: 11, color: "#6B7580", marginBottom: 8 }}>{pick(selectedDevice, "zone")} · {selectedDevice.rated_kw} kW {t("ratedKw")}</div>

          {selectedDevice.diagnosis ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={14} color={STATUS_COLOR(selectedDevice)} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: STATUS_COLOR(selectedDevice) }}>
                  {pick(selectedDevice.diagnosis, "label")} ({selectedDevice.diagnosis.confidence_pct}%)
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.5, margin: "0 0 6px" }}>
                {pick(selectedDevice.diagnosis, "explanation")}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#2DC653" }}>
                <TrendingUp size={13} />
                {t("savingsPossible", selectedDevice.diagnosis.est_savings_azn_per_year)}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2DC653" }}>
              <CheckCircle2 size={14} /> {t("noAnomalyShort")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}