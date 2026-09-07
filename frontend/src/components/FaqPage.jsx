import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { useLanguage } from "../i18n";

// Bütün layihə boyu real texniki qərarlardan/tapıntılardan toplanan sual-
// cavablar — mentor tövsiyəsi: "FAQ hissəsi, ən çox soruşulan suallar və
// sistem haqqında vacib problemlər/həllər". Hər cavab konkret, test edilmiş
// nəticəyə istinad edir — uydurma ümumi cavab yoxdur.
const FAQ_ITEMS = [
  {
    category: "methodology",
    q_az: "Niyə Isolation Forest deyil, z-score + persistence filtri?",
    q_en: "Why z-score + persistence filter instead of Isolation Forest?",
    a_az: "Hər ikisini sınadıq. IF-i son qərara korroborasiya siqnalı kimi qatanda (9 kombinasiya, contamination 0.03-0.08) Recall cəmi 0.2-0.4 xal artdı, amma Precision 70.5%-dən 52.9-66.5%-ə düşdü. Yəni IF bu ssenaridə əlavə yalançı həyəcan yaradır, faydalı siqnal vermir. Nəticəni real ölçdük, sonra qərar verdik.",
    a_en: "We tested both. Adding IF as a corroboration signal (9 combinations, contamination 0.03-0.08) raised Recall by only 0.2-0.4 points but dropped Precision from 70.5% to 52.9-66.5%. So IF adds false alarms here without useful signal. We measured this, then decided.",
  },
  {
    category: "methodology",
    q_az: "Niyə sadə, sabit bir z-score həddi seçmədiniz?",
    q_en: "Why not just pick a single fixed z-score threshold?",
    a_az: "Threshold Explorer-də göstərdiyimiz kimi, ~3.5 həddi bizim sistemimizlə demək olar eyni nəticəyə çatır. Fərq 'daha yaxşı' olmaq deyil — sabit bir rəqəmi sınaq-xəta ilə tapmaq əvəzinə, prinsipial qayda (2+ ardıcıl gün davam etməli) ilə bu tarazlığa etibarlı şəkildə çatmaqdır.",
    a_en: "As shown in our Threshold Explorer, ~3.5 reaches nearly the same result as our system. The difference isn't about being 'better' — it's reaching that balance reliably via a principled rule (must persist 2+ days) instead of hunting for a magic number by trial and error.",
  },
  {
    category: "data",
    q_az: "Niyə real SOCAR sayğac datası əvəzinə sintetik data istifadə edirsiniz?",
    q_en: "Why synthetic data instead of real SOCAR meter data?",
    a_az: "SOCAR yarış qaydalarına görə real data verməyəcəyini əvvəlcədən bildirib — bu, bütün komandalar üçün eynidir. Bunu gizlətmirik. Əvəzinə metodumuzu tam real, xarici (ABŞ EIA) enerji datasında sınadıq — bax aşağıdakı sual.",
    a_en: "SOCAR announced upfront it won't provide real data under the competition rules — this applies to all teams equally. We don't hide this. Instead, we tested our method on completely real, external (U.S. EIA) energy data — see the next question.",
  },
  {
    category: "data",
    q_az: "Real data validasiyası nə tapdı?",
    q_en: "What did real-data validation find?",
    a_az: "2002-2018 ABŞ PJM datasında sabit 45-günlük kalibrasiyamız TƏMİZ regionlarda 34.65% yalançı həyəcan verdi — səbəb real mövsümi trend idi. Tapdıq, izah etdik, robust sürüşən kalibrasiya ilə 3.96%-ə endirdik. 2020-2024 daha yeni EIA datasında (19 fərqli region, tam illik pəncərə) da eyni metodu sınadıq — köməkçidir, amma tam həll etmir (FP 21.2%), çünki mövsümi amplitüd nə qədər böyükdürsə, sürüşən pəncərə bir o qədər geridə qalır. Bunu da gizlətmirik.",
    a_en: "On 2002-2018 U.S. PJM data, our fixed 45-day calibration produced a 34.65% false-positive rate on clean regions — caused by real seasonal trend. We found it, explained it, and cut it to 3.96% with robust trailing calibration. On newer 2020-2024 EIA data (19 different regions, full-year window) the same fix helps but doesn't fully solve it (FP 21.2%) — the larger the seasonal swing, the more a trailing window lags. We don't hide this either.",
  },
  {
    category: "data",
    q_az: "Azərbaycan-kalibrlənmiş ssenaridəki 100%/90% rəqəmləri real nəticədirmi?",
    q_en: "Are the 100%/90% figures in the Azerbaijan-calibrated scenario a real result?",
    a_az: "Xeyr — bu, performans sübutu deyil. Baza data da, anomaliya da sintetikdir (öz alqoritmimiz öz inject etdiyimizi tapır). Yeganə real hissə mövsümi ritmdir (Bakının dərc edilmiş temperatur normaları). Real qiymətləndirmə üçün Azərişıq/SOCAR ilə real pilot lazımdır — bunu roadmap-də açıq təklif edirik.",
    a_en: "No — this is not a performance proof. Both the baseline and the anomalies are synthetic (our own algorithm finding what we planted). The only real part is the seasonal rhythm (published Baku temperature normals). Real evaluation requires a real pilot with Azerishiq/SOCAR — we propose this openly in our roadmap.",
  },
  {
    category: "safety",
    q_az: "GridPulse fiziki avadanlığı (klapan, nasos) idarə edirmi?",
    q_en: "Does GridPulse control physical equipment (valves, pumps)?",
    a_az: "Xeyr, heç vaxt. Dispatch sistemi yalnız DAXİLİ iş əmri yaradır — real SMS, zəng və ya aktuasiya göndərmir. Son qərarı və icranı həmişə insan edir. Bu, təsadüfi deyil, əsas memarlıq qərarımızdır.",
    a_en: "Never. The dispatch system only creates INTERNAL work orders — it never sends real SMS, calls, or actuation commands. A human always makes the final call and executes. This is a core architectural decision, not an afterthought.",
  },
  {
    category: "safety",
    q_az: "Elektrik/server 1 saat kəsilərsə, sistem necə davranır?",
    q_en: "If power/server goes out for an hour, how does the system behave?",
    a_az: "Yeni analiz dayanır, dashboard son keşlənmiş məlumatı göstərir — TƏHLÜKƏSİZLİK riski yaranmır, çünki GridPulse artıq heç vaxt real-vaxt fiziki idarəetmə etmirdi. Bərpadan sonra backlog avtomatik emal olunur. Tam BCP cədvəli 'Etibarlılıq' bölməsindədir.",
    a_en: "New analysis pauses, the dashboard shows the last cached data — no safety risk arises, since GridPulse never controlled anything in real time to begin with. The backlog auto-processes once restored. Full BCP table is in the 'Reliability' section.",
  },
  {
    category: "safety",
    q_az: "SAIDI/SAIFI nədir və GridPulse-un buna təsiri nə qədərdir?",
    q_en: "What are SAIDI/SAIFI and what is GridPulse's impact on them?",
    a_az: "IEEE 1366 standartının rəsmi utility etibarlılıq göstəriciləridir (orta müştərinin ildə neçə dəqiqə/dəfə kəsinti yaşaması). Azərbaycan üçün rəsmi rəqəm tapılmadı — konkret ədəd iddia etmirik. 'Etibarlılıq' bölməsində konsolidasiya və proqnozlu texniki xidmətin ehtimal olunan təsir mexanizmini (faiz diapazonu, metodologiya kimi) göstəririk.",
    a_en: "Official IEEE 1366 utility reliability indices (minutes/times per year the average customer is interrupted). No official Azerbaijan figure was found — we don't claim a specific number. The 'Reliability' section shows the likely impact mechanism of consolidation and predictive maintenance (as a percentage range, as methodology).",
  },
  {
    category: "scale",
    q_az: "2.5 milyon sayğaca necə miqyaslanacaq?",
    q_en: "How does this scale to 2.5 million meters?",
    a_az: "Hər sayğac müstəqil emal olunur ('embarrassingly parallel'). Ölçdük: 50 sayğac ~9 saniyə çəkir; xətti ekstrapolyasiya ilə tək serverdə 2.5M sayğac ~76 saat, 16 worker ilə paralelləşdirəndə isə ~4.7 saat — gecəlik batch pəncərəsinə rahat sığır.",
    a_en: "Each meter is processed independently (embarrassingly parallel). Measured: 50 meters takes ~9 seconds; linear extrapolation gives ~76 hours for 2.5M meters on one server, or ~4.7 hours with 16 parallel workers — comfortably fits a nightly batch window.",
  },
  {
    category: "scale",
    q_az: "28,114 AZN/il rəqəmi haradan gəlir, milli miqyasa vurulubmu?",
    q_en: "Where does the 28,114 AZN/year figure come from — is it scaled to national level?",
    a_az: "Xeyr, bilərəkdən vurmuruq. Bu, 10 cihaz + 50 sayğaclıq pilotun REAL hesablanmış nəticəsidir (real tarif, Tarif Şurası). Pilot qəsdən yüksək anomaliya nisbətində qurulub ki, aşkarlama qabiliyyəti göstərilsin — bunu 2.5M-ə xətti vurmaq real olmayan nəhəng rəqəm verərdi. Milli kontekst üçün Dünya Bankının rəsmi 7.6% T&D itki statistikasını göstəririk.",
    a_en: "No, we deliberately don't multiply it. This is the REAL computed result of a 10-device + 50-meter pilot (real tariffs, Tariff Council). The pilot was deliberately built with an elevated anomaly rate to demonstrate detection capability — linearly multiplying this to 2.5M would produce an unrealistic, inflated number. For national context we show the World Bank's official 7.6% T&D loss rate instead.",
  },
  {
    category: "gas",
    q_az: "Qaz sistemi enerji sisteminin sadəcə surətidirmi?",
    q_en: "Is the gas system just a copy of the energy system?",
    a_az: "Metod eynidir (bu, əslində gücdür — domain-agnostic sübutu), amma qazın öz unikal təhlükələri var: Odorizasiya (qoxu ilə sızıntı aşkarlanması) və Katodik Mühafizə (yeraltı boru korroziyası) — enerjidə heç bir analoqu olmayan, yalnız qaz sənayesinə xas sistemlərdir.",
    a_en: "The method is the same (which is actually the point — proof it's domain-agnostic), but gas has its own unique hazards: Odorization (smell-based leak detection) and Cathodic Protection (underground pipe corrosion) — systems with no energy-domain equivalent at all.",
  },
  {
    category: "methodology",
    q_az: "Niyə LSTM/dərin öyrənmə istifadə etmirsiniz?",
    q_en: "Why don't you use LSTM/deep learning?",
    a_az: "Sınadıq (PyTorch/TensorFlow mühit məhdudiyyətinə görə, praktik alternativ kimi sklearn MLP neural şəbəkəsi ilə). Nəticə NÜANSLI oldu: real 45-günlük ilkin kalibrasiya ilə (yeni quraşdırılan sayğac ssenarisi) neural şəbəkə DRAMATİK PİS işlədi (37% yalançı həyəcan, 21% Recall — data azlığından). AMMA 2 illik tarixi data ilə sınayanda, neural şəbəkə sadə trailing-mean-dən BELƏ YAXŞI proqnoz verdi. Nəticə: bizim metod YENİ sayğaclar üçün doğru seçimdir (Day-1 işə düşür, min data tələb edir); neural şəbəkə YALNIZ illərlə tarixi datası olan sayğaclar üçün gələcək təkmilləşdirmə ola bilər — həm də 2.5M sayğac üçün AYRI-AYRI model saxlamaq hesablama baxımından çox bahalı olardı.",
    a_en: "We tested this (using sklearn's MLP neural network as a practical proxy, given environment constraints preventing PyTorch/TensorFlow installation). The result was NUANCED: with a realistic 45-day initial calibration (new-meter onboarding scenario), the neural network performed DRAMATICALLY WORSE (37% false-positive rate, 21% recall — due to insufficient training data). BUT tested with 2 years of historical data, the neural network actually outperformed a simple trailing mean. Conclusion: our method is the right choice for NEW meters (works Day-1, needs minimal data); a neural network could be a future enhancement ONLY for meters with years of history — and maintaining a SEPARATE model per meter at 2.5M-meter scale would also be computationally expensive.",
  },
  {
    category: "strategy",
    q_az: "Bidgely kimi böyük şirkətlər artıq bu sahədə yoxdurmu? Sizinlə nə fərqi var?",
    q_en: "Don't large companies like Bidgely already exist in this space? How are you different?",
    a_az: "Bəli, Bidgely UtilityAI ($50M+ maliyyələşmə, 30+ data alimi, Itron tərəfdaşlığı, Duke Energy/TEPCO/SoCalGas müştəriləri) bu sahədə real, güclü oyunçudur — bunu gizlətmirik. Fərq: Bidgely böyük, inkişaf etmiş bazar utility-ləri üçün BAHALI cihaz-səviyyəli dezaqreqasiya təklif edir. GridPulse BİLƏRƏKDƏN sadə statistik metoddur — Azərbaycan kontekstinə (yerli tarif, iqlim) uyğun sürətli və ucuz tətbiq üçün optimallaşdırılıb, üstəlik qaz İNFRASTRUKTUR səviyyəsində (odorizasiya, katodik mühafizə) və fəlakət/kütləvi-hadisə aşkarlanmasında Bidgely-nin təklif etmədiyi imkanlar var.",
    a_en: "Yes, Bidgely UtilityAI ($50M+ funding, 30+ data scientists, Itron partnership, Duke Energy/TEPCO/SoCalGas customers) is a real, strong player in this space — we don't hide that. The difference: Bidgely offers expensive device-level disaggregation built for large, developed-market utilities. GridPulse is deliberately a simple statistical method — optimized for fast, low-cost deployment fit to Azerbaijan's context (local tariffs, climate), plus gas INFRASTRUCTURE-level capabilities (odorization, cathodic protection) and disaster/mass-event detection that Bidgely doesn't offer.",
  },
  {
    category: "strategy",
    q_az: "SOCAR bunu görüb özü qura bilməzmi, sizsiz?",
    q_en: "Couldn't SOCAR just see this and build it themselves, without you?",
    a_az: "Texniki olaraq bəli — z-score metodu patentlənə bilən IP deyil, akademik ədəbiyyatda sənədləşdirilib, bunu gizlətmirik. Həqiqi dəyərimiz texnologiyanın 'sirr' olması deyil — artıq QURULUB, SINANIB, AZ kontekstinə (tarif, iqlim, dil) uyğunlaşdırılıb olmasıdır. Sıfırdan başlamaqdansa, bu, aylarla vaxt qazandırır.",
    a_en: "Technically, yes — the z-score method isn't patentable IP, it's documented in academic literature, and we don't hide that. Our real value isn't that the technology is a 'secret' — it's that it's already BUILT, TESTED, and adapted to Azerbaijan's context (tariffs, climate, language). Starting from scratch would cost months that this skips.",
  },
  {
    category: "strategy",
    q_az: "2 nəfərlik komanda 2.5 milyon sayğacı necə dəstəkləyəcək?",
    q_en: "How will a 2-person team support 2.5 million meters?",
    a_az: "Dəstəkləməyəcək — heç kim bunu gözləmir. Bu, standart start-up miqyaslanma yoludur: Bidgely-nin özü kiçik başlayıb, indi 30+ data alimi var. Bizim Xərc/Gəlir planımızda bu artıq nəzərdə tutulub — Opex 55K→210K→520K AZN/il artımı məhz komanda böyüməsini maliyyələşdirir (District mərhələsində işə alma başlayır). Cari komanda Pilot fazası üçündür, City-Wide üçün deyil.",
    a_en: "It won't — no one expects it to. This is the standard startup scaling path: Bidgely itself started small and now has 30+ data scientists. Our Cost/Revenue plan already accounts for this — the Opex growth (55K→210K→520K AZN/yr) specifically funds team growth (hiring begins at District scale). The current team is sized for the Pilot phase, not City-Wide.",
  },
];

const CATEGORIES = [
  { id: "all", label_az: "Hamısı", label_en: "All" },
  { id: "methodology", label_az: "Metodologiya", label_en: "Methodology" },
  { id: "data", label_az: "Data & Validasiya", label_en: "Data & Validation" },
  { id: "safety", label_az: "Təhlükəsizlik & Etibarlılıq", label_en: "Safety & Reliability" },
  { id: "scale", label_az: "Miqyaslanma", label_en: "Scale" },
  { id: "gas", label_az: "Qaz", label_en: "Gas" },
  { id: "strategy", label_az: "Strategiya", label_en: "Strategy" },
];

function FaqItem({ item, lang }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: "1px solid #2A333A", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 14px", background: open ? "#192026" : "#12171C", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>
          {lang === "az" ? item.q_az : item.q_en}
        </span>
        <ChevronDown size={15} color="#6B7580" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0, marginLeft: 10 }} />
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <p style={{ fontSize: 11.5, color: "#C7D1D9", lineHeight: 1.6, margin: 0 }}>
            {lang === "az" ? item.a_az : item.a_en}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const { t, lang } = useLanguage();
  const [category, setCategory] = useState("all");

  const filtered = category === "all" ? FAQ_ITEMS : FAQ_ITEMS.filter((i) => i.category === category);

  return (
    <div>
      <p className="section-title"><HelpCircle size={16} /> {t("faqTitle")}</p>
      <p style={{ fontSize: 11.5, color: "#6B7580", margin: "-6px 0 16px" }}>{t("faqSubtitle")}</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              cursor: "pointer", border: "1px solid #2A333A",
              background: category === c.id ? "#F0813C" : "#12171C",
              color: category === c.id ? "#12171C" : "#C7D1D9",
            }}
          >
            {lang === "az" ? c.label_az : c.label_en}
          </button>
        ))}
      </div>

      <div className="panel">
        {filtered.map((item, i) => (
          <FaqItem key={i} item={item} lang={lang} />
        ))}
      </div>
    </div>
  );
}