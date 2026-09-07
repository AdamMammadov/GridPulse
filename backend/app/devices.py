"""
GridPulse — Device-Level Root Cause Analysis

10 real equipment types from a representative export/processing terminal
facility. Each device gets a realistic daily power profile (by duty-cycle
type) and ONE injected anomaly with a KNOWN, industry-realistic root cause.

Honesty note: for this prototype, the root cause reported when an anomaly
is detected is the cause that generated the synthetic data (ground truth) —
this demonstrates the concept (detect -> explain -> recommend -> estimate
savings) using data we control. In production this diagnosis step would be
a trained classifier or expert rule engine running against real sensor/
vibration/thermal data, not synthetic ground truth.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

DAYS = 180
CALIB_DAYS = 45
START_DATE = datetime(2026, 1, 1)

# ─── Assumptions used to convert measured energy waste into AZN + CO2 ──────
INDUSTRIAL_TARIFF_AZN_PER_KWH = 0.09
GRID_EMISSION_FACTOR_KG_CO2_PER_KWH = 0.45  # qaz-əsaslı generasiya üçün tipik əmsal

# ─── Predictive maintenance: yalnız TƏDRİCƏN pisləşən nasazlıq tiplərinə
# aiddir (kəskin pik/cədvəldənkənar işləmə üçün "N gündə sıradan çıxacaq"
# demək mənasızdır — trend yoxdur, hadisə artıq baş verib).
CRITICAL_THRESHOLDS = {
    "bearing_wear": {"direction": "up", "threshold_frac": 0.45},
    "battery_degradation": {"direction": "up", "threshold_frac": 0.40},
    "impeller_wear": {"direction": "down", "threshold_frac": 0.35},
}

# ─── Zona displey adları (neytral "zone" açarı dispatch.py və FacilityMap.jsx
# üçün dəyişməz saxlanılır — yalnız göstərilən mətn dilə görə dəyişir) ───────
ZONE_LABELS = {
    "Pump Station": ("Nasos Stansiyası", "Pump Station"),
    "Compression Unit": ("Sıxılma Bölməsi", "Compression Unit"),
    "Utilities": ("Kommunal Xidmətlər", "Utilities"),
    "Admin Building": ("İnzibati Bina", "Admin Building"),
    "Tank Farm": ("Çən Təsərrüfatı", "Tank Farm"),
    "Perimeter": ("Perimetr", "Perimeter"),
    "Safety Systems": ("Təhlükəsizlik Sistemləri", "Safety Systems"),
    "Berth / Loading Dock": ("İskələ / Yükləmə Dokku", "Berth / Loading Dock"),
}

# ─── Device fleet (representative export/processing terminal) ─────────────
# AZ adlar pitch deck-də istifadə olunan terminologiya ilə uyğunlaşdırılıb.
DEVICES = [
    {"id": "D01", "name_az": "İxrac Nasosu A", "name_en": "Export Pump A", "category": "pump",
     "zone": "Pump Station", "rated_kw": 450, "duty": "continuous"},
    {"id": "D02", "name_az": "İxrac Nasosu B (Ehtiyat)", "name_en": "Export Pump B (Standby)", "category": "pump",
     "zone": "Pump Station", "rated_kw": 450, "duty": "cyclic"},
    {"id": "D03", "name_az": "Qaz Booster Kompressoru", "name_en": "Gas Booster Compressor", "category": "compressor",
     "zone": "Compression Unit", "rated_kw": 600, "duty": "continuous"},
    {"id": "D04", "name_az": "Soyutma Suyu Sirkulyasiya Nasosu", "name_en": "Cooling Water Circulation Pump", "category": "pump",
     "zone": "Utilities", "rated_kw": 120, "duty": "continuous"},
    {"id": "D05", "name_az": "Nəzarət Otağı HVAC / Soyuducu", "name_en": "Control Room HVAC / Chiller", "category": "hvac",
     "zone": "Admin Building", "rated_kw": 80, "duty": "cyclic"},
    {"id": "D06", "name_az": "Anbar Çəni Qarışdırıcısı", "name_en": "Storage Tank Mixer", "category": "motor",
     "zone": "Tank Farm", "rated_kw": 40, "duty": "scheduled"},
    {"id": "D07", "name_az": "Həyət Perimetr İşıqlandırması", "name_en": "Yard Perimeter Lighting", "category": "lighting",
     "zone": "Perimeter", "rated_kw": 25, "duty": "scheduled"},
    {"id": "D08", "name_az": "Yanğınsöndürmə Nasosu", "name_en": "Fire-Water Pump", "category": "safety_pump",
     "zone": "Safety Systems", "rated_kw": 350, "duty": "standby"},
    {"id": "D09", "name_az": "Nəzarət Otağı Serverləri / UPS", "name_en": "Control Room Servers / UPS", "category": "it_load",
     "zone": "Admin Building", "rated_kw": 15, "duty": "continuous"},
    {"id": "D10", "name_az": "Yükləmə Qolu Hidravlik Sistemi", "name_en": "Loading Arm Hydraulic Unit", "category": "hydraulic",
     "zone": "Berth / Loading Dock", "rated_kw": 55, "duty": "scheduled"},
]

# ─── Root-cause library: anomaly signature -> explanation ─────────────────
ROOT_CAUSES = {
    "bearing_wear": {
        "label_az": "Yastıq aşınması / oxlararası yerdəyişmə",
        "label_en": "Bearing wear / misalignment",
        "explanation_az": "Çıxışda dəyişiklik olmadan güc istehlakının tədricən, davamlı artması — yastıq korlanmasının və ya val yerdəyişməsinin mexaniki sürtünməni artırmasının klassik əlamətidir.",
        "explanation_en": "Gradual, sustained increase in power draw with no change in output — the classic signature of bearing degradation or shaft misalignment increasing mechanical friction.",
        "action_az": "2 həftə ərzində vibrasiya analizi və yastıq yoxlaması planlaşdırın.",
        "action_en": "Schedule vibration analysis and bearing inspection within 2 weeks.",
    },
    "fouled_filter": {
        "label_az": "Tıxanmış filtr / artmış əks təzyiq",
        "label_en": "Fouled filter / increased backpressure",
        "explanation_az": "Eyni məhsuldarlığı saxlamaq üçün güc istehlakında pilləli artım — filtrin tıxanmasına və ya xəttin daralmasının vahidi daha çox işlətməyə məcbur etdiyinə uyğundur.",
        "explanation_en": "Step increase in power draw to maintain the same throughput — consistent with filter fouling or line restriction forcing the unit to work harder.",
        "action_az": "Giriş/çıxış filtrlərini yoxlayın və əvəz edin.",
        "action_en": "Inspect and replace intake/discharge filters.",
    },
    "impeller_wear": {
        "label_az": "Təkər (impeller) aşınması / kavitasiya",
        "label_en": "Impeller wear / cavitation",
        "explanation_az": "Sabit güc istehlakında effektiv çıxışın tədricən azalması — təkər eroziyasının və ya kavitasiyanın nasosun səmərəliliyini vaxt keçdikcə azaltmasının tipik əlamətidir.",
        "explanation_en": "Gradual decline in effective output at constant power draw — typical of impeller erosion or cavitation reducing pump efficiency over time.",
        "action_az": "Növbəti texniki xidmət zamanı təkəri və sorma şəraitini yoxlayın.",
        "action_en": "Inspect impeller and suction conditions at next maintenance window.",
    },
    "refrigerant_leak": {
        "label_az": "Soyuducu qaz sızması / tez-tez dövr",
        "label_en": "Refrigerant leak / short-cycling",
        "explanation_az": "Nizamsız, yüksək tezlikli aç/söndür pikləri — soyuducu qaz sızmasının kompressoru səmərəli işləmək əvəzinə tez-tez dövr etməyə (short-cycling) məcbur etdiyinə uyğundur.",
        "explanation_en": "Irregular high-frequency on/off spikes — consistent with a refrigerant leak causing the compressor to short-cycle rather than run efficiently.",
        "action_az": "Soyuducu qaz doldurulmasını və termostat kalibrasiyasını yoxlayın.",
        "action_en": "Check refrigerant charge and thermostat calibration.",
    },
    "schedule_fault": {
        "label_az": "İdarəetmə/cədvəl nasazlığı",
        "label_en": "Control/scheduling fault",
        "explanation_az": "İstehlak avadanlığın normal iş pəncərəsindən kənarda qeydə alınıb — mexaniki problemdən çox taymer, sensor və ya avtomatlaşdırma məntiqi nasazlığını göstərir.",
        "explanation_en": "Consumption recorded outside the equipment's normal operating window — indicates a timer, sensor, or automation logic fault rather than a mechanical issue.",
        "action_az": "Bu vahid üçün idarəetmə məntiqini / cədvəl avtomatlaşdırmasını audit edin.",
        "action_en": "Audit control logic / scheduling automation for this unit.",
    },
    "sensor_fault": {
        "label_az": "Fotoxəlihüceyrə / taymer sensor nasazlığı",
        "label_en": "Photocell / timer sensor fault",
        "explanation_az": "Avadanlıq dizayn etibarilə söndürülməli olan saatlarda işləyir — işıqlandırma dövrələri üçün ən çox rast gəlinən səbəb nasaz fotoxəlihüceyrə və ya taymerdir.",
        "explanation_en": "Equipment running during hours it should be off by design — a failed photocell or timer is the most common cause for lighting circuits.",
        "action_az": "Fotoxəlihüceyrəni/taymer sensorunu əvəz edin.",
        "action_en": "Replace photocell/timer sensor.",
    },
    "unexpected_activation": {
        "label_az": "Gözlənilməz aktivasiya — dərhal yoxlanılmalıdır",
        "label_en": "Unexpected activation — inspect immediately",
        "explanation_az": "Bu vahid planlaşdırılmış həftəlik testlər xaricində standby rejimində qalmalıdır. Davamlı, planlaşdırılmamış işləmə — nəzərdə tutulmayan aktivasiya, klapan nasazlığı, yaxud real sistem tələbatı deməkdir; təhlükəsizliklə bağlıdır və adi hal kimi qəbul edilməməlidir.",
        "explanation_en": "This unit is designed to remain in standby except for scheduled weekly tests. Sustained unscheduled running suggests an unintended activation, valve fault, or a real system demand — safety-relevant and should not be treated as routine.",
        "action_az": "Dərhal fiziki yoxlama tələb olunur — klapan vəziyyətini və sistem təzyiqini yoxlayın.",
        "action_en": "Immediate physical inspection required — verify valve position and system pressure.",
    },
    "battery_degradation": {
        "label_az": "UPS batareyasının korlanması",
        "label_en": "UPS battery degradation",
        "explanation_az": "Yük dəyişməsi olmadan baza gücündə yavaş yuxarı sürüşmə — köhnəlməkdə olan UPS batareyalarının korlandıqca daha çox float cərəyanı çəkməsinə uyğundur.",
        "explanation_en": "Slow upward drift in baseline power with no load change — consistent with aging UPS batteries drawing more float current as they degrade.",
        "action_az": "UPS batareyasının vəziyyət yoxlaması / əvəz edilməsini planlaşdırın.",
        "action_en": "Schedule UPS battery health check / replacement.",
    },
    "hydraulic_leak": {
        "label_az": "Hidravlik sızma / klapan nasazlığı",
        "label_en": "Hydraulic leak / valve fault",
        "explanation_az": "Güc istehlakı planlaşdırılmış yükləmə pəncərələrindən kənarda qeydə alınıb — sızmaya qarşı təzyiq saxlayan hidravlik sistem nasosu lazımsız yerə dövr etdirir.",
        "explanation_en": "Power draw recorded outside scheduled loading windows — a hydraulic system holding pressure against a leak will cycle the pump unnecessarily.",
        "action_az": "Hidravlik xətləri və klapanları sızma üçün yoxlayın.",
        "action_en": "Inspect hydraulic lines and valves for leaks.",
    },
}

# device_id -> (root_cause_id, pattern, start_day)
INJECTED_FAULTS = {
    "D01": ("bearing_wear", "gradual_increase", 70),
    "D03": ("fouled_filter", "step_increase", 90),
    "D04": ("impeller_wear", "gradual_decrease", 60),
    "D05": ("refrigerant_leak", "irregular_spikes", 100),
    "D06": ("schedule_fault", "off_schedule", 80),
    "D07": ("sensor_fault", "off_schedule", 110),
    "D08": ("unexpected_activation", "sustained_on", 130),
    "D09": ("battery_degradation", "gradual_increase", 50),
    "D10": ("hydraulic_leak", "off_schedule", 95),
    # D02 (Export Pump B) left clean as a "healthy" reference unit
}

DUTY_PROFILES = {
    "continuous": lambda hour, rng: 0.85 + 0.1 * np.sin(hour / 3) + rng.normal(0, 0.03),
    "cyclic":     lambda hour, rng: (0.6 if (hour // 4) % 2 == 0 else 0.15) + rng.normal(0, 0.04),
    "scheduled":  lambda hour, rng: (0.75 if 8 <= hour <= 18 else 0.03) + rng.normal(0, 0.03),
    "standby":    lambda hour, rng: 0.02 + rng.normal(0, 0.01),
}


def generate_device_data(seed=7):
    rng = np.random.default_rng(seed)
    dates = [START_DATE + timedelta(days=i) for i in range(DAYS)]
    records = []

    for dev in DEVICES:
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
                    elif pattern == "gradual_decrease":
                        power_kw *= max(0.7, 1 - 0.003 * days_since)
                    elif pattern == "irregular_spikes":
                        if rng.random() < 0.35:
                            power_kw *= rng.uniform(1.6, 2.2)
                    elif pattern == "off_schedule":
                        if rng.random() < 0.3:
                            power_kw = dev["rated_kw"] * rng.uniform(0.4, 0.7)
                    elif pattern == "sustained_on":
                        power_kw = dev["rated_kw"] * rng.uniform(0.75, 0.95)

            records.append({
                "device_id": dev["id"], "date": date,
                "power_kw": round(power_kw, 2),
            })

    return pd.DataFrame(records)


def diagnose_devices(raw_df):
    """Runs calibration+zscore+persistence detection per device, then attaches
    a root-cause diagnosis (from ground truth) when the device is flagged."""
    df = raw_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    results = []

    for dev in DEVICES:
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

    device_status = []
    for dev in DEVICES:
        g = full[full["device_id"] == dev["id"]]
        calib = g[g["day_idx"] < CALIB_DAYS]
        baseline = calib["power_kw"].mean() or 1
        flagged = g[g["is_anomaly"]]
        fault = INJECTED_FAULTS.get(dev["id"])
        status = {
            "id": dev["id"], "name_az": dev["name_az"], "name_en": dev["name_en"], "category": dev["category"],
            "zone": dev["zone"], "zone_az": ZONE_LABELS[dev["zone"]][0], "zone_en": ZONE_LABELS[dev["zone"]][1],
            "rated_kw": dev["rated_kw"],
            "flagged_days": int(len(flagged)),
            "status": "healthy",
            "diagnosis": None,
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
                "baseline_kw": round(baseline, 1),
                "excess_kw_avg": round(excess_kw_avg, 1),
                "est_savings_azn_per_year": est_savings_azn,
                "est_co2_tons_per_year": est_co2_tons,
                "detected_since": (START_DATE + timedelta(days=start_day)).strftime("%Y-%m-%d"),
            }

            # ── Predictive maintenance (yalnız trend olan nasazlıqlar üçün) ──
            threshold_cfg = CRITICAL_THRESHOLDS.get(cause_id)
            if threshold_cfg:
                fault_period = g[g["day_idx"] >= start_day]
                last_day = int(g["day_idx"].max())
                last_value = float(fault_period[fault_period["day_idx"] == last_day]["power_kw"].mean())
                days_elapsed = last_day - start_day
                rate_per_day = (last_value - baseline) / days_elapsed if days_elapsed > 0 else 0

                if threshold_cfg["direction"] == "up":
                    critical_value = baseline * (1 + threshold_cfg["threshold_frac"])
                else:
                    critical_value = baseline * (1 - threshold_cfg["threshold_frac"])

                if rate_per_day != 0:
                    days_to_critical = (critical_value - last_value) / rate_per_day
                else:
                    days_to_critical = None

                if days_to_critical is not None and days_to_critical > 0:
                    trend_pct_per_month = round((rate_per_day * 30 / baseline) * 100, 1)
                    days_int = int(round(days_to_critical))
                    status["diagnosis"]["predictive"] = {
                        "days_remaining": days_int,
                        "trend_pct_per_month": trend_pct_per_month,
                        "note_az": f"Cari trend göstərir ki, kritik aşınma həddinə düzəliş edilməzsə ~{days_int} gün ərzində çatılacaq.",
                        "note_en": f"Current trend suggests critical wear threshold reached in ~{days_int} days if left unaddressed.",
                    }
                else:
                    status["diagnosis"]["predictive"] = {
                        "days_remaining": 0,
                        "trend_pct_per_month": None,
                        "note_az": "Trend artıq kritik həddə çatıb və ya keçib — təcili hal kimi qəbul edin.",
                        "note_en": "Trend has already reached/exceeded the critical threshold — treat as urgent.",
                    }
        device_status.append(status)

    return device_status, full