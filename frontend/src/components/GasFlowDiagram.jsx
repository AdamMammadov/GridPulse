import { useLanguage } from "../i18n";

// Sxematik proses axını (P&ID-tərzi) — real qaz nəql zəncirinin sırası ilə:
// Sıxılma → Requlyasiya → Odorizasiya (iyləndirmə əlavəsi) → Ölçmə →
// Fövqəladə Klapan → Yeraltı Paylama Xətti (Katodik Mühafizə). Bu, siyahı
// deyil, canlı axan boru diaqramıdır — DeviceExplorer-dən qəsdən fərqli
// vizual dil istifadə edir ki, "başqa bir cihaz siyahısı" kimi görünməsin.
const STATIONS = [
  { id: "GI01", x: 90, icon: "\u{1F300}", labelKey: "flowCompression" },
  { id: "GI02", x: 230, icon: "\u{1F39B}\uFE0F", labelKey: "flowRegulation" },
  { id: "GI03", x: 370, icon: "\u{1F4A7}", labelKey: "flowOdorization", inject: true },
  { id: "GI05", x: 510, icon: "\u{1F4CA}", labelKey: "flowMetering" },
  { id: "GI04", x: 650, icon: "\u{1F6D1}", labelKey: "flowEsv", onPipe: true },
];

const STATUS_COLOR = (d) => {
  if (!d || d.status !== "flagged") return "#2DC653";
  return d.diagnosis?.severity === "critical" ? "#E85C4A" : "#F4C542";
};

export default function GasFlowDiagram({ devices, selectedId, onSelect }) {
  const { t, pick } = useLanguage();
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
  const gi06 = byId["GI06"];
  const pipelineColor = STATUS_COLOR(gi06);
  const pipeY = 150;

  return (
    <div style={{ background: "#0D1216", border: "1px solid #2A333A", borderRadius: 10, padding: "18px 10px 10px", marginBottom: 16 }}>
      <svg viewBox="0 0 880 210" style={{ width: "100%", height: "auto" }}>
        <defs>
          <pattern id="buriedHatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#2A333A" strokeWidth="2" />
          </pattern>
        </defs>

        {/* Yeraltı paylama sahəsi — Katodik Mühafizə statusuna görə rənglənir */}
        <rect x={700} y={120} width={150} height={60} rx={6} fill="url(#buriedHatch)" opacity={0.5} />
        <rect x={700} y={120} width={150} height={60} rx={6} fill="none" stroke={pipelineColor} strokeWidth={2} strokeDasharray="5 3" />
        <text x={775} y={200} fontSize={9.5} fill="#6B7580" textAnchor="middle" fontFamily="Segoe UI, sans-serif">{t("flowUnderground")}</text>

        {/* Əsas boru xətti */}
        <line x1={40} y1={pipeY} x2={840} y2={pipeY} stroke="#3A4450" strokeWidth={10} strokeLinecap="round" />
        {/* Animasiyalı axın (dashed, hərəkət edən) */}
        <line x1={40} y1={pipeY} x2={840} y2={pipeY} stroke="#3AA6B9" strokeWidth={3} strokeDasharray="10 10" strokeLinecap="round">
          <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="1.6s" repeatCount="indefinite" />
        </line>

        {/* Mənbə (giriş) ikonası */}
        <text x={20} y={pipeY + 6} fontSize={18} textAnchor="middle">{"\u{1FAA8}"}</text>
        {/* Şəhər (çıxış) ikonası */}
        <text x={860} y={pipeY + 6} fontSize={18} textAnchor="middle">{"\u{1F3D9}\uFE0F"}</text>

        {/* Odorizasiya inyeksiya oxu */}
        {STATIONS.filter((s) => s.inject).map((s) => (
          <line key={`inj-${s.id}`} x1={s.x} y1={95} x2={s.x} y2={pipeY - 6} stroke={STATUS_COLOR(byId[s.id])} strokeWidth={2} strokeDasharray="3 2" />
        ))}

        {/* Stansiyalar */}
        {STATIONS.map((s) => {
          const dev = byId[s.id];
          const color = STATUS_COLOR(dev);
          const isSelected = selectedId === s.id;
          const boxY = s.onPipe ? pipeY - 24 : 60;
          const connectorY2 = s.onPipe ? undefined : pipeY - 6;
          return (
            <g key={s.id} onClick={() => onSelect(s.id)} style={{ cursor: "pointer" }}>
              {!s.onPipe && (
                <line x1={s.x} y1={boxY + 40} x2={s.x} y2={connectorY2} stroke="#3A4450" strokeWidth={2} />
              )}
              {dev?.status === "flagged" && dev.diagnosis?.severity === "critical" && (
                <circle cx={s.x} cy={boxY + (s.onPipe ? 24 : 20)} r={26} fill={color} opacity={0.22}>
                  <animate attributeName="r" values="20;30;20" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.05;0.3" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              <rect
                x={s.x - 46} y={boxY} width={92} height={40} rx={8}
                fill="#181F26" stroke={isSelected ? "#fff" : color} strokeWidth={isSelected ? 2.5 : 1.6}
              />
              <text x={s.x - 32} y={boxY + 26} fontSize={16}>{s.icon}</text>
              <text x={s.x + 6} y={boxY + 24} fontSize={9.5} fill="#C7D1D9" textAnchor="middle" fontFamily="Segoe UI, sans-serif">{t(s.labelKey)}</text>
              <circle cx={s.x + 38} cy={boxY + 8} r={4} fill={color} />
            </g>
          );
        })}
      </svg>
      <p style={{ fontSize: 10, color: "#6B7580", textAlign: "center", margin: "2px 0 0" }}>{t("flowHint")}</p>
    </div>
  );
}