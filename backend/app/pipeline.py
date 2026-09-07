"""
GridPulse AI Pipeline — data generation, anomaly detection, risk scoring,
and demand forecasting, refactored as importable functions.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.ensemble import IsolationForest
from statsmodels.tsa.holtwinters import ExponentialSmoothing

N_METERS = 50
DAYS = 180
CALIB_DAYS = 45
FORECAST_DAYS = 7
ZONES = ["Zona A", "Zona B", "Zona C", "Zona D", "Zona E", "Zona F"]

# ─── ROI hesablamaları üçün real, mənbəli sabitlər ─────────────────────────
# Tarif Şurasının 02.01.2025 tarixli qərarı: əhali üçün orta tarif ~8 qəpik/kWh
# (pilləli: 200 kVts-a qədər 8.4q, 200-300 aralığı 10q, 300-dən yuxarı 15q —
# burada blended orta dəyər istifadə olunur), sənaye/kənd təsərrüfatı üçün
# 10.6 qəpik/kWh. Mənbə: Tarif (Qiymət) Şurası, tariff.gov.az.
RESIDENTIAL_TARIFF_AZN_PER_KWH = 0.08
SMALL_INDUSTRIAL_TARIFF_AZN_PER_KWH = 0.106
# Azərbaycanın rəsmi elektrik ötürmə/paylama itkisi (2023) — Dünya Bankı WDI.
AZ_TD_LOSS_PCT_2023 = 7.6


def generate_synthetic_data(seed=42):
    """Real SCADA/sayğac API qoşulanda bu funksiya onunla əvəz olunacaq."""
    np.random.seed(seed)
    start_date = datetime(2026, 1, 1)
    dates = [start_date + timedelta(days=i) for i in range(DAYS)]

    meter_base = np.random.uniform(20, 80, size=N_METERS)
    meter_type = np.random.choice(["residential", "small_industrial"], size=N_METERS, p=[0.7, 0.3])
    meter_zone = np.random.choice(ZONES, size=N_METERS)

    anomaly_meters = np.random.choice(N_METERS, size=12, replace=False)
    anomaly_types = np.random.choice(["theft_drop", "meter_fault", "spike", "gradual_decline"], size=len(anomaly_meters))
    anomaly_start_day = np.random.randint(60, 150, size=len(anomaly_meters))
    anomaly_map = {m: (t, s) for m, t, s in zip(anomaly_meters, anomaly_types, anomaly_start_day)}

    records = []
    for meter_id in range(N_METERS):
        base = meter_base[meter_id]
        for day_idx, date in enumerate(dates):
            weekday = date.weekday()
            weekly_factor = (1.15 if weekday >= 5 else 1.0) if meter_type[meter_id] == "residential" else (0.4 if weekday >= 5 else 1.0)
            seasonal_factor = 1 + 0.15 * np.sin(2 * np.pi * day_idx / 365)
            noise = np.random.normal(0, 0.06)
            consumption = base * weekly_factor * seasonal_factor * (1 + noise)

            label = "normal"
            if meter_id in anomaly_map:
                a_type, a_start = anomaly_map[meter_id]
                if day_idx >= a_start:
                    days_since = day_idx - a_start
                    if a_type == "theft_drop":
                        consumption *= 0.15; label = "anomaly"
                    elif a_type == "meter_fault":
                        consumption = 0.0; label = "anomaly"
                    elif a_type == "spike" and days_since < 5:
                        consumption *= 3.0; label = "anomaly"
                    elif a_type == "gradual_decline":
                        decline_factor = max(0.2, 1 - 0.01 * days_since)
                        consumption *= decline_factor
                        label = "anomaly" if decline_factor < 0.7 else "normal"

            records.append({
                "meter_id": f"M{meter_id:03d}", "date": date, "consumption_kwh": max(0, round(consumption, 2)),
                "meter_type": meter_type[meter_id], "zone": meter_zone[meter_id], "true_label": label,
                "injected_type": anomaly_map.get(meter_id, (None, None))[0],
            })
    return pd.DataFrame(records)


def _detect_single_meter(meter_id, g, value_col="consumption_kwh"):
    """Bir sayğac üçün tam aşkarlama pipeline-ı. Sayğaclar arasında heç bir
    asılılıq yoxdur (hər sayğac yalnız öz tarixi ilə müqayisə olunur) — ona görə
    bu funksiya "embarrassingly parallel"dır və joblib ilə paralel işlədilə bilər
    (bax: detect_anomalies, n_jobs).

    `value_col` parametrləşdirilib ki, EYNİ funksiya heç bir dəyişiklik olmadan
    başqa domenlərdə (məs. qaz axını, m³) də işə düşsün — metod enerjiyə xas
    deyil, ümumi statistik anomaliya aşkarlanmasıdır (bax gas_pipeline.py)."""
    g = g.sort_values("date").reset_index(drop=True)
    g["day_idx"] = np.arange(len(g))
    calib = g[g["day_idx"] < CALIB_DAYS]
    weekday_mean = calib.groupby("weekday")[value_col].mean()
    overall_mean = calib[value_col].mean()
    g["expected"] = g["weekday"].map(weekday_mean).fillna(overall_mean)
    g["residual"] = g[value_col] - g["expected"]
    calib_residual = calib[value_col] - calib["weekday"].map(weekday_mean).fillna(overall_mean)
    calib_std = calib_residual.std() or 1
    g["zscore"] = g["residual"] / calib_std
    g["residual_ratio"] = (g["residual"] / g["expected"].replace(0, np.nan)).fillna(0)

    features = g[["zscore", "residual_ratio"]].fillna(0).values
    iso = IsolationForest(contamination=0.08, random_state=42)
    g["iso_flag"] = iso.fit_predict(features)
    iso_anomaly = g["iso_flag"] == -1

    # v2 — "persistence filter": kəskin (|z|>4.0) kənarlaşmalar dərhal bayraq
    # qoyulur (şübhə yoxdur), orta səviyyəli (2.5-4.0) kənarlaşmalar isə
    # YALNIZ >=2 ardıcıl gün davam edərsə bayraq qoyulur. Nəticə:
    # Precision 38%→70.5%, Recall 99.2%→96.1% (sınaq datası üzərində).
    abs_z = g["zscore"].abs()
    extreme = abs_z > 4.0
    moderate = (abs_z > 2.5) & (~extreme)
    moderate_streak = moderate.groupby((~moderate).cumsum()).cumsum()
    persistent_moderate = moderate & (moderate_streak >= 2)

    # v3 — IsolationForest-i son qərara "korroborasiya siqnalı" kimi qatmağı
    # sınadıq: tək günlük orta kənarlaşmaları (streak < 2) YALNIZ IF də
    # müstəqil təsdiqləyəndə bayraqlamaq. Nəticə (50 sayğac × 180 gün,
    # contamination 0.03–0.08, z-hədd 2.5–3.3 arasında sınanıb):
    # Recall cəmi +0.2–0.4 xal artdı, Precision isə 70.5%-dən 52.9–66.5%-ə
    # DÜŞDÜ. Yəni IF bu ssenaridə faydalı siqnal vermir — sadəcə əlavə
    # yalançı həyəcan yaradır. Ona görə son qərara QATILMIR; contamination
    # dərəcəsi (8%) datadakı real anomaliya nisbətindən (5.6%) yüksək olduğu
    # üçün IF-in "gözlənilməz" saydığı günlərin çoxu əslində normal
    # dalğalanmadır. IF nəticəsi (iso_flag) yenə də analitik/eksploratoriya
    # məqsədilə sətir-səviyyəsində saxlanılır (məs. gələcəkdə fərqli feature
    # dəsti və ya daha böyük datada yenidən qiymətləndirilə bilər).
    g["predicted_anomaly"] = extreme | persistent_moderate
    g["meter_id"] = meter_id
    return g


def detect_anomalies(df, n_jobs=1, value_col="consumption_kwh"):
    """n_jobs=1 (default) → ardıcıl, sınaq/reproducibility üçün. n_jobs=-1 →
    bütün nüvələrdə paralel (joblib) — miqyaslanma nümayişi üçün, bax
    benchmark_scaling(). Hər sayğac müstəqil hesablandığı üçün nəticə eynidir,
    yalnız sürət dəyişir. `value_col` başqa domenlərdə (qaz m³ və s.) eyni
    funksiyanı təkrar istifadə etmək üçündür — bax gas_pipeline.py."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["weekday"] = df["date"].dt.weekday
    groups = list(df.groupby("meter_id"))

    if n_jobs == 1:
        results = [_detect_single_meter(mid, g, value_col) for mid, g in groups]
    else:
        from joblib import Parallel, delayed
        results = Parallel(n_jobs=n_jobs)(
            delayed(_detect_single_meter)(mid, g, value_col) for mid, g in groups
        )
    return pd.concat(results, ignore_index=True)


def benchmark_scaling(target_meters=2_500_000, worker_counts=(1, 4, 8, 16)):
    """SOCAR-ın 2.5M sayğac miqyasına köçürmə üçün emal vaxtını qiymətləndirir.
    N_METERS (50) sayğacın həqiqi emal müddətini ölçüb, xətti olaraq
    ekstrapolyasiya edir (hər sayğac müstəqil emal olunduğu üçün bu, real
    qiymətdir — server sayı artdıqca demək olar ki, xətti sürətlənmə gözlənilir).
    """
    import time
    raw_df = generate_synthetic_data()

    t0 = time.perf_counter()
    detect_anomalies(raw_df, n_jobs=1)
    single_meter_seconds = (time.perf_counter() - t0) / N_METERS

    total_serial_hours = (single_meter_seconds * target_meters) / 3600
    rows = []
    for w in worker_counts:
        hours = total_serial_hours / w
        if hours >= 1:
            human_az, human_en = f"~{hours:.1f} saat", f"~{hours:.1f} hours"
        else:
            human_az, human_en = f"~{hours * 60:.0f} dəqiqə", f"~{hours * 60:.0f} minutes"
        rows.append({
            "workers": w, "estimated_hours": round(hours, 2),
            "human_readable_az": human_az, "human_readable_en": human_en,
        })

    return {
        "measured_seconds_per_meter": round(single_meter_seconds, 4),
        "target_meters": target_meters,
        "single_worker_hours": round(total_serial_hours, 1),
        "scaling_estimates": rows,
        "note_az": (
            "Hər sayğac digərlərindən asılı olmadan emal olunur (embarrassingly "
            "parallel problem) — ona görə worker sayı ilə demək olar ki, xətti "
            "sürətlənmə gözlənilir. Ölçmə bir maşında aparılıb; real production "
            "mühitində (bulud auto-scaling, batch/stream emalı) bu rəqəmlər daha "
            "da yaxşılaşa bilər."
        ),
        "note_en": (
            "Each meter is processed independently of the others (an "
            "embarrassingly parallel problem) — so near-linear speedup is "
            "expected as workers increase. The measurement was taken on a "
            "single machine; in a real production environment (cloud "
            "auto-scaling, batch/stream processing) these numbers could improve "
            "further."
        ),
    }


def score_zone_risk(result_df, recent_window_days=30):
    max_day = result_df["day_idx"].max()
    recent = result_df[result_df["day_idx"] > max_day - recent_window_days]
    rows = []
    for zone, zg in result_df.groupby("zone"):
        rzg = recent[recent["zone"] == zone]
        freq = rzg["predicted_anomaly"].mean() if len(rzg) else 0
        flagged = rzg[rzg["predicted_anomaly"]]
        severity = flagged["zscore"].abs().mean() if len(flagged) else 0
        historical = zg["predicted_anomaly"].mean()

        freq_score = min(100, freq * 200)
        severity_score = min(100, (severity / 10) * 100) if not np.isnan(severity) else 0
        historical_score = min(100, historical * 200)
        risk_score = 0.40 * freq_score + 0.35 * severity_score + 0.25 * historical_score

        band_key = "normal" if risk_score < 34 else ("risky" if risk_score < 67 else "critical")
        BAND_LABELS = {"normal": ("Normal", "Normal"), "risky": ("Riskli", "At Risk"), "critical": ("Kritik", "Critical")}
        band_az, band_en = BAND_LABELS[band_key]
        rows.append({
            "zone": zone, "meter_count": int(zg["meter_id"].nunique()),
            "recent_anomaly_freq_pct": round(freq * 100, 1),
            "avg_severity_zscore": round(severity, 1) if severity == severity else 0,
            "historical_rate_pct": round(historical * 100, 1),
            "risk_score": round(risk_score, 1),
            "band": band_key, "band_az": band_az, "band_en": band_en,
        })
    return sorted(rows, key=lambda r: -r["risk_score"])


def forecast_demand(raw_df, forecast_days=FORECAST_DAYS, ci_repetitions=300, ci_seed=42, value_col="consumption_kwh"):
    """Holt-Winters nöqtə proqnozuna əlavə olaraq 95% etibarlılıq intervalı da
    hesablayır. Statsmodels-in Holt-Winters implementasiyası analitik CI vermir
    (SARIMAX-dan fərqli olaraq), ona görə simulyasiya əsaslı yanaşma istifadə
    olunur: modeldən çoxlu sayda gələcək trayektoriya (repetition) simulyasiya
    edilir, hər gün üçün 2.5/97.5-ci persentillər aşağı/yuxarı sərhədi verir.
    `value_col` başqa domenlərdə (qaz m³ və s.) təkrar istifadə üçündür."""
    df = raw_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    zone_daily = df.groupby(["zone", "date"])[value_col].sum().reset_index()
    out = {}
    for zone, zg in zone_daily.groupby("zone"):
        zg = zg.sort_values("date").reset_index(drop=True)
        series = zg.set_index("date")[value_col]
        fit = ExponentialSmoothing(series, trend="add", seasonal="add", seasonal_periods=7,
                                    initialization_method="estimated").fit()
        forecast = fit.forecast(forecast_days)

        rng_state = np.random.default_rng(ci_seed)
        np.random.seed(ci_seed)  # statsmodels simulate() legacy RandomState istifadə edir
        sims = fit.simulate(nsimulations=forecast_days, repetitions=ci_repetitions, error="add")
        lower = sims.quantile(0.025, axis=1)
        upper = sims.quantile(0.975, axis=1)

        out[zone] = [
            {
                "date": d.strftime("%Y-%m-%d"),
                "forecast_kwh": round(max(0, v), 1),
                "lower_kwh": round(max(0, lower.iloc[i]), 1),
                "upper_kwh": round(max(0, upper.iloc[i]), 1),
            }
            for i, (d, v) in enumerate(forecast.items())
        ]
    return out


# ─── Meter anomaly classification — "niyə" sualına cavab, sayğac səviyyəsində.
# theft_drop ayrıca, təhlükəsizlik-yönümlü framing alır (mentor tövsiyəsi:
# oğurluq/kənar müdaxiləni texniki nasazlıqdan ayırd etmək).
METER_ANOMALY_TYPES = {
    "theft_drop": {
        "label_az": "Ehtimal Olunan Oğurluq / İcazəsiz Müdaxilə",
        "label_en": "Suspected Energy Theft / Unauthorized Tampering",
        "severity": "critical",
        "explanation_az": "İstehlak kəskin düşüb aşağı səviyyədə qalıb, halbuki sayğacın tarixi profili bu dəyişikliyi mövsümi və ya istifadə səbəbi ilə izah etmir — bu, avadanlıq nasazlığından fərqli olaraq, sayğacın yan keçirilməsinin (bypass) və ya icazəsiz kənar müdaxilənin klassik əlamətidir.",
        "explanation_en": "Consumption dropped sharply and stayed low while the meter's historical pattern shows no seasonal or usage justification for the change — the classic signature of meter bypass or unauthorized external tampering, not equipment failure.",
        "action_az": "Sahə yoxlaması + fiziki plomb yoxlaması tövsiyə olunur. Təsdiqlənərsə, SOCAR-ın oğurluq/müdaxilə protokoluna uyğun eskalasiya edin.",
        "action_en": "Field inspection + physical seal check recommended. If confirmed, escalate per SOCAR's theft/tamper protocol.",
    },
    "meter_fault": {
        "label_az": "Sayğac Nasazlığı",
        "label_en": "Meter Malfunction",
        "severity": "high",
        "explanation_az": "Göstəriciş tam sıfıra düşüb və elə də qalıb — bu, müdaxilədən çox aparat/rabitə nasazlığına uyğundur (yan keçirilmiş sayğac adətən sıfırdan fərqli, çox vaxt azalmış göstərici verir, halbuki bütün ölçmələrdə tam sıfır adətən sayğacın özünün məlumat göndərməyi dayandırdığını bildirir).",
        "explanation_en": "Reading dropped to exactly zero and stayed there — consistent with a hardware/communication fault rather than tampering (a bypassed meter still shows some non-zero — often reduced — reading, whereas true zero across all readings usually means the meter itself stopped reporting).",
        "action_az": "Sayğacın yoxlanması/əvəz olunması üçün texnik göndərin.",
        "action_en": "Dispatch technician to inspect/replace the meter.",
    },
    "spike": {
        "label_az": "Qeyri-adi İstehlak Pikı",
        "label_en": "Unusual Consumption Spike",
        "severity": "medium",
        "explanation_az": "İstehlak qısa müddətə tarixi bazadan xeyli yuxarı qalxıb — bu, real tələbat artımı, hesablama/oxuma xətası, yaxud nadir hallarda yalan məlumat ötürən sayğac ola bilər.",
        "explanation_en": "Consumption briefly jumped well above the historical baseline — could indicate a legitimate demand surge, a billing/read error, or in rare cases a compromised meter reporting false data.",
        "action_az": "Məlum əməliyyat hadisələri ilə tutuşdurun; izah tapılmasa audit edin.",
        "action_en": "Cross-check against known operational events; audit if unexplained.",
    },
    "gradual_decline": {
        "label_az": "Tədrici Azalma — Yoxlama Tövsiyə Olunur",
        "label_en": "Gradual Decline — Inspection Recommended",
        "severity": "low",
        "explanation_az": "İstehlak həftələr ərzində yavaş-yavaş azalıb — bu, inkişaf edən əlaqə nasazlığını, qismən müdaxiləni, yaxud real istifadə dəyişikliyini əks etdirə bilər.",
        "explanation_en": "Consumption has been slowly trending down over weeks — could reflect a developing connection fault, partial tampering, or a genuine change in usage.",
        "action_az": "Səbəbi təsdiqləmək üçün adi yoxlama planlaşdırın.",
        "action_en": "Schedule a routine inspection to confirm the cause.",
    },
}

def diagnose_meters(result_df, min_flagged_days=3):
    """Sayğac üzrə, ground-truth inject edilmiş tipə əsaslanan diaqnoz.
    Eyni fəlsəfə: devices.py-dəki kimi, sınaq üçün məlum səbəbi göstəririk;
    real datada bu, pattern-based klassifikator olardı."""
    out = []
    for meter_id, g in result_df.groupby("meter_id"):
        flagged = g[g["predicted_anomaly"]]
        if len(flagged) < min_flagged_days:
            continue
        injected_type = g["injected_type"].iloc[0]
        if not injected_type or injected_type not in METER_ANOMALY_TYPES:
            continue
        info = METER_ANOMALY_TYPES[injected_type]
        out.append({
            "meter_id": meter_id,
            "zone": g["zone"].iloc[0],
            "type": injected_type,
            "label_az": info["label_az"], "label_en": info["label_en"],
            "severity": info["severity"],
            "explanation_az": info["explanation_az"], "explanation_en": info["explanation_en"],
            "recommended_action_az": info["action_az"], "recommended_action_en": info["action_en"],
            "flagged_days": int(len(flagged)),
            "first_flagged": flagged["date"].min().strftime("%Y-%m-%d"),
        })
    return sorted(out, key=lambda r: {"critical": 0, "high": 1, "medium": 2, "low": 3}[r["severity"]])


# ─── ROI / dəyər yaratma xülasəsi ──────────────────────────────────────────
# "spike" (qeyri-adi pik) qəsdən çıxarılıb — bu, gəlir İTKİSİ demək deyil
# (sayğac əksinə DAHA ÇOX göstərir), ona görə "geri qazanılan itki" məntiqinə
# uyğun gəlmir. Yalnız real (real < gözlənilən) itki yaradan tiplər sayılır.
METER_LOSS_TYPES = {"theft_drop", "meter_fault", "gradual_decline"}


def estimate_meter_losses(result_df, meter_diagnoses):
    """Bayraqlanan hər sayğac üçün illik "geri qazanıla bilən" AZN itkisini
    qiymətləndirir — device-level qənaət hesablamasına paralel metodologiya
    (bax devices.py). Tariflər real, mənbəli (Tarif Şurası)."""
    out = []
    for m in meter_diagnoses:
        if m["type"] not in METER_LOSS_TYPES:
            continue
        g = result_df[result_df["meter_id"] == m["meter_id"]]
        flagged = g[g["predicted_anomaly"]]
        if flagged.empty:
            continue
        under_billed_kwh_avg = (flagged["expected"] - flagged["consumption_kwh"]).clip(lower=0).mean()
        annual_loss_kwh = under_billed_kwh_avg * 365
        meter_type = g["meter_type"].iloc[0]
        tariff = RESIDENTIAL_TARIFF_AZN_PER_KWH if meter_type == "residential" else SMALL_INDUSTRIAL_TARIFF_AZN_PER_KWH
        out.append({
            "meter_id": m["meter_id"],
            "type": m["type"],
            "meter_type": meter_type,
            "est_annual_loss_kwh": round(annual_loss_kwh, 1),
            "est_annual_loss_azn": round(annual_loss_kwh * tariff),
        })
    return out


def compute_roi_summary(device_status, meter_loss_list):
    """Cihaz + sayğac səviyyəli qənaət/itki-bərpa rəqəmlərini birləşdirir və
    milli miqyas üçün DÜRÜST kontekst verir.

    Dürüstlük qeydi: bu pilot (50 sayğac, 10 cihaz) qəsdən yüksək anomaliya
    nisbətində qurulub ki, qısa sınaq pəncərəsində sistemin aşkarlama
    qabiliyyəti göstərilsin — bu, real şəbəkədəki gözlənilən tezliyi əks
    etdirmir. Ona görə pilot rəqəmlərini SADƏCƏ vurma yolu ilə 2.5M sayğaca
    köçürmürük (bu, real olmayan nəhəng rəqəm verərdi). Bunun əvəzinə
    Azərbaycanın rəsmi T&D itki dərəcəsini (Dünya Bankı) kontekst kimi
    göstəririk — dəqiq milli rəqəm yalnız SOCAR-ın öz real datası ilə
    hesablana bilər."""
    device_flagged = [d for d in device_status if d["status"] == "flagged"]
    devices_total_azn = sum(d["diagnosis"]["est_savings_azn_per_year"] for d in device_flagged)
    devices_total_co2 = round(sum(d["diagnosis"]["est_co2_tons_per_year"] for d in device_flagged), 1)
    meters_total_azn = sum(m["est_annual_loss_azn"] for m in meter_loss_list)
    meters_total_kwh = sum(m["est_annual_loss_kwh"] for m in meter_loss_list)

    return {
        "pilot": {
            "device_count_flagged": len(device_flagged),
            "device_count_total": len(device_status),
            "device_savings_azn_per_year": devices_total_azn,
            "device_co2_tons_per_year": devices_total_co2,
            "meter_count_flagged": len(meter_loss_list),
            "meter_recovery_azn_per_year": meters_total_azn,
            "meter_recovery_kwh_per_year": round(meters_total_kwh, 1),
            "combined_azn_per_year": devices_total_azn + meters_total_azn,
        },
        "national_context": {
            "socar_meter_program": 2_500_000,
            "az_td_loss_pct_2023": AZ_TD_LOSS_PCT_2023,
            "az_td_loss_source": "World Bank WDI, 2023",
            "residential_tariff_azn_per_kwh": RESIDENTIAL_TARIFF_AZN_PER_KWH,
            "industrial_tariff_azn_per_kwh": SMALL_INDUSTRIAL_TARIFF_AZN_PER_KWH,
            "tariff_source": "Azərbaycan Respublikası Tarif (Qiymət) Şurası, 02.01.2025",
            "note_az": (
                "Bu pilot (50 sayğac, 10 cihaz) bilərəkdən yüksək anomaliya nisbətində "
                "qurulub ki, sistemin aşkarlama qabiliyyəti qısa sınaq pəncərəsində "
                "göstərilsin — bu, real şəbəkədəki gözlənilən tezliyi əks etdirmir. Ona "
                "görə pilot rəqəmlərini birbaşa 2.5M sayğaca vurmuruq. Bunun əvəzinə: "
                "Azərbaycanın rəsmi elektrik ötürmə/paylama itkisi (7.6%, Dünya Bankı, "
                "2023) milli miqyasda potensial dəyəri göstərir — bu itkinin bir hissəsi "
                "(qeyri-texniki: oğurluq, sayğac nasazlığı, hesablama xətaları) məhz "
                "GridPulse-un hədəflədiyi növdür. Dəqiq milli rəqəm yalnız SOCAR-ın öz "
                "real datası ilə hesablana bilər."
            ),
            "note_en": (
                "This pilot (50 meters, 10 devices) was deliberately built with an "
                "elevated anomaly rate to demonstrate detection capability within a "
                "short test window — this does not reflect expected real-world "
                "frequency. We therefore do not linearly multiply the pilot numbers to "
                "2.5M meters. Instead: Azerbaijan's official transmission/distribution "
                "loss rate (7.6%, World Bank, 2023) illustrates national-scale "
                "potential — a portion of this (non-technical losses: theft, meter "
                "faults, billing errors) is exactly what GridPulse targets. A precise "
                "national figure can only be computed with SOCAR's own data."
            ),
        },
    }


def compute_threshold_sweep(result_df, thresholds=None):
    """Sadə (persistence-siz) tək z-score həddi üçün Precision/Recall/bayraq
    sayının necə dəyişdiyini göstərir — canlı demo slider üçün. Artıq
    hesablanmış `zscore` sütunundan istifadə edir (vektorlaşdırılmış), ona görə
    ANINDA nəticə verir — tam detect_anomalies-i yenidən işə salmır.

    Tapıntı: naiv th≈3.5 bizim persistence-filtrimizlə (Recall 96.1%,
    Precision 70.5%) demək olar EYNİ nöqtəyə düşür. Yəni fərq "daha yaxşı
    nəticə" deyil — "sabit bir rəqəmi sınaq-xəta ilə tapmadan, prinsipial
    qayda (2+ ardıcıl gün) ilə eyni tarazlığa çatmaq"dır."""
    if thresholds is None:
        thresholds = [round(t, 2) for t in np.arange(1.5, 5.5, 0.1)]
    abs_z = result_df["zscore"].abs()
    is_anomaly_true = result_df["true_label"] == "anomaly"
    total_true = int(is_anomaly_true.sum())

    rows = []
    for th in thresholds:
        flagged = abs_z > th
        n_flagged = int(flagged.sum())
        true_positives = int((flagged & is_anomaly_true).sum())
        recall = round(true_positives / total_true * 100, 1) if total_true else 0
        precision = round(true_positives / n_flagged * 100, 1) if n_flagged else 0
        rows.append({"threshold": th, "recall_pct": recall, "precision_pct": precision, "flagged_count": n_flagged})

    our_flagged = int(result_df["predicted_anomaly"].sum())
    our_tp = int((result_df["predicted_anomaly"] & is_anomaly_true).sum())
    our_recall = round(our_tp / total_true * 100, 1) if total_true else 0
    our_precision = round(our_tp / our_flagged * 100, 1) if our_flagged else 0

    return {
        "sweep": rows,
        "our_system": {
            "recall_pct": our_recall,
            "precision_pct": our_precision,
            "flagged_count": our_flagged,
        },
    }


def detect_robust_trailing(meter_id, g, value_col="consumption_kwh",
                            trailing_window=42, z_extreme=5.0, z_moderate=3.0, persist_days=4):
    """v4 — real-data validasiyasından (real_data_validation.py) doğan
    təkmilləşdirmə, indi ümumi funksiya kimi. Sabit CALIB_DAYS-günlük
    kalibrasiya snapshot-u əvəzinə sürüşən pəncərə istifadə edir (mövsümi
    trendi izləyir) VƏ artıq bayraqlanmış günləri pəncərədən çıxarır (əks
    halda davam edən anomaliya baza kimi öyrənilib "gizlənir").

    v5 (2020-2024 EIA tam-il validasiyası, 19 region): tapıldı ki, sadəcə
    "əvvəlki 1 gün" persistensiyası tam təqvim ilində (mövsümi gurultu güclü
    olanda) hələ də 21.2% yalançı həyəcan verir. STL/mövsümi dekompozisiya
    sınandı — NƏTİCƏ PİS OLDU (statik illik şablon il-fərqi hava dəyişkənliyini
    tuta bilmədi, 12-70% FP). Əvəzinə `persist_days` parametrləşdirildi:
    N-günlük ardıcıl streak tələbi (sadəcə əvvəlki gün yox) real, davamlı
    nasazlıqları tutmağa davam edir, amma qısamüddətli təbii gurultunu
    süzür. z_extreme=5.0, z_moderate=3.0, persist_days=4 ilə: Recall 100%,
    Precision 97.3%, FP 5.5% (əvvəlki 21.2%-dən) — HƏTTA ilkin 2002-2018
    nəticəmizdən (3.96%) güclü, daha çətin testdə (tam il, 19 region)."""
    g = g.sort_values("date").reset_index(drop=True)
    g["day_idx"] = np.arange(len(g))
    n = len(g)
    expected = np.full(n, np.nan)
    zscore = np.full(n, 0.0)
    flagged = np.full(n, False)
    moderate_streak = 0
    residual_std_running = g[value_col].iloc[:CALIB_DAYS].std() or 1

    for i in range(n):
        lo = max(0, i - trailing_window)
        window = g.iloc[lo:i]
        if i > 0:
            window = window[~flagged[lo:i]]
        same_wd = window[window["weekday"] == g["weekday"].iloc[i]]
        if len(same_wd) >= 3:
            expected[i] = same_wd[value_col].mean()
        elif len(window) >= 5:
            expected[i] = window[value_col].mean()
        else:
            expected[i] = g[value_col].iloc[:CALIB_DAYS].mean()

        resid = g[value_col].iloc[i] - expected[i]
        z = resid / residual_std_running
        zscore[i] = z
        abs_z = abs(z)
        if abs_z > z_extreme:
            flagged[i] = True
            moderate_streak = 0
        elif abs_z > z_moderate:
            moderate_streak += 1
            if moderate_streak >= persist_days:
                flagged[i] = True
        else:
            moderate_streak = 0

        if i >= CALIB_DAYS and not flagged[i]:
            recent = g[value_col].iloc[max(0, i - 90):i + 1] - pd.Series(expected[max(0, i - 90):i + 1])
            recent = recent.dropna()
            if len(recent) > 20:
                residual_std_running = recent.std() or residual_std_running

    g["expected"] = expected
    g["zscore"] = zscore
    g["predicted_anomaly"] = flagged
    g["meter_id"] = meter_id
    return g


def detect_anomalies_robust(df, value_col="consumption_kwh", n_jobs=1,
                             trailing_window=42, z_extreme=5.0, z_moderate=3.0, persist_days=4):
    """detect_anomalies-in robust-trailing versiyası — güclü mövsümi trendi
    olan domenlər üçün (bax detect_robust_trailing qeydi)."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["weekday"] = df["date"].dt.weekday
    groups = list(df.groupby("meter_id"))

    def run(mid, g):
        return detect_robust_trailing(mid, g, value_col, trailing_window, z_extreme, z_moderate, persist_days)

    if n_jobs == 1:
        results = [run(mid, g) for mid, g in groups]
    else:
        from joblib import Parallel, delayed
        results = Parallel(n_jobs=n_jobs)(delayed(run)(mid, g) for mid, g in groups)
    return pd.concat(results, ignore_index=True)