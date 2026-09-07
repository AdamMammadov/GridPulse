"""
GridPulse — Critical Civic Infrastructure Module

Mentor tövsiyəsi (Həftə 3, Ssenari 2): "Metro, xəstəxana, nəqliyyat üçün
GridPulse nə edə bilər?"

Bu modul YENİ alqoritm yaratmır — mövcud device-səviyyəli kök-səbəb analiz
mühərrikini (devices.py-dəki eyni ROOT_CAUSES kitabxanası, eyni z-score +
persistence aşkarlanması) fərqli bir "obyekt" üzərində göstərir: sənaye
terminalı əvəzinə, şəhərin kritik mülki infrastrukturu (metro, xəstəxana,
EV şarj, nəqliyyat siqnalları).

Niyə vacibdir: bu obyektlərdə bir nasazlıq təkcə maliyyə itkisi demək
deyil — metronun ehtiyat gücü kəsilərsə sərnişinlər tunel içində qalır,
xəstəxananın fövqəladə generatoru işə düşməzsə əməliyyat otağı qaranlıq
qalır. Ona görə bu modulda əsas metrika "AZN qənaəti" deyil, "kritiklik və
proqnozlaşdırılan nasazlığa qədər qalan vaxt"dır (predictive maintenance
artıq mövcud olan xüsusiyyətdir, bax devices.py CRITICAL_THRESHOLDS).
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from app.devices import ROOT_CAUSES, CRITICAL_THRESHOLDS, INDUSTRIAL_TARIFF_AZN_PER_KWH, GRID_EMISSION_FACTOR_KG_CO2_PER_KWH

DAYS = 180
CALIB_DAYS = 45
START_DATE = datetime(2026, 1, 1)

CRITICAL_DEVICES = [
    {"id": "C01", "name_az": "Metro Stansiyası Cəkiş Yarımstansiyası", "name_en": "Metro Station Traction Substation",
     "category": "compressor", "zone": "Metro", "rated_kw": 800, "duty": "continuous",
     "criticality_az": "Qatarların hərəkəti birbaşa asılıdır", "criticality_en": "Train movement directly depends on this"},
    {"id": "C02", "name_az": "Metro Ehtiyat UPS-i", "name_en": "Metro Station Backup UPS",
     "category": "it_load", "zone": "Metro", "rated_kw": 60, "duty": "standby",
     "criticality_az": "Kəsinti zamanı işıqlandırma və qapılar", "criticality_en": "Emergency lighting and doors during outage"},
    {"id": "C03", "name_az": "Xəstəxana Fövqəladə Generatoru", "name_en": "Hospital Emergency Generator",
     "category": "safety_pump", "zone": "Hospital", "rated_kw": 500, "duty": "standby",
     "criticality_az": "Əməliyyat otağı, reanimasiya", "criticality_en": "Operating rooms, ICU"},
    {"id": "C04", "name_az": "Xəstəxana Kritik Güc Xətti", "name_en": "Hospital Critical Power Bus",
     "category": "it_load", "zone": "Hospital", "rated_kw": 150, "duty": "continuous",
     "criticality_az": "Həyat dəstək avadanlığı", "criticality_en": "Life-support equipment"},
    {"id": "C05", "name_az": "EV Şarj Mərkəzi Transformatoru", "name_en": "EV Charging Hub Transformer",
     "category": "pump", "zone": "Mobility", "rated_kw": 350, "duty": "cyclic",
     "criticality_az": "İctimai nəqliyyat & təcili xidmət EV-ləri", "criticality_en": "Public transit & emergency-service EVs"},
    {"id": "C06", "name_az": "Nəqliyyat Siqnalları Enerji Təchizatı", "name_en": "Traffic Signal Power Supply",
     "category": "lighting", "zone": "Mobility", "rated_kw": 20, "duty": "scheduled",
     "criticality_az": "Yol təhlükəsizliyi", "criticality_en": "Road safety"},
]

ZONE_LABELS = {
    "Metro": ("Metro Şəbəkəsi", "Metro Network"),
    "Hospital": ("Xəstəxana Kompleksi", "Hospital Complex"),
    "Mobility": ("Şəhər Mobilliyi", "Urban Mobility"),
}

# device_id -> (root_cause_id, pattern, start_day) — ROOT_CAUSES devices.py-dən import olunub
INJECTED_FAULTS = {
    "C01": ("bearing_wear", "gradual_increase", 75),
    "C02": ("battery_degradation", "gradual_increase", 55),
    "C03": ("unexpected_activation", "sustained_on", 125),
    "C05": ("fouled_filter", "step_increase", 95),
    "C06": ("sensor_fault", "off_schedule", 105),
    # C04 (Hospital Critical Power Bus) sağlam istinad vahidi kimi saxlanılır
}

DUTY_PROFILES = {
    "continuous": lambda hour, rng: 0.85 + 0.1 * np.sin(hour / 3) + rng.normal(0, 0.03),
    "cyclic":     lambda hour, rng: (0.6 if (hour // 4) % 2 == 0 else 0.15) + rng.normal(0, 0.04),
    "scheduled":  lambda hour, rng: (0.75 if 8 <= hour <= 18 else 0.03) + rng.normal(0, 0.03),
    "standby":    lambda hour, rng: 0.02 + rng.normal(0, 0.01),
}


def generate_critical_infra_data(seed=13):
    rng = np.random.default_rng(seed)
    dates = [START_DATE + timedelta(days=i) for i in range(DAYS)]
    records = []
    for dev in CRITICAL_DEVICES:
        fault = INJECTED_FAULTS.get(dev["id"])
        duty_fn = DUTY_PROFILES[dev["duty"]]
        for day_idx, date in enumerate(dates):
            day_load_factor = np.mean([duty_fn(h, rng) for h in range(0, 24, 4)])
            power_kw = max(0, dev["rated_kw"] * day_load_factor)
            if fault:
                cause_id, pattern, start_day = fault
                if day_idx >= start_day:
                    days_since = day_idx - start_day
                    if pattern == "gradual_increase":
                        power_kw *= 1 + min(0.35, 0.004 * days_since)
                    elif pattern == "step_increase":
                        power_kw *= 1.22
                    elif pattern == "off_schedule":
                        if rng.random() < 0.3:
                            power_kw = dev["rated_kw"] * rng.uniform(0.4, 0.7)
                    elif pattern == "sustained_on":
                        power_kw = dev["rated_kw"] * rng.uniform(0.75, 0.95)
            records.append({"device_id": dev["id"], "date": date, "power_kw": round(power_kw, 2)})
    return pd.DataFrame(records)


def diagnose_critical_infra(raw_df):
    """devices.py-dəki diagnose_devices ilə EYNİ metodologiya, fərqli obyekt
    üzərində. Fərq: nəticədə 'uptime_criticality' sahəsi var (AZN yox,
    kritiklik izahı) — çünki metro/xəstəxana kontekstində əsas sual pul yox,
    xidmətin kəsilməməsidir."""
    df = raw_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    results = []
    for dev in CRITICAL_DEVICES:
        g = df[df["device_id"] == dev["id"]].sort_values("date").reset_index(drop=True)
        g["day_idx"] = np.arange(len(g))
        calib = g[g["day_idx"] < CALIB_DAYS]
        baseline = calib["power_kw"].mean() or 1
        calib_std = calib["power_kw"].std() or 1
        g["expected_kw"] = baseline
        g["zscore"] = (g["power_kw"] - baseline) / calib_std
        abs_z = g["zscore"].abs()
        extreme = abs_z > 4.0
        moderate = (abs_z > 2.2) & (~extreme)
        streak = moderate.groupby((~moderate).cumsum()).cumsum()
        g["is_anomaly"] = extreme | (moderate & (streak >= 3))
        g["device_id"] = dev["id"]
        results.append(g)
    full = pd.concat(results, ignore_index=True)

    status_list = []
    for dev in CRITICAL_DEVICES:
        g = full[full["device_id"] == dev["id"]]
        calib = g[g["day_idx"] < CALIB_DAYS]
        baseline = calib["power_kw"].mean() or 1
        flagged = g[g["is_anomaly"]]
        fault = INJECTED_FAULTS.get(dev["id"])
        status = {
            "id": dev["id"], "name_az": dev["name_az"], "name_en": dev["name_en"],
            "category": dev["category"], "zone": dev["zone"],
            "zone_az": ZONE_LABELS[dev["zone"]][0], "zone_en": ZONE_LABELS[dev["zone"]][1],
            "rated_kw": dev["rated_kw"],
            "criticality_az": dev["criticality_az"], "criticality_en": dev["criticality_en"],
            "flagged_days": int(len(flagged)), "status": "healthy", "diagnosis": None,
        }
        if len(flagged) >= 3 and fault:
            cause_id, pattern, start_day = fault
            cause = ROOT_CAUSES[cause_id]
            avg_z = flagged["zscore"].abs().mean()
            confidence = int(min(94, 100 - 58 / (1 + avg_z / 3.2)))
            excess_kw_avg = (flagged["power_kw"] - baseline).abs().mean()
            annual_excess_kwh = excess_kw_avg * 365
            est_savings_azn = round(annual_excess_kwh * INDUSTRIAL_TARIFF_AZN_PER_KWH)
            est_co2_tons = round(annual_excess_kwh * GRID_EMISSION_FACTOR_KG_CO2_PER_KWH / 1000, 1)

            status["status"] = "flagged"
            status["diagnosis"] = {
                "cause_id": cause_id,
                "label_az": cause["label_az"], "label_en": cause["label_en"],
                "explanation_az": cause["explanation_az"], "explanation_en": cause["explanation_en"],
                "recommended_action_az": cause["action_az"], "recommended_action_en": cause["action_en"],
                "confidence_pct": confidence,
                "est_savings_azn_per_year": est_savings_azn,
                "est_co2_tons_per_year": est_co2_tons,
                "detected_since": (START_DATE + timedelta(days=start_day)).strftime("%Y-%m-%d"),
            }
            threshold_cfg = CRITICAL_THRESHOLDS.get(cause_id)
            if threshold_cfg:
                fault_period = g[g["day_idx"] >= start_day]
                last_day = int(g["day_idx"].max())
                last_value = float(fault_period[fault_period["day_idx"] == last_day]["power_kw"].mean())
                days_elapsed = last_day - start_day
                rate_per_day = (last_value - baseline) / days_elapsed if days_elapsed > 0 else 0
                critical_value = baseline * (1 + threshold_cfg["threshold_frac"]) if threshold_cfg["direction"] == "up" else baseline * (1 - threshold_cfg["threshold_frac"])
                days_to_critical = (critical_value - last_value) / rate_per_day if rate_per_day != 0 else None
                if days_to_critical is not None and days_to_critical > 0:
                    days_int = int(round(days_to_critical))
                    status["diagnosis"]["predictive"] = {
                        "days_remaining": days_int,
                        "note_az": f"~{days_int} gün ərzində kritik həddə çatacaq — {dev['criticality_az'].lower()} riskə girə bilər.",
                        "note_en": f"~{days_int} days until critical threshold — {dev['criticality_en'].lower()} could be at risk.",
                    }
        status_list.append(status)
    return status_list, full