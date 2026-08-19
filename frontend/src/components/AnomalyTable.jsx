const BAND_COLORS = { high: "#e85c4a", mid: "#f4c542" };

function severityLabel(z) {
  const abs = Math.abs(z);
  if (abs > 8) return { text: "Yüksək", color: BAND_COLORS.high };
  return { text: "Orta", color: BAND_COLORS.mid };
}

export default function AnomalyTable({ anomalies }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Sayğac</th>
          <th>Zona</th>
          <th>Tarix</th>
          <th>Real (kWh)</th>
          <th>Gözlənilən (kWh)</th>
          <th>Şiddət</th>
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