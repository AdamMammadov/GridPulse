import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2 } from "lucide-react";
import { api } from "../api";

const SUGGESTIONS = [
  "D08 nə üçün bayraqlıdır?",
  "M007 sayğacında niyə anomaliya var?",
  "Zona B risk balı nədir?",
  "Ümumi vəziyyət necədir?",
];

export default function CoPilotChat() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Salam! GridPulse AI Co-Pilot-am. Cihaz, sayğac və ya zona haqqında sual verə bilərsiniz.", source: null },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.copilotAsk(q);
      setMessages((m) => [...m, { role: "bot", text: res.answer, source: res.source, note: res.note }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: `Xəta: ${e.message}`, source: "error" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <p className="section-title"><Bot size={16} /> AI Co-Pilot</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 12px" }}>
        Real hesablanmış diaqnoz datasına əsaslanan suallar — uydurma cavab vermir.
      </p>

      <div style={{
        background: "#12171C", border: "1px solid #2A333A", borderRadius: 10,
        height: 280, overflowY: "auto", padding: "12px 14px", marginBottom: 10,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "8px 12px", borderRadius: 10, fontSize: 12.5, lineHeight: 1.5,
              background: m.role === "user" ? "#F0813C22" : "#1D242A",
              color: m.role === "user" ? "#fff" : "#C7D1D9",
              border: m.role === "user" ? "1px solid #F0813C55" : "1px solid #2A333A",
            }}>
              {m.text}
              {m.source === "gemini" && (
                <div style={{ fontSize: 9.5, color: "#3AA6B9", marginTop: 4 }}>✨ Gemini AI</div>
              )}
              {m.source === "rule_based_fallback" && (
                <div style={{ fontSize: 9.5, color: "#F4C542", marginTop: 4 }}>
                  ⚙ Ehtiyat cavab (API əlçatan olmadı)
                  {m.note && <div style={{ color: "#6B7580", marginTop: 2 }}>{m.note}</div>}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6B7580", fontSize: 12 }}>
            <Loader2 size={13} className="spin" /> Düşünür…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            style={{
              fontSize: 10.5, padding: "5px 10px", borderRadius: 999,
              background: "#192026", border: "1px solid #2A333A", color: "#C7D1D9",
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Sual yazın… (məs. D01 nə vaxt sıradan çıxacaq?)"
          style={{
            flex: 1, background: "#192026", border: "1px solid #2A333A", borderRadius: 8,
            padding: "8px 12px", color: "#fff", fontSize: 12.5, outline: "none",
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading}
          style={{
            background: "#F0813C", border: "none", borderRadius: 8, padding: "0 14px",
            cursor: "pointer", display: "flex", alignItems: "center",
          }}
        >
          <Send size={15} color="#12171C" />
        </button>
      </div>
    </div>
  );
}