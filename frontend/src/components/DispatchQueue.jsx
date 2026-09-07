import { useEffect, useState } from "react";
import { Send, User, CheckCircle2, Circle, CircleDot } from "lucide-react";
import { useLanguage } from "../i18n";

const PRIORITY_STYLE = {
  URGENT: { color: "#E85C4A", bg: "#E85C4A22", key: "priorityUrgent" },
  HIGH: { color: "#F0813C", bg: "#F0813C22", key: "priorityHigh" },
  MEDIUM: { color: "#F4C542", bg: "#F4C54222", key: "priorityMedium" },
};

const STATUS_FLOW = ["pending", "acknowledged", "resolved"];

// `fetchFn` prop sayəsində EYNİ komponent həm enerji, həm qaz dispatch
// növbəsini göstərə bilir (bax GasPage.jsx).
export default function DispatchQueue({ fetchFn, titleKey = "dispatchTitle" }) {
  const { t, pick } = useLanguage();
  const [orders, setOrders] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [error, setError] = useState(null);

  const STATUS_LABEL_KEY = { pending: "statusPending", acknowledged: "statusAcknowledged", resolved: "statusResolved" };

  useEffect(() => {
    fetchFn()
      .then((data) => {
        setOrders(data);
        setStatuses(Object.fromEntries(data.map((o) => [o.ticket_id, "pending"])));
      })
      .catch((e) => setError(e.message));
  }, [fetchFn]);

  function advanceStatus(ticketId) {
    setStatuses((s) => {
      const current = s[ticketId];
      const idx = STATUS_FLOW.indexOf(current);
      const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
      return { ...s, [ticketId]: next };
    });
  }

  if (error) return <div className="error">Dispatch queue error: {error}</div>;
  if (!orders) return null;

  return (
    <div className="panel">
      <p className="section-title"><Send size={16} /> {t(titleKey)}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 14px" }}>
        {t("dispatchSubtitle", orders.length)}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {orders.map((o) => {
          const st = statuses[o.ticket_id] || "pending";
          const pr = PRIORITY_STYLE[o.priority];
          const resolved = st === "resolved";
          return (
            <div
              key={o.ticket_id}
              style={{
                background: "#1D242A", border: `1px solid ${resolved ? "#2DC653" : "#2A333A"}`,
                borderRadius: 10, padding: 12, opacity: resolved ? 0.65 : 1,
                transition: "opacity 0.2s ease, border-color 0.2s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7580" }}>{o.ticket_id}</span>
                <span className="status-pill" style={{ background: pr.bg, color: pr.color }}>{t(pr.key)}</span>
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{pick(o, "target_name")}</div>
              <div style={{ fontSize: 10.5, color: "#6B7580", marginBottom: 6 }}>{pick(o, "zone")} · {pick(o, "diagnosis_label")}</div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#C7D1D9", marginBottom: 8 }}>
                <User size={12} />
                {o.assigned_engineer} <span style={{ color: "#6B7580" }}>({pick(o, "assigned_role")})</span>
              </div>

              <button
                onClick={() => advanceStatus(o.ticket_id)}
                disabled={resolved}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontSize: 11, fontWeight: 600, padding: "6px 0", borderRadius: 7,
                  background: resolved ? "#14261A" : "#192026",
                  border: `1px solid ${resolved ? "#2DC653" : "#2A333A"}`,
                  color: resolved ? "#2DC653" : "#C7D1D9",
                  cursor: resolved ? "default" : "pointer",
                }}
              >
                {resolved ? <CheckCircle2 size={13} /> : st === "acknowledged" ? <CircleDot size={13} /> : <Circle size={13} />}
                {t(STATUS_LABEL_KEY[st])}{!resolved && t("clickToAdvance")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}