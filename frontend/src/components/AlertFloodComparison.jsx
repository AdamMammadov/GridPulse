import { useLanguage } from "../i18n";

// Rəqəm qutuları əvəzinə HƏQİQİ vizual metafora: "konsolidasiya olmadan"
// tərəfdə onlarla xaotik, üst-üstə düşən bildiriş ikonu (alert fatigue-i
// HİSS ETDİRİR), "konsolidasiya ilə" tərəfdə isə tək, sakit bir bildiriş.
function scatterPositions(n, seed = 7) {
  // Sadə deterministik "təsadüfi" səpələmə (hər renderdə eyni nəticə versin deyə)
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: n }, () => ({
    x: 20 + rand() * 260,
    y: 20 + rand() * 140,
    rot: (rand() - 0.5) * 40,
  }));
}

export default function AlertFloodComparison({ withoutCount, withCount }) {
  const { t } = useLanguage();
  const positions = scatterPositions(Math.min(withoutCount, 24));

  return (
    <div className="two-col">
      <div className="panel" style={{ borderColor: "#E85C4A" }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: "#E85C4A", margin: "0 0 8px" }}>{t("disasterWithoutTitle")}</p>
        <svg viewBox="0 0 300 180" style={{ width: "100%", height: 150 }}>
          {positions.map((p, i) => (
            <g key={i} transform={`translate(${p.x},${p.y}) rotate(${p.rot})`} opacity={0.9}>
              <rect x={-14} y={-11} width={28} height={22} rx={4} fill="#2E1210" stroke="#E85C4A" strokeWidth={1.3} />
              <text x={0} y={5} fontSize={13} textAnchor="middle">{"\u{1F6A8}"}</text>
            </g>
          ))}
        </svg>
        <div style={{ textAlign: "center", fontSize: 26, fontWeight: 700, color: "#E85C4A" }}>{withoutCount}</div>
        <p style={{ fontSize: 10.5, color: "#6B7580", textAlign: "center", margin: "2px 0 0" }}>{t("disasterFloodCaption")}</p>
      </div>

      <div className="panel" style={{ borderColor: "#2DC653" }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: "#2DC653", margin: "0 0 8px" }}>{t("disasterWithTitle")}</p>
        <svg viewBox="0 0 300 180" style={{ width: "100%", height: 150 }}>
          <circle cx={150} cy={80} r={40} fill="#14261A" stroke="#2DC653" strokeWidth={2}>
            <animate attributeName="r" values="38;42;38" dur="2s" repeatCount="indefinite" />
          </circle>
          <text x={150} y={92} fontSize={30} textAnchor="middle">{"\u2705"}</text>
        </svg>
        <div style={{ textAlign: "center", fontSize: 26, fontWeight: 700, color: "#2DC653" }}>{withCount}</div>
        <p style={{ fontSize: 10.5, color: "#6B7580", textAlign: "center", margin: "2px 0 0" }}>{t("disasterCalmCaption")}</p>
      </div>
    </div>
  );
}