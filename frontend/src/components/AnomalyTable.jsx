import { useLanguage } from "../i18n";

const BAND_COLORS = { high: "#e85c4a", mid: "#f4c542" };

export default function AnomalyTable({ anomalies }) {
  const { t } = useLanguage();

  function severityLabel(z) {
    const abs = Math.abs(z);
    if (abs > 8) return { text: t("severityHigh"), color: BAND_COLORS.high };
    return { text: t("severityMedium"), color: BAND_COLORS.mid };
  }

  return (
    <table>
      <thead>
        <tr>
          <th>{t("colMeter")}</th>
          <th>{t("colZone")}</th>
          <th>{t("colDate")}</th>
          <th>{t("colActualKwh")}</th>
          <th>{t("colExpectedKwh")}</th>
          <th>{t("colSeverity")}</th>
        </tr>
      </thead>
      <tbody>
        {anomalies.slice(0, 12).map((a, i) => {
          const sev = severityLabel(a.zscore);
          return (
            <tr key={i}>
              <td>{a.meter_id}</td>
              <td>{a.zone}</td>
              <td>{a.date}</td>
              <td>{a.consumption_kwh}</td>
              <td>{Math.round(a.expected * 10) / 10}</td>
              <td>
                <span className="status-pill" style={{ background: `${sev.color}33`, color: sev.color }}>
                  {sev.text}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}