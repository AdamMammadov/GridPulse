import { Users, Zap, Flame, Building } from "lucide-react";
import { useLanguage } from "../i18n";

const ICONS = { energy: Zap, gas: Flame, municipal: Building };
const COLORS = { energy: "#F0813C", gas: "#3AA6B9", municipal: "#F4C542" };

// Fəlakət ADİ dispatch sistemindən (mexanik/elektrik texniki) fərqli,
// xüsusiləşmiş fövqəladə hallar komandaları tələb edir — bu, real ehtiyatı
// əks etdirir.
export default function EmergencyTeamCard({ teams, lang }) {
  const { t } = useLanguage();
  return (
    <div className="panel">
      <p className="section-title" style={{ fontSize: 13 }}><Users size={14} /> {t("emergencyTeamsTitle")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {Object.entries(teams).map(([key, team]) => {
          const Icon = ICONS[key] || Users;
          const color = COLORS[key] || "#6B7580";
          return (
            <div key={key} style={{ background: "#192026", border: `1px solid ${color}44`, borderRadius: 10, padding: 12 }}>
              <Icon size={16} color={color} style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
                {lang === "az" ? team.name_az : team.name_en}
              </div>
              <div style={{ fontSize: 10.5, color: "#6B7580", marginBottom: 6 }}>
                {lang === "az" ? team.role_az : team.role_en}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color }}>
                ETA ~{team.eta_minutes} {t("minutesSuffix")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}