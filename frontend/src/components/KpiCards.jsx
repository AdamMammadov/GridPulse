import { Radio, Target, Timer, Flag } from "lucide-react";

export default function KpiCards({ summary }) {
  const cards = [
    { label: "İzlənən sayğac", value: summary.meters_monitored, icon: Radio },
    { label: "Recall", value: `${summary.recall_pct}%`, icon: Target },
    { label: "Sınaq müddəti", value: `${summary.days_of_data} gün`, icon: Timer },
    { label: "Bayraqlı hadisə", value: summary.total_flagged_events.toLocaleString(), icon: Flag },
  ];
  return (
    <div className="kpi-grid">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div className="kpi-card" key={c.label}>
            <div>
              <p className="label">{c.label}</p>
              <p className="value">{c.value}</p>
            </div>
            <div className="icon-wrap">
              <Icon size={17} strokeWidth={2} />
            </div>
          </div>
        );
      })}
    </div>
  );
}