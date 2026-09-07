"""
GridPulse — Gas Midstream Infrastructure Digital Twin

Bu modul mentor tövsiyəsinə cavabdır: qaz hissəsi enerjinin sadə "surəti"
olmamalıdır. Ona görə burda sayğac-səviyyəli monitorinqdən (gas_pipeline.py)
tam FƏRQLİ bir qat əlavə olunur — qazın öz nəql/paylama infrastrukturu
(sıxılma, requlyasiya, təhlükəsizlik, boru bütövlüyü). Bu cihazların bəziləri
(Odorizasiya Vahidi, Katodik Mühafizə Sistemi) ENERJİ SEKTORUNDA ANALOQU
OLMAYAN, yalnız qaz sənayesinə xas real təhlükəsizlik təcrübələridir:

- Odorizasiya: təbii qaz iysiz olduğu üçün mercaptan əsaslı odorant əlavə
  edilir ki, insanlar sızıntını qoxu ilə aşkarlaya bilsinlər. Odorant
  dozası düşərsə, sızıntı QOXUSUZ olar — bu, çox ciddi, gizli təhlükədir.
- Katodik mühafizə: yeraltı polad boru xətlərini elektrokimyəvi korroziyadan
  qorumaq üçün tətbiq olunan standart sənaye metodudur. Qoruma cərəyanı
  zəifləyərsə, boru illər ərzində korroziyaya uğrayıb sızıntı riski yaradır
  — bu, "yavaş, görünməyən" fəlakətdir.

Metodologiya eynidir (z-score + persistence, devices.py-dəki eyni məntiq) —
fərq YALNIZ NİYƏ və NƏYƏ tətbiq etdiyimizdədir.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta

DAYS = 180
CALIB_DAYS = 45
START_DATE = datetime(2026, 1, 1)

GAS_INFRA_DEVICES = [
    {"id": "GI01", "name_az": "Sıxılma Stansiyası Kompressoru", "name_en": "Compression Station Compressor",
     "unit_az": "kPa", "unit_en": "kPa", "category": "compressor", "zone": "Compression",
     "rated_value": 4500, "duty": "continuous",
     "criticality_az": "Bütün aşağı axının təzyiqi bundan asılıdır", "criticality_en": "All downstream pressure depends on this"},
    {"id": "GI02", "name_az": "Təzyiq Requlyasiya Stansiyası", "name_en": "Pressure Regulation Station",
     "unit_az": "kPa", "unit_en": "kPa", "category": "regulator", "zone": "Regulation",
     "rated_value": 700, "duty": "continuous",
     "criticality_az": "Yüksək təzyiqi paylama şəbəkəsi üçün təhlükəsiz səviyyəyə endirir", "criticality_en": "Steps down high pressure to safe distribution levels"},
    {"id": "GI03", "name_az": "Odorizasiya Vahidi", "name_en": "Odorization Unit",
     "unit_az": "mg/m³", "unit_en": "mg/m³", "category": "odorizer", "zone": "Safety",
     "rated_value": 15, "duty": "continuous",
     "criticality_az": "Sızıntının İYLƏ aşkarlanmasının yeganə yoludur — dozası düşərsə sızıntı sezilmir", "criticality_en": "The only way leaks are detected by SMELL — if dosage drops, leaks go undetected"},
    {"id": "GI04", "name_az": "Fövqəladə Bağlama Klapanı (ESV)", "name_en": "Emergency Shutoff Valve (ESV)",
     "unit_az": "% açıq", "unit_en": "% open", "category": "safety_valve", "zone": "Safety",
     "rated_value": 100, "duty": "standby",
     "criticality_az": "Fəlakət zamanı bütün xətti dərhal bağlamalıdır", "criticality_en": "Must shut off the entire line instantly during an emergency"},
    {"id": "GI05", "name_az": "Ölçmə və Requlyasiya Stansiyası (M&R)", "name_en": "Metering & Regulation Station",
     "unit_az": "m³/saat", "unit_en": "m³/hour", "category": "metering", "zone": "Distribution",
     "rated_value": 1200, "duty": "continuous",
     "criticality_az": "Topdan hesablaşma (custody transfer) dəqiqliyi bundan asılıdır", "criticality_en": "Wholesale billing (custody transfer) accuracy depends on this"},
    {"id": "GI06", "name_az": "Katodik Mühafizə Sistemi", "name_en": "Cathodic Protection System",
     "unit_az": "mA", "unit_en": "mA", "category": "corrosion_protection", "zone": "Pipeline",
     "rated_value": 850, "duty": "continuous",
     "criticality_az": "Yeraltı polad borunu illər üzrə korroziyadan qoruyur — zəifləməsi illərlə hiss olunmaya bilər", "criticality_en": "Protects buried steel pipe from corrosion over years — weakening can go unnoticed for years"},
]

ZONE_LABELS = {
    "Compression": ("Sıxılma", "Compression"),
    "Regulation": ("Requlyasiya", "Regulation"),
    "Safety": ("Təhlükəsizlik", "Safety"),
    "Distribution": ("Paylama", "Distribution"),
    "Pipeline": ("Boru Xətti", "Pipeline"),
}

ROOT_CAUSES_GAS_INFRA = {
    "compressor_surge": {
        "label_az": "Kompressor Sörc (Surge) Riski",
        "label_en": "Compressor Surge Risk",
        "explanation_az": "Çıxış təzyiqində tədricən qeyri-sabitlik artır — bu, kompressor sörcünün (axının geri dönməsi) yaxınlaşdığının klassik əlamətidir. Nəzarətsiz qalarsa, mexaniki zədəyə səbəb ola bilər.",
        "explanation_en": "Output pressure is showing gradually increasing instability — the classic early signature of approaching compressor surge (flow reversal). Left unaddressed, this can cause mechanical damage.",
        "action_az": "Vibrasiya analizi və sörc nəzarət sistemi tənzimlənməsi planlaşdırın.",
        "action_en": "Schedule vibration analysis and surge control system tuning.",
    },
    "regulator_drift": {
        "label_az": "Requlyator Kalibrasiya Sürüşməsi",
        "label_en": "Regulator Calibration Drift",
        "explanation_az": "Çıxış təzyiqi hədəf dəyərdən tədricən aralanır — requlyatorun daxili yayının/diafraqmasının aşınmasına işarədir. Vaxtında düzəldilməzsə, aşağı axında ya çatışmazlıq, ya həddindən artıq təzyiq yarada bilər.",
        "explanation_en": "Output pressure is gradually drifting from setpoint — indicates wear in the regulator's internal spring/diaphragm. Left uncorrected, can cause either downstream undersupply or overpressure.",
        "action_az": "Requlyatoru kalibrləyin və ya diafraqmanı yoxlayın.",
        "action_en": "Recalibrate the regulator or inspect the diaphragm.",
    },
    "odorant_underdose": {
        "label_az": "Odorant Dozasının Azalması — TƏHLÜKƏSİZLİK BÖHRANI",
        "label_en": "Odorant Underdose — SAFETY CRISIS",
        "explanation_az": "Odorant injeksiya səviyyəsi tədricən minimum təhlükəsizlik həddinin altına düşüb. Bu o deməkdir ki, hər hansı gələcək sızıntı İNSANLAR TƏRƏFİNDƏN QOXU İLƏ AŞKARLANMAYACAQ. Bu, sistemdəki ən ciddi tapıntıdır.",
        "explanation_en": "Odorant injection level has gradually fallen below the minimum safety threshold. This means any future leak will NOT be detectable by smell. This is the single most serious finding in the system.",
        "action_az": "TƏCİLİ: odorant pompasını dərhal yoxlayın, çən səviyyəsini təsdiqləyin, təchizatı bərpa edin.",
        "action_en": "URGENT: inspect odorant pump immediately, verify tank level, restore supply.",
    },
    "esv_unexpected_trip": {
        "label_az": "ESV Gözlənilməz Vəziyyət Dəyişikliyi",
        "label_en": "ESV Unexpected State Change",
        "explanation_az": "Fövqəladə bağlama klapanı planlaşdırılmamış vəziyyət dəyişikliyi göstərib — ya səhv siqnal, ya da real təhlükəsizlik hadisəsi ilə bağlı ola bilər. Hər iki halda dərhal təsdiqlənməlidir.",
        "explanation_en": "The emergency shutoff valve shows an unplanned state change — could be a false signal or a real safety event. Either way it must be confirmed immediately.",
        "action_az": "Dərhal fiziki yoxlama — klapan vəziyyətini və idarəetmə siqnalını təsdiqləyin.",
        "action_en": "Immediate physical inspection — confirm valve position and control signal.",
    },
    "flow_measurement_drift": {
        "label_az": "Axın Ölçmə Sürüşməsi",
        "label_en": "Flow Measurement Drift",
        "explanation_az": "Ölçülən axın real istehlakdan fərqlənməyə başlayıb — sayğac mexanizminin köhnəlməsi ilə bağlı ola bilər. Bu, təkcə texniki deyil, MALIYYƏ (topdan hesablaşma dəqiqliyi) məsələsidir.",
        "explanation_en": "Measured flow is beginning to diverge from actual consumption — likely due to meter mechanism wear. This is not just technical but a FINANCIAL (custody transfer accuracy) issue.",
        "action_az": "Sayğacı kalibrləyin və ya əvəz edin; topdan hesablaşma qeydlərini yenidən yoxlayın.",
        "action_en": "Calibrate or replace the meter; review recent custody transfer records.",
    },
    "cathodic_protection_loss": {
        "label_az": "Katodik Mühafizənin Zəifləməsi",
        "label_en": "Cathodic Protection Degradation",
        "explanation_az": "Mühafizə cərəyanı tədricən azalıb — bu, anod itkisini və ya rektifayer nasazlığını göstərə bilər. Nəticə dərhal görünmür, AMMA illər üzrə boru korroziyaya uğrayıb sızıntı riskini artırır.",
        "explanation_en": "Protection current has gradually declined — may indicate anode depletion or rectifier fault. The consequence isn't immediate, but over years the pipe corrodes and leak risk increases.",
        "action_az": "Rektifayeri yoxlayın, boru-torpaq potensialını ölçün, anod vəziyyətini qiymətləndirin.",
        "action_en": "Inspect the rectifier, measure pipe-to-soil potential, assess anode condition.",
    },
}

INJECTED_FAULTS = {
    "GI01": ("compressor_surge", "gradual_increase", 80),
    "GI02": ("regulator_drift", "gradual_decrease", 60),
    "GI03": ("odorant_underdose", "gradual_decrease", 50),
    "GI05": ("flow_measurement_drift", "gradual_increase", 100),
    "GI06": ("cathodic_protection_loss", "gradual_decrease", 40),
    # GI04 (ESV) sağlam istinad vahidi kimi saxlanılır — fövqəladə klapan
    # "sağlam" olmalıdır ki, jüri sual versə "hamısı xarab olmayıb" deyə bilək.
}

# Proqnozlaşdırılan nasazlığa qədər qalan vaxt üçün kritik hədlər (devices.py
# CRITICAL_THRESHOLDS ilə eyni fəlsəfə, gaz-spesifik dəyərlərlə).
CRITICAL_THRESHOLDS_GAS = {
    "compressor_surge": {"direction": "up", "threshold_frac": 0.25},
    "regulator_drift": {"direction": "down", "threshold_frac": 0.35},
    "odorant_underdose": {"direction": "down", "threshold_frac": 0.40},
    "cathodic_protection_loss": {"direction": "down", "threshold_frac": 0.40},
}

DUTY_PROFILES = {
    "continuous": lambda hour, rng: 0.9 + 0.06 * np.sin(hour / 4) + rng.normal(0, 0.015),
    "standby": lambda hour, rng: 1.0 + rng.normal(0, 0.002),  # ESV: sabit "100% bağlı deyil" vəziyyəti
}


def generate_gas_infra_data(seed=21):
    rng = np.random.default_rng(seed)
    dates = [START_DATE + timedelta(days=i) for i in range(DAYS)]
    records = []
    for dev in GAS_INFRA_DEVICES:
        fault = INJECTED_FAULTS.get(dev["id"])
        duty_fn = DUTY_PROFILES[dev["duty"]]
        for day_idx, date in enumerate(dates):
            day_factor = np.mean([duty_fn(h, rng) for h in range(0, 24, 4)])
            value = max(0, dev["rated_value"] * day_factor)
            if fault:
                cause_id, pattern, start_day = fault
                if day_idx >= start_day:
                    days_since = day_idx - start_day
                    if pattern == "gradual_increase":
                        value *= 1 + min(0.30, 0.0035 * days_since)
                    elif pattern == "gradual_decrease":
                        value *= max(0.55, 1 - 0.0035 * days_since)
            records.append({"device_id": dev["id"], "date": date, "reading": round(value, 2)})
    return pd.DataFrame(records)


def diagnose_gas_infra(raw_df):
    """devices.py/critical_infra.py ilə EYNİ metodologiya (z-score+persistence),
    qazın öz infrastruktur cihazlarına tətbiq olunub."""
    df = raw_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    results = []
    for dev in GAS_INFRA_DEVICES:
        g = df[df["device_id"] == dev["id"]].sort_values("date").reset_index(drop=True)
        g["day_idx"] = np.arange(len(g))
        calib = g[g["day_idx"] < CALIB_DAYS]
        baseline = calib["reading"].mean() or 1
        calib_std = calib["reading"].std() or 1
        g["expected_reading"] = baseline
        g["zscore"] = (g["reading"] - baseline) / calib_std
        abs_z = g["zscore"].abs()
        extreme = abs_z > 4.0
        moderate = (abs_z > 2.2) & (~extreme)
        streak = moderate.groupby((~moderate).cumsum()).cumsum()
        g["is_anomaly"] = extreme | (moderate & (streak >= 3))
        g["device_id"] = dev["id"]
        results.append(g)
    full = pd.concat(results, ignore_index=True)

    status_list = []
    for dev in GAS_INFRA_DEVICES:
        g = full[full["device_id"] == dev["id"]]
        calib = g[g["day_idx"] < CALIB_DAYS]
        baseline = calib["reading"].mean() or 1
        flagged = g[g["is_anomaly"]]
        fault = INJECTED_FAULTS.get(dev["id"])
        status = {
            "id": dev["id"], "name_az": dev["name_az"], "name_en": dev["name_en"],
            "category": dev["category"], "zone": dev["zone"],
            "zone_az": ZONE_LABELS[dev["zone"]][0], "zone_en": ZONE_LABELS[dev["zone"]][1],
            "unit_az": dev["unit_az"], "unit_en": dev["unit_en"], "rated_value": dev["rated_value"],
            "criticality_az": dev["criticality_az"], "criticality_en": dev["criticality_en"],
            "flagged_days": int(len(flagged)), "status": "healthy", "diagnosis": None,
        }
        if len(flagged) >= 3 and fault:
            cause_id, pattern, start_day = fault
            cause = ROOT_CAUSES_GAS_INFRA[cause_id]
            avg_z = flagged["zscore"].abs().mean()
            confidence = int(min(95, 100 - 55 / (1 + avg_z / 3.0)))
            severity = "critical" if cause_id in ("odorant_underdose", "esv_unexpected_trip") else "high"

            status["status"] = "flagged"
            status["diagnosis"] = {
                "cause_id": cause_id, "severity": severity,
                "label_az": cause["label_az"], "label_en": cause["label_en"],
                "explanation_az": cause["explanation_az"], "explanation_en": cause["explanation_en"],
                "recommended_action_az": cause["action_az"], "recommended_action_en": cause["action_en"],
                "confidence_pct": confidence,
                "detected_since": (START_DATE + timedelta(days=start_day)).strftime("%Y-%m-%d"),
            }
            threshold_cfg = CRITICAL_THRESHOLDS_GAS.get(cause_id)
            if threshold_cfg:
                fault_period = g[g["day_idx"] >= start_day]
                last_day = int(g["day_idx"].max())
                last_value = float(fault_period[fault_period["day_idx"] == last_day]["reading"].mean())
                days_elapsed = last_day - start_day
                rate_per_day = (last_value - baseline) / days_elapsed if days_elapsed > 0 else 0
                critical_value = baseline * (1 + threshold_cfg["threshold_frac"]) if threshold_cfg["direction"] == "up" else baseline * (1 - threshold_cfg["threshold_frac"])
                days_to_critical = (critical_value - last_value) / rate_per_day if rate_per_day != 0 else None
                if days_to_critical is not None and days_to_critical > 0:
                    days_int = int(round(days_to_critical))
                    status["diagnosis"]["predictive"] = {
                        "days_remaining": days_int,
                        "note_az": f"~{days_int} gün ərzində kritik həddə çatacaq.",
                        "note_en": f"~{days_int} days until critical threshold.",
                    }
                else:
                    status["diagnosis"]["predictive"] = {
                        "days_remaining": 0,
                        "note_az": "Trend artıq kritik həddi keçib — təcili hal kimi qəbul edin.",
                        "note_en": "Trend has already passed the critical threshold — treat as urgent.",
                    }
        status_list.append(status)
    return status_list, full


# ─── Qaz Auto-Dispatch — öz təhlükəsizlik komandaları ilə ──────────────────
# dispatch.py-dəki eyni fəlsəfə: bu, real SMS/zəng GÖNDƏRMİR, daxili iş əmri
# növbəsi yaradır. Qaz üçün fərqli mühəndis rolları var (elektrik/mexanik
# yox, qaz təhlükəsizlik/boru bütövlüyü ixtisası).
GAS_ENGINEERS = {
    "safety_team": {"name": "Rəşad Ə.", "role_az": "Qaz Təhlükəsizlik Komandası", "role_en": "Gas Safety Team", "zones": ["Safety"]},
    "mechanical": {"name": "Tural H.", "role_az": "Sıxılma/Requlyasiya Texniki", "role_en": "Compression/Regulation Technician", "zones": ["Compression", "Regulation"]},
    "metering": {"name": "Nərmin S.", "role_az": "Ölçmə və Hesablaşma Mühəndisi", "role_en": "Metering & Custody Transfer Engineer", "zones": ["Distribution"]},
    "pipeline_integrity": {"name": "Vüsal M.", "role_az": "Boru Bütövlüyü Mühəndisi", "role_en": "Pipeline Integrity Engineer", "zones": ["Pipeline"]},
    "field_audit": {"name": "Sahə Audit Komandası", "role_az": "Qaz Sayğac Auditi", "role_en": "Gas Meter Audit Team", "zones": []},
}

GAS_PRIORITY_ORDER = {"URGENT": 0, "HIGH": 1, "MEDIUM": 2}


def _assign_gas_engineer(zone):
    for eng in GAS_ENGINEERS.values():
        if zone in eng["zones"]:
            return eng
    return GAS_ENGINEERS["field_audit"]


def generate_gas_work_orders(gas_infra_status, gas_meter_diagnoses):
    orders = []
    counter = 1

    for d in gas_infra_status:
        if d["status"] != "flagged":
            continue
        diag = d["diagnosis"]
        priority = "URGENT" if diag["severity"] == "critical" else "HIGH"
        eng = _assign_gas_engineer(d["zone"])
        orders.append({
            "ticket_id": f"GWO-2026-{counter:04d}", "target_type": "gas_infra", "target_id": d["id"],
            "target_name_az": d["name_az"], "target_name_en": d["name_en"],
            "zone_az": d["zone_az"], "zone_en": d["zone_en"], "priority": priority,
            "assigned_engineer": eng["name"], "assigned_role_az": eng["role_az"], "assigned_role_en": eng["role_en"],
            "diagnosis_label_az": diag["label_az"], "diagnosis_label_en": diag["label_en"],
            "recommended_action_az": diag["recommended_action_az"], "recommended_action_en": diag["recommended_action_en"],
            "confidence_pct": diag["confidence_pct"],
        })
        counter += 1

    for m in gas_meter_diagnoses:
        if m["type"] not in ("leak_suspected", "overpressure_event"):
            continue
        eng = GAS_ENGINEERS["field_audit"]
        orders.append({
            "ticket_id": f"GWO-2026-{counter:04d}", "target_type": "gas_meter", "target_id": m["meter_id"],
            "target_name_az": f"Sayğac {m['meter_id']}", "target_name_en": f"Meter {m['meter_id']}",
            "zone_az": m["zone"], "zone_en": m["zone"], "priority": "URGENT",
            "assigned_engineer": eng["name"], "assigned_role_az": eng["role_az"], "assigned_role_en": eng["role_en"],
            "diagnosis_label_az": m["label_az"], "diagnosis_label_en": m["label_en"],
            "recommended_action_az": m["recommended_action_az"], "recommended_action_en": m["recommended_action_en"],
            "confidence_pct": None,
        })
        counter += 1

    return sorted(orders, key=lambda o: GAS_PRIORITY_ORDER[o["priority"]])