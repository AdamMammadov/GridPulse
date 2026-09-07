import { createContext, useContext, useState } from "react";

// Bütün statik UI mətnləri burada mərkəzləşdirilib. Backend-dən gələn dinamik
// data (diaqnoz, cihaz adı və s.) isə _az/_en suffiksli sahələr kimi gəlir —
// onun üçün pick() funksiyası istifadə olunur.
const STRINGS = {
  appSubtitle: { az: "Smart Enerji və Qaz İtkisi + Risk Kəşfiyyat Platforması", en: "Smart Energy & Gas Loss + Risk Intelligence Platform" },
  loading: { az: "Yüklənir…", en: "Loading…" },
  liveBadge: { az: "Canlı — backend qoşulub", en: "Live — backend connected" },
  connectionErrorPrefix: { az: "Backend-ə qoşulmaq mümkün olmadı: ", en: "Could not connect to backend: " },
  connectionErrorHint: {
    az: "Backend-in http://localhost:8000 ünvanında işlədiyinə əmin ol (uvicorn app.main:app --reload --port 8000).",
    en: "Make sure the backend is running at http://localhost:8000 (uvicorn app.main:app --reload --port 8000).",
  },

  zoneRiskMapTitle: { az: "Zona risk xəritəsi", en: "Zone risk map" },
  meterHistoryTitle: { az: "Sayğac tarixçəsi", en: "Meter history" },
  forecastTitle: { az: "7 günlük tələbat proqnozu", en: "7-day demand forecast" },
  forecastCiCaption: {
    az: "Kölgəli zolaq — 95% ehtimal aralığı (Holt-Winters simulyasiyası, 300 trayektoriya)",
    en: "Shaded band — 95% confidence interval (Holt-Winters simulation, 300 trajectories)",
  },
  anomalyTableTitle: { az: "Son aşkarlanan anomaliyalar (30 gün)", en: "Recently detected anomalies (30 days)" },
  flagsSuffix: { az: "bayraq", en: "flags" },

  kpiMeters: { az: "İzlənən sayğac", en: "Meters monitored" },
  kpiRecall: { az: "Recall", en: "Recall" },
  kpiTestDuration: { az: "Sınaq müddəti", en: "Test duration" },
  daysSuffix: { az: "gün", en: "days" },
  kpiFlaggedEvents: { az: "Bayraqlı hadisə", en: "Flagged events" },

  bandNormal: { az: "Normal", en: "Normal" },
  bandRisky: { az: "Riskli", en: "At Risk" },
  bandCritical: { az: "Kritik", en: "Critical" },

  meterChartExpected: { az: "Gözlənilən", en: "Expected" },
  meterChartActual: { az: "Real istehlak", en: "Actual consumption" },

  forecastLegendForecast: { az: "Proqnoz (kWh)", en: "Forecast (kWh)" },
  forecastLegendCi: { az: "95% ehtimal aralığı", en: "95% confidence interval" },

  colMeter: { az: "Sayğac", en: "Meter" },
  colZone: { az: "Zona", en: "Zone" },
  colDate: { az: "Tarix", en: "Date" },
  colActualKwh: { az: "Real (kWh)", en: "Actual (kWh)" },
  colExpectedKwh: { az: "Gözlənilən (kWh)", en: "Expected (kWh)" },
  colSeverity: { az: "Şiddət", en: "Severity" },
  colClassification: { az: "Təsnifat", en: "Classification" },
  colFlaggedDays: { az: "Bayraqlı gün", en: "Flagged days" },

  severityHigh: { az: "Yüksək", en: "High" },
  severityMedium: { az: "Orta", en: "Medium" },
  sevCritical: { az: "KRİTİK", en: "CRITICAL" },
  sevHigh: { az: "YÜKSƏK", en: "HIGH" },
  sevMedium: { az: "ORTA", en: "MEDIUM" },
  sevLow: { az: "AŞAĞI", en: "LOW" },

  securityPanelTitle: { az: "Təhlükəsizlik və Kök-Səbəb Təsnifatı", en: "Security & Root-Cause Classification" },
  securityPanelSubtitle: {
    az: "Ehtimal olunan oğurluq/müdaxiləni adi texniki nasazlıqdan ayırır — hər anomaliya eyni növ problem deyil.",
    en: "Distinguishes suspected theft/tampering from ordinary technical faults — not every anomaly is the same kind of problem.",
  },
  recommendationLabel: { az: "Tövsiyə:", en: "Recommendation:" },
  daysFlaggedSince: { az: (days, since) => `${days} gün bayraqlı · ${since}-dən`, en: (days, since) => `${days} days flagged · since ${since}` },
  securityFootnote: {
    az: "Sınaq datasında ground-truth tiplərə əsaslanır — real datada bu, davranış-əsaslı klassifikator olacaq.",
    en: "Based on ground-truth types in test data — in real data this will be a behavior-based classifier.",
  },

  dispatchTitle: { az: "Auto-Dispatch — İş Əmri Növbəsi", en: "Auto-Dispatch — Work Order Queue" },
  dispatchSubtitle: {
    az: (n) => `Kritik/yüksək tapıntılar avtomatik iş əmrinə çevrilir və zona/ixtisasa görə mühəndisə təyin olunur — ${n} aktiv əmr.`,
    en: (n) => `Critical/high findings automatically become work orders and get assigned to an engineer by zone/specialty — ${n} active orders.`,
  },
  statusPending: { az: "Gözləyir", en: "Pending" },
  statusAcknowledged: { az: "Qəbul edildi", en: "Acknowledged" },
  statusResolved: { az: "Həll edildi", en: "Resolved" },
  clickToAdvance: { az: " — klikləyin", en: " — click" },
  priorityUrgent: { az: "TƏCİLİ", en: "URGENT" },
  priorityHigh: { az: "YÜKSƏK", en: "HIGH" },
  priorityMedium: { az: "ORTA", en: "MEDIUM" },

  facilityMapTitle: { az: "Digital Twin — Obyekt Xəritəsi", en: "Digital Twin — Facility Map" },
  facilityMapSubtitle: {
    az: "Terminalın sxematik planı — hər nöqtə real cihazın yerini və statusunu göstərir. Klikləyin.",
    en: "Schematic layout of the terminal — each point shows a real device's location and status. Click to inspect.",
  },
  legendHealthy: { az: "Sağlam", en: "Healthy" },
  legendFlagged: { az: "Bayraqlı", en: "Flagged" },
  legendCritical: { az: "Kritik", en: "Critical" },
  savingsPossible: { az: (n) => `${n.toLocaleString()} AZN/il qənaət mümkündür`, en: (n) => `${n.toLocaleString()} AZN/year savings possible` },
  noAnomalyShort: { az: "Normal işləyir, anomaliya yoxdur.", en: "Operating normally, no anomaly detected." },
  ratedKw: { az: "gücündə", en: "rated" },

  deviceFleetTitle: { az: "Cihaz Parkı — Kök Səbəb Analizi", en: "Device Fleet — Root Cause Analysis" },
  deviceFleetSubtitle: { az: "Pilot obyekt: nümunəvi ixrac/emal terminalı · 10 izlənən vahid", en: "Pilot facility: representative export/processing terminal · 10 monitored units" },
  legendBaseline: { az: "Baza xətt", en: "Baseline" },
  legendActualKw: { az: "Real (kW)", en: "Actual (kW)" },
  confidenceSuffix: { az: "əminlik", en: "confidence" },
  recommendedActionLabel: { az: "Tövsiyə edilən addım:", en: "Recommended action:" },
  estSavingsLabel: { az: (n) => `Təxmini illik qənaət: ${n.toLocaleString()} AZN/il`, en: (n) => `Estimated savings if fixed: ${n.toLocaleString()} AZN/year` },
  avoidedCo2Label: { az: (n) => `Qarşısı alınan CO\u2082: ${n} ton/il`, en: (n) => `Avoided CO\u2082: ${n} tons/year` },
  predictiveMaintenanceLabel: { az: "Proqnozlu texniki xidmət:", en: "Predictive maintenance:" },
  predictiveAtCritical: { az: "Trend artıq kritik həddə çatıb", en: "Trend already at critical threshold" },
  predictiveDaysRemaining: { az: (d) => `~${d} gün kritik aşınma həddinə qalıb`, en: (d) => `~${d} days until critical wear threshold` },
  perMonthTrend: { az: "ay trend", en: "month trend" },
  noAnomalyLong: { az: "Anomaliya aşkarlanmayıb — normal baza daxilində işləyir.", en: "No anomalies detected — operating within normal baseline." },

  realDataTitle: { az: "Real Data Validasiyası", en: "Real-World Data Validation" },
  realDataSubtitle: {
    az: "Metodumuzu öz sintetik datamızdan kənar, real ABŞ enerji şəbəkəsi datasında sınayırıq — 12 real region, 2002-2018.",
    en: "We test our method beyond our own synthetic data, on real US grid data — 12 real regions, 2002-2018.",
  },
  realDataRunButton: { az: "Sınağı işə sal (real dataset)", en: "Run validation (real dataset)" },
  realDataLoading: { az: "Real dataset yüklənir və sınanır (ilk dəfə ~10-30 saniyə çəkə bilər)…", en: "Downloading and testing real dataset (first run may take ~10-30 seconds)…" },
  realDataSource: {
    az: (n) => `Mənbə: PJM Interconnection, ${n} real region, saatlıq yük (MW), 2002–2018`,
    en: (n) => `Source: PJM Interconnection, ${n} real regions, hourly load (MW), 2002-2018`,
  },
  realDataNaiveCol: { az: "Sabit kalibrasiya (v1)", en: "Fixed calibration (v1)" },
  realDataRobustCol: { az: "Robust kalibrasiya (v2)", en: "Robust calibration (v2)" },
  realDataSyntheticCol: { az: "Sintetik pilot", en: "Synthetic pilot" },
  realDataRecallRow: { az: "Recall", en: "Recall" },
  realDataPrecisionRow: { az: "Precision", en: "Precision" },
  realDataFpRow: { az: "Yalançı həyəcan (təmiz data)", en: "False positives (clean data)" },
  realDataFindingTitle: { az: "Nə tapdıq", en: "What we found" },
  realDataError: { az: "Validasiya alınmadı — internet bağlantısını yoxlayın.", en: "Validation failed — check your internet connection." },
  realDataRecentTitle: { az: "Yenilənmiş Validasiya —", en: "Updated Validation —" },
  realDataRecentSource: { az: (n, w) => `Mənbə: EIA (ABŞ Enerji İnformasiya İdarəsi), ${n} real region, ${w} günlük tam mövsüm pəncərəsi`, en: (n, w) => `Source: EIA (U.S. Energy Information Administration), ${n} real regions, ${w}-day full-season window` },
  realDataAzTitle: { az: "Azərbaycan-Kalibrlənmiş Ssenari", en: "Azerbaijan-Calibrated Scenario" },
  realDataAzNotProofLabel: { az: "⚠ Bu, performans sübutu deyil", en: "⚠ This is not a performance proof" },
  realDataAzCircularNote: { az: "(dairəvi — özümüzün inject etdiyi anomaliya)", en: "(circular — our own injected anomaly)" },
  realDataAzPathLabel: { az: "Real validasiyaya gedən yol", en: "Path to real validation" },

  thresholdTitle: { az: "Threshold Sınağı — Canlı Trade-off", en: "Threshold Explorer — Live Trade-off" },
  thresholdSubtitle: {
    az: "Sürüşdürün: aşağı hədd = çox yalançı həyəcan, yüksək hədd = itkin qalan hallar. Bax, sizin sistem harada dayanır.",
    en: "Drag it: low threshold = lots of false alarms, high threshold = missed cases. See where your system lands.",
  },
  thresholdXAxis: { az: "z-score həddi", en: "z-score threshold" },
  thresholdRecallLine: { az: "Recall (naiv)", en: "Recall (naive)" },
  thresholdPrecisionLine: { az: "Precision (naiv)", en: "Precision (naive)" },
  thresholdYourChoice: { az: "Sizin seçiminiz (sadə hədd)", en: "Your choice (simple threshold)" },
  thresholdOurSystem: { az: "GridPulse (persistence-filtri)", en: "GridPulse (persistence filter)" },
  thresholdRecallLabel: { az: "Recall", en: "Recall" },
  thresholdPrecisionLabel: { az: "Precision", en: "Precision" },
  thresholdFlaggedLabel: { az: "Bayraqlı", en: "Flagged" },
  thresholdInsight: {
    az: "Diqqət: ~3.5 həddində sadə üsul bizim sistemimizlə demək olar eyni nəticəyə çatır. Fərq \"daha yaxşı\" olmaq deyil — sabit bir \"sehrli rəqəmi\" sınaq-xəta ilə tapmaq əvəzinə, prinsipial qayda (2+ ardıcıl gün davam etməli) ilə bu tarazlığa etibarlı şəkildə çatmaqdır.",
    en: "Notice: around ~3.5 a simple threshold reaches nearly the same result as our system. The difference isn't about being \"better\" — it's about reaching that balance reliably via a principled rule (must persist 2+ consecutive days) instead of hunting for one \"magic number\" by trial and error.",
  },

  roiTitle: { az: "Dəyər Yaratma Xülasəsi (ROI)", en: "Value Creation Summary (ROI)" },
  roiSubtitle: {
    az: "Cihaz və sayğac səviyyəsində aşkarlanan itkilərin illik maliyyə təsiri — pilot miqyasında, real hesablanmış",
    en: "Annual financial impact of losses detected at device and meter level — pilot scale, actually computed",
  },
  roiDeviceSavings: { az: "Cihaz qənaəti", en: "Device savings" },
  roiDeviceSavingsSub: { az: (n, t) => `${n}/${t} cihaz bayraqlı`, en: (n, t) => `${n}/${t} devices flagged` },
  roiMeterRecovery: { az: "Sayğac itki bərpası", en: "Meter loss recovery" },
  roiMeterRecoverySub: { az: (n) => `${n} sayğac bayraqlı`, en: (n) => `${n} meters flagged` },
  roiCombinedTotal: { az: "Ümumi illik dəyər (pilot)", en: "Combined annual value (pilot)" },
  roiCo2Card: { az: "Qarşısı alınan CO₂", en: "Avoided CO₂" },
  roiNationalContextTitle: { az: "Milli Miqyasda Kontekst", en: "National-Scale Context" },
  roiTdLossLine: {
    az: (pct) => `Azərbaycanın rəsmi elektrik ötürmə/paylama itkisi: ${pct}% (World Bank WDI, 2023)`,
    en: (pct) => `Azerbaijan's official transmission/distribution loss rate: ${pct}% (World Bank WDI, 2023)`,
  },
  roiTariffLine: {
    az: (r, i) => `İstifadə olunan tariflər: əhali ${r} AZN/kWh, sənaye ${i} AZN/kWh (Tarif Şurası, 02.01.2025)`,
    en: (r, i) => `Tariffs used: residential ${r} AZN/kWh, industrial ${i} AZN/kWh (Tariff Council, 02.01.2025)`,
  },

  navEnergy: { az: "Enerji", en: "Energy" },
  navGas: { az: "Qaz", en: "Gas" },
  navDisaster: { az: "Fəlakət Ssenarisi", en: "Disaster Scenario" },
  navReliability: { az: "Etibarlılıq", en: "Reliability" },
  navFaq: { az: "Suallar", en: "FAQ" },

  navConsumer: { az: "Fərdi (Konsept)", en: "Consumer (Concept)" },

  consumerBrandedBy: { az: "SOCAR TƏQDİM EDİR", en: "PRESENTED BY SOCAR" },
  consumerAppName: { az: "Mənim Evim", en: "My Home" },
  consumerHouseholdLabel: { az: "Ev", en: "Household" },
  consumerStatusOk: { az: "Hər şey qaydasındadır", en: "Everything looks fine" },
  consumerStatusAttention: { az: "Diqqətinizə ehtiyac var", en: "Needs your attention" },
  consumerEstMonthly: { az: "Bu ayın təxmini istehlakı", en: "This month's estimated usage" },
  consumerGenericAnomalyNote: {
    az: "Adi istifadə profilinizdən fərqlənən bir şey gördük. Narahat olmayın — komandamız artıq bundan xəbərdardır.",
    en: "We noticed something different from your usual usage pattern. No need to worry — our team is already aware.",
  },
  consumerFeedbackYes: { az: "Bəli, doğrudur", en: "Yes, that's right" },
  consumerFeedbackNo: { az: "Xeyr, səhvdir", en: "No, that's wrong" },
  consumerFeedbackThanks: { az: "Təşəkkürlər! Bu, sistemi daha da dəqiqləşdirməyə kömək edir.", en: "Thank you! This helps make the system more accurate." },
  consumerPoweredBy: { az: "GridPulse mühərriki ilə işləyir", en: "Powered by the GridPulse engine" },

  faqTitle: { az: "Tez-tez Verilən Suallar", en: "Frequently Asked Questions" },
  faqSubtitle: {
    az: "Layihə boyu real test etdiyimiz suallar və tapdığımız cavablar — uydurma ümumi cavab yoxdur.",
    en: "Questions we actually tested throughout the project, and the answers we found — no generic made-up answers.",
  },
  tabOverview: { az: "Ümumi Baxış", en: "Overview" },
  tabDeepDive: { az: "Ətraflı Araşdırma", en: "Deep Dive" },
  tabReports: { az: "Hesabat & Validasiya", en: "Reports & Validation" },
  tabSimulation: { az: "Simulyasiya", en: "Simulation" },
  tabResilience: { az: "Davamlılıq & Etibarlılıq", en: "Resilience & Reliability" },
  freqDaily: { az: "hər gün", en: "daily" },
  freqAsNeeded: { az: "lazım olanda", en: "as needed" },
  freqRare: { az: "nadir", en: "rare" },

  facilitySelectorLabel: { az: "Obyekt:", en: "Facility:" },
  facilityIndustrial: { az: "İxrac/Emal Terminalı", en: "Export/Processing Terminal" },
  facilityCritical: { az: "Kritik Mülki İnfrastruktur", en: "Critical Civic Infrastructure" },

  gasCriticalAlerts: { az: "Kritik Təhlükəsizlik Xəbərdarlığı", en: "Critical Safety Alerts" },
  gasRecoveryM3: { az: "İllik Bərpa Potensialı (m³)", en: "Annual Recovery Potential (m³)" },
  gasRecoveryAzn: { az: "İllik Maliyyə Dəyəri", en: "Annual Financial Value" },
  gasSafetyNoteTitle: { az: "Vacib qeyd", en: "Important note" },
  gasSecurityPanelTitle: { az: "Təhlükəsizlik və Kök-Səbəb Təsnifatı (Qaz)", en: "Safety & Root-Cause Classification (Gas)" },
  gasSecuritySubtitle: {
    az: "Ehtimal olunan sızıntını adi texniki nasazlıqdan ayırır — qazda hər anomaliya TƏHLÜKƏSİZLİK məsələsidir.",
    en: "Distinguishes suspected leaks from ordinary technical faults — in gas, every anomaly is a SAFETY matter.",
  },
  colActualM3: { az: "Real (m³)", en: "Actual (m³)" },
  colExpectedM3: { az: "Gözlənilən (m³)", en: "Expected (m³)" },
  gasMethodNote: {
    az: "Eyni z-score+persistence metod, qazın güclü mövsümi effekti üçün robust sürüşən kalibrasiya ilə (bax Real Data Validasiyası).",
    en: "Same z-score+persistence method, using robust trailing calibration for gas's strong seasonality (see Real Data Validation).",
  },

  gasInfraTitle: { az: "Qaz İnfrastrukturu — Sıxılma, Requlyasiya, Təhlükəsizlik", en: "Gas Infrastructure — Compression, Regulation, Safety" },
  gasInfraSubtitle: {
    az: "Sayğac səviyyəsindən fərqli — bu, qazın öz nəql infrastrukturudur. Odorizasiya və katodik mühafizə yalnız qaz sənayesinə xasdır.",
    en: "Different from meter-level — this is gas's own transport infrastructure. Odorization and cathodic protection are unique to the gas industry.",
  },
  gasDispatchTitle: { az: "Auto-Dispatch — Qaz Təhlükəsizlik Növbəsi", en: "Auto-Dispatch — Gas Safety Queue" },

  flowCompression: { az: "Sıxılma", en: "Compression" },
  flowRegulation: { az: "Requlyasiya", en: "Regulation" },
  flowOdorization: { az: "Odorizasiya", en: "Odorization" },
  flowMetering: { az: "Ölçmə", en: "Metering" },
  flowEsv: { az: "ESV Klapanı", en: "ESV Valve" },
  flowUnderground: { az: "Yeraltı Paylama Xətti (Katodik Mühafizə)", en: "Underground Distribution Line (Cathodic Protection)" },
  flowHint: { az: "Stansiyaya klikləyin — aşağıda ətraflı diaqnoz açılacaq", en: "Click a station — detailed diagnosis opens below" },

  odorantGaugeTitle: { az: "Odorant Təhlükəsizlik Səviyyəsi — Sızıntı Qoxu ilə Hiss Olunarmı?", en: "Odorant Safety Level — Would a Leak Be Detectable by Smell?" },
  odorantDangerBadge: { az: "TƏHLÜKƏ ZONASI", en: "DANGER ZONE" },
  odorantCurrentLabel: { az: "Hazırkı səviyyə", en: "Current level" },
  odorantSafeMinLabel: { az: "Minimum təhlükəsiz həd", en: "Minimum safe threshold" },
  odorantDangerNote: {
    az: "Hazırkı doza minimum təhlükəsizlik həddinin altındadır — bu, gələcək sızıntının QOXUSUZ (aşkarlanmadan) qala biləcəyi deməkdir.",
    en: "Current dosage is below the minimum safety threshold — meaning a future leak could go undetected by smell.",
  },
  odorantSafeNote: {
    az: "Doza təhlükəsiz aralıqdadır — sızıntı baş versə, insanlar qoxu ilə hiss edə bilər.",
    en: "Dosage is within the safe range — if a leak occurred, it would be detectable by smell.",
  },

  criticalInfraTitle: { az: "Kritik İnfrastruktur — Metro, Xəstəxana, Mobillik", en: "Critical Infrastructure — Metro, Hospital, Mobility" },
  criticalInfraSubtitle: {
    az: "Eyni kök-səbəb mühərriki, şəhərin kritik xidmətlərinə tətbiq olunub — burda sual pul deyil, kəsintisizlikdir.",
    en: "Same root-cause engine, applied to the city's critical services — here the question isn't cost, it's continuity.",
  },
  criticalityLabel: { az: "Niyə kritikdir:", en: "Why it's critical:" },
  criticalDeviceHealthy: { az: "Sağlam işləyir — istinad vahidi.", en: "Operating normally — reference unit." },

  disasterPageTitle: { az: "Fəlakət Ssenarisi: Zəlzələ/Ciddi Şərait", en: "Disaster Scenario: Earthquake / Severe Event" },
  disasterPageSubtitle: {
    az: "Mentor sualı: fəlakət şəraitində GridPulse nə işə yarayır? Aşağıda canlı simulyasiya.",
    en: "Mentor's question: what does GridPulse do in a disaster? Live simulation below.",
  },
  disasterSetupTitle: { az: "Ssenari quruluşu", en: "Scenario setup" },
  disasterSetupDesc: {
    az: (zone, date) => `${zone} zonasında, ${date} tarixində infrastruktur zədəsi simulyasiya edilib — sayğacların böyük əksəriyyəti eyni gün kəskin düşür (xətlərin kəsilməsi/boruların zədələnməsi).`,
    en: (zone, date) => `An infrastructure-damage event was simulated in ${zone} on ${date} — the majority of meters drop sharply on the same day (cut lines / damaged pipes).`,
  },
  disasterEnergyAffected: { az: "Enerji sayğacları təsirləndi", en: "Energy meters affected" },
  disasterGasAffected: { az: "Qaz sayğacları təsirləndi", en: "Gas meters affected" },
  disasterDetectionTitle: { az: "Aşkarlanma nəticəsi", en: "Detection result" },
  disasterDualConfirmed: { az: "İKİQAT TƏSDİQLƏNDİ — həm enerji, həm qaz", en: "DUAL-CONFIRMED — both energy and gas" },
  disasterFractionFlagged: { az: (pct) => `${pct}% sayğac eyni gün bayraqlandı`, en: (pct) => `${pct}% of meters flagged same day` },
  disasterWithoutTitle: { az: "Konsolidasiya OLMADAN", en: "WITHOUT consolidation" },
  disasterWithTitle: { az: "Konsolidasiya İLƏ", en: "WITH consolidation" },
  disasterRoadmapTitle: { az: "Dürüstlük qeydi — gələcək istiqamət", en: "Honesty note — future direction" },
  disasterEpicenter: { az: "ZƏLZƏLƏ MƏRKƏZİ", en: "EPICENTER" },
  disasterFloodTitle: { az: "Dispatch Növbəsinə Təsir", en: "Impact on Dispatch Queue" },
  disasterFloodCaption: { az: "ayrı təcili bilet — sahə komandası iflic olur", en: "separate urgent tickets — field team overwhelmed" },
  disasterCalmCaption: { az: "konsolidə edilmiş xəbərdarlıq — aydın hərəkət planı", en: "consolidated alert — clear action plan" },
  disasterZoneSelectorLabel: { az: "Ssenari zonası:", en: "Scenario zone:" },
  disasterRunButton: { az: "Yenidən simulyasiya et", en: "Re-run simulation" },
  disasterSpikeTitle: { az: "Anomaliya Spike-ı — Zaman Sırası", en: "Anomaly Spike — Time Series" },
  disasterSpikeSubtitle: { az: "Fəlakət günü (T) ətrafında bayraqlı sayğac sayı — statistik outlier real vaxtda görünür", en: "Flagged meter count around the disaster day (T) — the statistical outlier is visible in real time" },
  disasterDayLabel: { az: "Fəlakət günü (T)", en: "Disaster day (T)" },
  recoveryEnergyTitle: { az: "Bərpa Əyrisi — Enerji", en: "Recovery Curve — Energy" },
  recoveryGasTitle: { az: "Bərpa Əyrisi — Qaz", en: "Recovery Curve — Gas" },
  cascadeTitle: { az: "Kaskad Risk Yoxlaması", en: "Cascade Risk Check" },
  cascadeSubtitle: { az: "Epicenter-dən başqa zonalarda yayılma əlaməti varmı? (kütləvi-hadisə həddinə çatmasa belə)", en: "Any spillover signs in other zones? (even below mass-event threshold)" },
  cascadeWatchBanner: { az: "⚠ Bəzi zonalarda yüngül yüksəlmə aşkarlandı — izləməyə davam edin", en: "⚠ Mild elevation detected in some zones — continue monitoring" },
  detectionSpeedTitle: { az: "Aşkarlanma Sürəti Müqayisəsi", en: "Detection Speed Comparison" },
  traditionalLabel: { az: "Ənənəvi üsul", en: "Traditional method" },
  hoursSuffix: { az: "saat", en: "hours" },
  emergencyTeamsTitle: { az: "Fövqəladə Hallar Komandaları — Avtomatik Təyinat", en: "Emergency Response Teams — Auto-Assigned" },
  minutesSuffix: { az: "dəq", en: "min" },

  resilienceTitle: { az: "Sistem Davamlılığı & Etibarlılıq Təsiri", en: "System Resilience & Reliability Impact" },
  resilienceSubtitle: {
    az: "Mentor sualı: elektrik 1 saat kəsilərsə, sistem necə davranır? Və GridPulse-un təsirini utility dilində (SAIDI/SAIFI) necə ölçmək olar?",
    en: "Mentor question: if power goes out for an hour, how does the system behave? And how does GridPulse's impact translate into utility language (SAIDI/SAIFI)?",
  },
  resilienceKeyFact: {
    az: "GridPulse heç vaxt real-vaxt fiziki idarəetmə etmir (yalnız daxili iş əmri yaradır) — bu o deməkdir ki, sistemin öz kəsintisi HEÇ BİR fiziki təhlükəsizlik riski yaratmır, çünki kəsinti anında artıq heç nə real-vaxtda idarə olunmurdu.",
    en: "GridPulse never issues live physical commands (only internal work orders) — meaning a GridPulse outage itself creates NO physical safety risk, since nothing was being actively controlled in real time anyway.",
  },
  resilienceComponentCol: { az: "Komponent", en: "Component" },
  resilienceImpactCol: { az: "Təsir", en: "Impact" },
  resilienceMitigationCol: { az: "Azaldılma", en: "Mitigation" },

  bcp_power_component: { az: "GridPulse server kəsintisi (1 saat)", en: "GridPulse server outage (1 hour)" },
  bcp_power_impact: { az: "Yeni analiz dayanır, TƏHLÜKƏSİZLİK yaranmır", en: "New analysis pauses, no safety issue" },
  bcp_power_mitigation: { az: "Bərpadan sonra backlog avtomatik emal olunur", en: "Backlog auto-processes once power returns" },

  bcp_network_component: { az: "İnternet/şəbəkə əlaqəsi kəsilir", en: "Internet/network connectivity loss" },
  bcp_network_impact: { az: "Dashboard köhnə (keşlənmiş) data göstərir", en: "Dashboard shows stale cached data" },
  bcp_network_mitigation: { az: "Offline edge keşi (Fəlakət Ssenarisində artıq mövcuddur)", en: "Offline edge cache (already built for Disaster Scenario)" },

  bcp_db_component: { az: "Verilənlər bazası zədələnir", en: "Database corruption" },
  bcp_db_impact: { az: "Tarixi data itə bilər", en: "Historical data could be lost" },
  bcp_db_mitigation: { az: "Yoxlanılır...", en: "Checking..." },

  bcp_gemini_component: { az: "Gemini API əlçatmaz", en: "Gemini API unavailable" },
  bcp_gemini_impact: { az: "Co-Pilot AI cavabı dayana bilər", en: "Co-Pilot AI responses could pause" },
  bcp_gemini_mitigation: { az: "Qayda-əsaslı fallback (artıq mövcud, test edilib)", en: "Rule-based fallback (already built, tested)" },

  saidiSaifiTitle: { az: "SAIDI/SAIFI Təsiri — Utility Dilinə Tərcümə", en: "SAIDI/SAIFI Impact — Translated to Utility Language" },
  saidiSaifiSubtitle: {
    az: "SAIDI = orta müştərinin ildə neçə dəqiqə enerjisiz qalması. SAIFI = neçə dəfə kəsinti yaşaması. (IEEE 1366 standartı)",
    en: "SAIDI = minutes/year the average customer is without power. SAIFI = how many times they experience an interruption. (IEEE 1366 standard)",
  },
  saidiBenchmarksLabel: { az: "Beynəlxalq istinad diapazonu (Azərbaycana aid edilmir):", en: "International reference range (not attributed to Azerbaijan):" },

  copilotTitle: { az: "AI Co-Pilot", en: "AI Co-Pilot" },
  copilotSubtitle: { az: "Real hesablanmış diaqnoz datasına əsaslanan suallar — uydurma cavab vermir.", en: "Questions answered from real computed diagnosis data — no hallucinated answers." },
  copilotWelcome: { az: "Salam! GridPulse AI Co-Pilot-am. Cihaz, sayğac və ya zona haqqında sual verə bilərsiniz.", en: "Hi! I'm the GridPulse AI Co-Pilot. Ask me about a device, meter, or zone." },
  copilotThinking: { az: "Düşünür…", en: "Thinking…" },
  copilotPlaceholder: { az: "Sual yazın… (məs. D01 nə vaxt sıradan çıxacaq?)", en: "Type a question… (e.g. when will D01 fail?)" },
  copilotSourceGemini: { az: "✨ Gemini AI", en: "✨ Gemini AI" },
  copilotSourceFallback: { az: "⚙ Ehtiyat cavab (API əlçatan olmadı)", en: "⚙ Fallback answer (API unavailable)" },
  copilotSuggestions: {
    az: ["D08 nə üçün bayraqlıdır?", "M007 sayğacında niyə anomaliya var?", "Zona B risk balı nədir?", "Ümumi vəziyyət necədir?"],
    en: ["Why is D08 flagged?", "Why is there an anomaly on meter M007?", "What is Zone B's risk score?", "What's the overall status?"],
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("az");

  const t = (key, ...args) => {
    const entry = STRINGS[key];
    if (!entry) return key;
    const val = entry[lang];
    return typeof val === "function" ? val(...args) : val;
  };

  // Backend-dən gələn ikidilli obyektlərdən düzgün sahəni seçir, məs.
  // pick(device, "name") -> device.name_az və ya device.name_en
  const pick = (obj, field) => obj?.[`${field}_${lang}`];

  const toggle = () => setLang((l) => (l === "az" ? "en" : "az"));

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t, pick }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}