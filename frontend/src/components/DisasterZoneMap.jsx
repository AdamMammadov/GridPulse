import { useLanguage } from "../i18n";

// Bütün zonalar sakit görünür, YALNIZ fəlakət zonası "zəlzələ mərkəzi"
// effekti ilə vurğulanır — animasiyalı zərbə dalğası + daxildəki real
// enerji/qaz sayğac nöqtələri (qırmızı = təsirlənib). Bu, rəqəm qutularından
// fərqli, HƏQİQƏTƏN görünən bir fəlakət təsviri yaradır.
const ALL_ZONES = ["Zona A", "Zona B", "Zona C", "Zona D", "Zona E", "Zona F"];

function MeterDots({ total, affected, cy, colorAffected }) {
  const dots = Array.from({ length: Math.min(total, 12) });
  const startX = -((dots.length - 1) * 9) / 2;
  return (
    <>
      {dots.map((_, i) => {
        const isAffected = i < affected;
        return (
          <circle
            key={i} cx={startX + i * 9} cy={cy} r={3}
            fill={isAffected ? colorAffected : "#3A4450"}
          >
            {isAffected && (
              <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" begin={`${i * 0.05}s`} repeatCount="indefinite" />
            )}
          </circle>
        );
      })}
    </>
  );
}

export default function DisasterZoneMap({ scenario }) {
  const { t } = useLanguage();
  const boxW = 130, boxH = 150, gap = 12;
  const startX = 10;

  return (
    <div style={{ background: "#0D1216", border: "1px solid #2A333A", borderRadius: 10, padding: "20px 10px 10px", marginBottom: 16 }}>
      <svg viewBox="0 0 900 190" style={{ width: "100%", height: "auto" }}>
        {ALL_ZONES.map((zone, i) => {
          const isEpicenter = zone === scenario.zone;
          const x = startX + i * (boxW + gap);
          const cx = x + boxW / 2;
          const cy = 75;
          return (
            <g key={zone}>
              {isEpicenter && (
                <>
                  {[0, 1, 2].map((ring) => (
                    <circle key={ring} cx={cx} cy={cy} r={20} fill="none" stroke="#E85C4A" strokeWidth={2} opacity={0}>
                      <animate attributeName="r" values="15;75" dur="2.4s" begin={`${ring * 0.8}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0" dur="2.4s" begin={`${ring * 0.8}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
                </>
              )}
              <rect
                x={x} y={20} width={boxW} height={boxH} rx={10}
                fill={isEpicenter ? "#2E1210" : "#181F26"}
                stroke={isEpicenter ? "#E85C4A" : "#2A333A"}
                strokeWidth={isEpicenter ? 2 : 1.2}
              />
              <text x={cx} y={40} fontSize={12} fontWeight={700} fill={isEpicenter ? "#E85C4A" : "#C7D1D9"} textAnchor="middle" fontFamily="Segoe UI, sans-serif">
                {zone}
              </text>
              {isEpicenter ? (
                <>
                  <text x={cx} y={58} fontSize={9} fill="#F4C542" textAnchor="middle" fontFamily="Segoe UI, sans-serif">{"\u26A0\uFE0F " + t("disasterEpicenter")}</text>
                  <text x={cx} y={90} fontSize={8.5} fill="#6B7580" textAnchor="middle" fontFamily="Segoe UI, sans-serif">{t("navEnergy")}</text>
                  <g transform={`translate(${cx},98)`}>
                    <MeterDots total={scenario.energy_meters_total_in_zone} affected={scenario.energy_meters_affected} cy={0} colorAffected="#F0813C" />
                  </g>
                  <text x={cx} y={122} fontSize={8.5} fill="#6B7580" textAnchor="middle" fontFamily="Segoe UI, sans-serif">{t("navGas")}</text>
                  <g transform={`translate(${cx},130)`}>
                    <MeterDots total={scenario.gas_meters_total_in_zone} affected={scenario.gas_meters_affected} cy={0} colorAffected="#3AA6B9" />
                  </g>
                  <text x={cx} y={158} fontSize={16} textAnchor="middle">{"\u{1F4A5}"}</text>
                </>
              ) : (
                <text x={cx} y={100} fontSize={18} textAnchor="middle" opacity={0.5}>{"\u2705"}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}