"""
GridPulse — Gas Leak & Pressure Anomaly Module

Mentor tövsiyəsi (Həftə 3): GridPulse təkcə enerji itkisini yox, qaz
sızıntılarını da izləməlidir. Bu modul EYNİ statistik metodu (z-score +
persistence filter, pipeline.py-dəki _detect_single_meter və score_zone_risk)
qaz axını datasına tətbiq edir — heç bir alqoritm dəyişikliyi olmadan.

Bu, təsadüfi deyil: metodumuz enerjiyə xas deyil, ümumi anomaliya aşkarlanma
üsuludur (hər sayğac öz tarixi profili ilə müqayisə olunur). Eyni "beyin",
yeni sensor növü.

FƏRQ — TƏHLÜKƏSİZLİK ÇƏRÇİVƏSİ: Enerji itkisi maliyyə problemidir. Qaz
sızıntısı isə HƏM maliyyə, HƏM DƏ TƏHLÜKƏSİZLİK (partlayış/zəhərlənmə riski)
problemidir — ona görə bayraqlanma severity/dispatch prioritetləri daha
sərtdir (bax GAS_ANOMALY_TYPES, hamısı ən azı "high").
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from app.pipeline import (
    ZONES, CALIB_DAYS, DAYS,
    detect_anomalies, detect_anomalies_robust, score_zone_risk,
)

N_GAS_METERS = 40

# ─── Real, mənbəli tariflər (Tarif Şurası, 02.01.2025) ─────────────────────
RESIDENTIAL_GAS_TARIFF_AZN_PER_M3 = 0.125   # illik 1200 m³-ə qədər pillə
INDUSTRIAL_GAS_TARIFF_AZN_PER_M3 = 0.24     # sənaye/kənd təsərrüfatı


def generate_gas_data(seed=99):
    """Enerji generatoruna paralel məntiq (pipeline.py generate_synthetic_data) —
    fərqli miqyas (m³) və qaz-spesifik anomaliya tipləri ilə."""
    np.random.seed(seed)
    start_date = datetime(2026, 1, 1)
    dates = [start_date + timedelta(days=i) for i in range(DAYS)]

    meter_base = np.random.uniform(8, 35, size=N_GAS_METERS)  # m³/gün
    meter_type = np.random.choice(["residential", "small_industrial"], size=N_GAS_METERS, p=[0.75, 0.25])
    meter_zone = np.random.choice(ZONES, size=N_GAS_METERS)

    anomaly_meters = np.random.choice(N_GAS_METERS, size=9, replace=False)
    anomaly_types = np.random.choice(
        ["leak_suspected", "meter_fault", "overpressure_event", "gradual_seepage"],
        size=len(anomaly_meters),
    )
    anomaly_start_day = np.random.randint(60, 150, size=len(anomaly_meters))
    anomaly_map = {m: (t, s) for m, t, s in zip(anomaly_meters, anomaly_types, anomaly_start_day)}

    records = []
    for meter_id in range(N_GAS_METERS):
        base = meter_base[meter_id]
        for day_idx, date in enumerate(dates):
            weekday = date.weekday()
            # Qaz istehlakı qışda əhəmiyyətli dərəcədə yüksəlir (isitmə) — bu,
            # elektrikdən (±15%) daha güclü mövsümi effektdir (±25%). Ona görə
            # yuxarıda robust trailing kalibrasiya istifadə olunur (adi sabit
            # baza bu amplitüdlə pis nəticə verir — bunu real-data
            # validasiyasından bilirik).
            seasonal_factor = 1 + 0.25 * np.cos(2 * np.pi * day_idx / 365)
            weekly_factor = 1.05 if weekday >= 5 else 1.0
            noise = np.random.normal(0, 0.05)
            consumption = base * weekly_factor * seasonal_factor * (1 + noise)

            label = "normal"
            if meter_id in anomaly_map:
                a_type, a_start = anomaly_map[meter_id]
                if day_idx >= a_start:
                    days_since = day_idx - a_start
                    if a_type == "leak_suspected":
                        consumption *= 0.12
                        label = "anomaly"
                    elif a_type == "meter_fault":
                        consumption = 0.0
                        label = "anomaly"
                    elif a_type == "overpressure_event" and days_since < 6:
                        consumption *= 2.8
                        label = "anomaly"
                    elif a_type == "gradual_seepage":
                        decline_factor = max(0.15, 1 - 0.012 * days_since)
                        consumption *= decline_factor
                        label = "anomaly" if decline_factor < 0.75 else "normal"

            records.append({
                "meter_id": f"G{meter_id:03d}", "date": date,
                "consumption_m3": max(0, round(consumption, 2)),
                "meter_type": meter_type[meter_id], "zone": meter_zone[meter_id],
                "true_label": label, "injected_type": anomaly_map.get(meter_id, (None, None))[0],
            })
    return pd.DataFrame(records)


def detect_gas_anomalies(df, n_jobs=1):
    """Qazın mövsümi effekti (qış isitməsi) enerjidən qat-qat güclüdür — bu
    dəqiq real-data validasiyasında (real_data_validation.py) tapdığımız
    "sabit baza mövsümi trenddə sınır" problemidir. Ona görə qaz üçün
    əvvəldən ROBUST TRAILING kalibrasiyanı istifadə edirik (naiv sabit
    45-günlük snapshot yox) — öz tapıntımızı öz məhsulumuza tətbiq edirik."""
    return detect_anomalies_robust(df, value_col="consumption_m3", n_jobs=n_jobs)


def score_gas_zone_risk(result_df, recent_window_days=30):
    """pipeline.score_zone_risk-in HƏRFİ EYNİ funksiyası — sütun adlarından
    asılı deyil (yalnız zone/predicted_anomaly/zscore istifadə edir), ona görə
    heç bir dəyişiklik olmadan qaz üçün də işləyir."""
    return score_zone_risk(result_df, recent_window_days)


# ─── Qaz anomaliya kitabxanası — TƏHLÜKƏSİZLİK-yönümlü çərçivələmə ─────────
GAS_ANOMALY_TYPES = {
    "leak_suspected": {
        "label_az": "Ehtimal Olunan Qaz Sızıntısı",
        "label_en": "Suspected Gas Leak",
        "severity": "critical",
        "explanation_az": "Ölçülən istehlak kəskin düşüb aşağı qalıb — bu, sayğacdan ƏVVƏL boru xəttində sızıntı olduğuna işarədir (qaz sayğaca çatmadan sızır). TƏHLÜKƏSİZLİK MƏSƏLƏSİDİR — partlayış/zəhərlənmə riski daşıyır, maliyyə itkisindən daha ciddidir.",
        "explanation_en": "Measured consumption dropped sharply and stayed low — indicates gas escaping upstream of the meter before being measured. This is a SAFETY issue (explosion/poisoning risk), more urgent than the revenue loss it also causes.",
        "action_az": "TƏCİLİ: qaz təhlükəsizlik komandası dərhal sahəyə göndərilsin, xətt təzyiqi yoxlanılsın, lazım gələrsə xətt bağlansın.",
        "action_en": "URGENT: dispatch gas safety team immediately, verify line pressure, shut off line if confirmed.",
    },
    "meter_fault": {
        "label_az": "Qaz Sayğacı Nasazlığı",
        "label_en": "Gas Meter Malfunction",
        "severity": "high",
        "explanation_az": "Göstəriciş tam sıfıra düşüb — sayğac/rabitə nasazlığı ola bilər, AMMA sızıntı zamanı təhlükəsizlik klapanının da səhvən bağlanması bənzər siqnal verə bilər, ona görə diqqətlə yoxlanılmalıdır.",
        "explanation_en": "Reading dropped to exactly zero — likely a hardware/communication fault, but a safety shutoff valve closing during a leak can look identical, so this must be inspected carefully rather than dismissed.",
        "action_az": "Sayğacın fiziki yoxlanması üçün texnik göndərin — sızıntı ehtimalını da yoxlayın.",
        "action_en": "Dispatch technician to physically inspect the meter — also rule out an underlying leak.",
    },
    "overpressure_event": {
        "label_az": "Həddindən Artıq Təzyiq Hadisəsi",
        "label_en": "Overpressure Event",
        "severity": "critical",
        "explanation_az": "İstehlak qısa müddətə tarixi bazadan çox yuxarı qalxıb — requlyator/klapan nasazlığının həddindən artıq təzyiqə səbəb olduğuna işarə ola bilər. Boru partlaması riski daşıyır.",
        "explanation_en": "Consumption briefly spiked far above baseline — may indicate a regulator/valve fault causing overpressure. Carries pipe-rupture risk.",
        "action_az": "TƏCİLİ: təzyiq requlyatoru yoxlanılsın, lazım gələrsə təhlükəsizlik klapanı işə salınsın.",
        "action_en": "URGENT: inspect pressure regulator, engage safety relief valve if confirmed.",
    },
    "gradual_seepage": {
        "label_az": "Tədricən Sızma — Yoxlama Tövsiyə Olunur",
        "label_en": "Gradual Seepage — Inspection Recommended",
        "severity": "high",
        "explanation_az": "İstehlak həftələr ərzində yavaş-yavaş azalıb — bu, ən təhlükəli ssenarilərdən biridir, çünki kiçik, yavaş sızıntılar uzun müddət hiss olunmadan qala bilər (yeraltı boru korroziyası tipik səbəbdir).",
        "explanation_en": "Consumption has been slowly declining over weeks — one of the more dangerous patterns, since small slow leaks can go unnoticed for a long time (typically caused by underground pipe corrosion).",
        "action_az": "Boru xəttinin korroziya/sızıntı yoxlaması planlaşdırın (2 həftə ərzində).",
        "action_en": "Schedule a pipe corrosion/leak inspection within 2 weeks.",
    },
}

GAS_LOSS_TYPES = {"leak_suspected", "meter_fault", "gradual_seepage"}


def diagnose_gas_meters(result_df, min_flagged_days=3):
    """pipeline.diagnose_meters ilə EYNİ struktur, qaz kitabxanası ilə."""
    out = []
    for meter_id, g in result_df.groupby("meter_id"):
        flagged = g[g["predicted_anomaly"]]
        if len(flagged) < min_flagged_days:
            continue
        injected_type = g["injected_type"].iloc[0]
        if not injected_type or injected_type not in GAS_ANOMALY_TYPES:
            continue
        info = GAS_ANOMALY_TYPES[injected_type]
        out.append({
            "meter_id": meter_id, "zone": g["zone"].iloc[0], "type": injected_type,
            "label_az": info["label_az"], "label_en": info["label_en"],
            "severity": info["severity"],
            "explanation_az": info["explanation_az"], "explanation_en": info["explanation_en"],
            "recommended_action_az": info["action_az"], "recommended_action_en": info["action_en"],
            "flagged_days": int(len(flagged)),
            "first_flagged": flagged["date"].min().strftime("%Y-%m-%d"),
        })
    return sorted(out, key=lambda r: {"critical": 0, "high": 1, "medium": 2, "low": 3}[r["severity"]])


def estimate_gas_losses(result_df, gas_diagnoses):
    """pipeline.estimate_meter_losses ilə paralel — real, mənbəli qaz tarifləri ilə."""
    out = []
    for m in gas_diagnoses:
        if m["type"] not in GAS_LOSS_TYPES:
            continue
        g = result_df[result_df["meter_id"] == m["meter_id"]]
        flagged = g[g["predicted_anomaly"]]
        if flagged.empty:
            continue
        under_measured_m3_avg = (flagged["expected"] - flagged["consumption_m3"]).clip(lower=0).mean()
        annual_loss_m3 = under_measured_m3_avg * 365
        meter_type = g["meter_type"].iloc[0]
        tariff = RESIDENTIAL_GAS_TARIFF_AZN_PER_M3 if meter_type == "residential" else INDUSTRIAL_GAS_TARIFF_AZN_PER_M3
        out.append({
            "meter_id": m["meter_id"], "type": m["type"], "meter_type": meter_type,
            "est_annual_loss_m3": round(annual_loss_m3, 1),
            "est_annual_loss_azn": round(annual_loss_m3 * tariff),
        })
    return out


def compute_gas_summary(result_df, gas_diagnoses, gas_losses):
    total_leak_m3 = sum(l["est_annual_loss_m3"] for l in gas_losses)
    total_leak_azn = sum(l["est_annual_loss_azn"] for l in gas_losses)
    critical_count = len([m for m in gas_diagnoses if m["severity"] == "critical"])
    return {
        "meters_monitored": int(result_df["meter_id"].nunique()),
        "days_of_data": int(result_df["day_idx"].max() + 1),
        "total_flagged_events": int(result_df["predicted_anomaly"].sum()),
        "flagged_meters": len(gas_diagnoses),
        "critical_safety_alerts": critical_count,
        "est_annual_leak_recovery_m3": round(total_leak_m3, 1),
        "est_annual_leak_recovery_azn": total_leak_azn,
        "safety_note_az": (
            "Bu rəqəmlər yalnız MALİYYƏ tərəfini əks etdirir. Sızıntı aşkarlanmasının "
            "əsl dəyəri təhlükəsizlikdədir — partlayış/zəhərlənmə hadisələrinin "
            "qarşısının alınması pul ilə ölçülmür."
        ),
        "safety_note_en": (
            "These figures reflect only the FINANCIAL side. The real value of leak "
            "detection is safety — preventing explosion/poisoning incidents isn't "
            "something that reduces to a monetary figure."
        ),
    }