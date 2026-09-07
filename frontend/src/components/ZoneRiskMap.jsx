import { CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";
import { useLanguage } from "../i18n";

const BAND = {
  critical: { color: "#e85c4a", Icon: AlertOctagon },
  risky: { color: "#f4c542", Icon: AlertTriangle },
  normal: { color: "#2dc653", Icon: CheckCircle2 },
};

export default function ZoneRiskMap({ zones }) {
  const { pick } = useLanguage();
  return (
    <div className="zone-grid">
      {zones.map((z) => {
        const b = BAND[z.band] || BAND.normal;
        const Icon = b.Icon;
        return (
          <div key={z.zone} className="zone-card" style={{ background: b.color }}>
            <div className="zone-icon"><Icon size={18} strokeWidth={2} /></div>
            <p className="zone-name">{z.zone}</p>
            <p className="zone-score">{Math.round(z.risk_score)}</p>
            <p className="zone-band">{pick(z, "band")}</p>
          </div>
        );
      })}
    </div>
  );
}