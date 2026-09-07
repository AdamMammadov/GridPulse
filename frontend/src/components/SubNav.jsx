import { useLanguage } from "../i18n";

// İkinci-səviyyə naviqasiya — istifadə tezliyinə görə qruplaşdırılıb (mentor
// tövsiyəsi: "ən çox istifadə olunanlara uyğun sıralama"). Hər səhifə
// (Enerji/Qaz/Fəlakət) daxilində istifadəçi bütün paneli scroll etmək
// əvəzinə birbaşa lazım olan bölməyə keçə bilir.
export default function SubNav({ tabs, active, onChange }) {
  const { t } = useLanguage();
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid #2A333A", paddingBottom: 0 }}>
      {tabs.map(({ id, labelKey, freqKey }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
              padding: "8px 16px 10px", border: "none", background: "transparent",
              borderBottom: `2px solid ${isActive ? "#F0813C" : "transparent"}`,
              cursor: "pointer", marginBottom: -1,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#fff" : "#C7D1D9" }}>
              {t(labelKey)}
            </span>
            <span style={{ fontSize: 9.5, color: isActive ? "#F0813C" : "#6B7580", textTransform: "uppercase", letterSpacing: 0.3 }}>
              {t(freqKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}