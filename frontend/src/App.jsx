import { useState } from "react";
import { Activity, Flame, AlertTriangle, ShieldAlert, HelpCircle, Home } from "lucide-react";
import { useLanguage } from "./i18n";
import EnergyPage from "./components/EnergyPage";
import GasPage from "./components/GasPage";
import DisasterScenarioPage from "./components/DisasterScenarioPage";
import SystemResilience from "./components/SystemResilience";
import FaqPage from "./components/FaqPage";
import ConsumerHomeView from "./components/ConsumerHomeView";

function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  const btnStyle = (active) => ({
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid #2A333A",
    background: active ? "#F0813C" : "#192026",
    color: active ? "#12171C" : "#6B7580",
    transition: "background 0.15s ease, color 0.15s ease",
  });
  return (
    <div style={{ display: "flex", gap: 4, background: "#12171C", padding: 3, borderRadius: 8, border: "1px solid #2A333A" }}>
      <button style={btnStyle(lang === "az")} onClick={() => setLang("az")}>AZ</button>
      <button style={btnStyle(lang === "en")} onClick={() => setLang("en")}>EN</button>
    </div>
  );
}

function PageNav({ page, setPage }) {
  const { t } = useLanguage();
  const tabs = [
    { id: "energy", labelKey: "navEnergy", Icon: Activity },
    { id: "gas", labelKey: "navGas", Icon: Flame },
    { id: "disaster", labelKey: "navDisaster", Icon: AlertTriangle },
    { id: "reliability", labelKey: "navReliability", Icon: ShieldAlert },
    { id: "faq", labelKey: "navFaq", Icon: HelpCircle },
    { id: "consumer", labelKey: "navConsumer", Icon: Home },
  ];
  return (
    <div style={{ display: "flex", gap: 4, background: "#12171C", padding: 3, borderRadius: 8, border: "1px solid #2A333A" }}>
      {tabs.map(({ id, labelKey, Icon }) => (
        <button
          key={id}
          onClick={() => setPage(id)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6,
            fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
            background: page === id ? "#F0813C" : "transparent",
            color: page === id ? "#12171C" : "#C7D1D9",
            transition: "background 0.15s ease, color 0.15s ease",
          }}
        >
          <Icon size={13} /> {t(labelKey)}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const { t } = useLanguage();
  const [page, setPage] = useState("energy");

  return (
    <div>
      <div className="header" style={{ flexWrap: "nowrap" }}>
        <div className="header-title">
          <div className="header-title-icon"><Activity size={18} /></div>
          <div>
            <h1>GridPulse</h1>
            <p>{t("appSubtitle")}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span className="badge-live"><span className="dot" /> {t("liveBadge")}</span>
          <LanguageToggle />
        </div>
      </div>

      <div style={{ marginBottom: "2rem", overflowX: "auto" }}>
        <PageNav page={page} setPage={setPage} />
      </div>

      {page === "energy" && <EnergyPage />}
      {page === "gas" && <GasPage />}
      {page === "disaster" && <DisasterScenarioPage />}
      {page === "reliability" && <SystemResilience />}
      {page === "faq" && <FaqPage />}
      {page === "consumer" && <ConsumerHomeView />}
    </div>
  );
}