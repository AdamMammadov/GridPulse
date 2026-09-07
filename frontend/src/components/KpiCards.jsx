import { Radio, Target, Timer, Flag } from "lucide-react";
import { useLanguage } from "../i18n";

export default function KpiCards({ summary }) {
  const { t } = useLanguage();
  const cards = [
    { label: t("kpiMeters"), value: summary.meters_monitored, icon: Radio },
    { label: t("kpiRecall"), value: `${summary.recall_pct}%`, icon: Target },
    { label: t("kpiTestDuration"), value: `${summary.days_of_data} ${t("daysSuffix")}`, icon: Timer },
    { label: t("kpiFlaggedEvents"), value: summary.total_flagged_events.toLocaleString(), icon: Flag },
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