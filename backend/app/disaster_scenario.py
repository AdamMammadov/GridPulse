"""
GridPulse — Disaster / Mass-Event Detection (Cross-Utility)

Mentor tövsiyəsi (Həftə 3, Ssenari 1): "Fəlakət şəraitində (zəlzələ, subasma)
GridPulse nə işə yarayır?"

Fərqli konseptual sual: adi vaxt bir sayğacın nasaz olması FƏRDİ hadisədir
(bir texnikin öz işi). Zəlzələ/partlayış zamanı isə BİR ZONADA ONLARLA
sayğac EYNİ GÜN eyni anda "nasaz" görünür — bu, statistik olaraq təsadüfi
fərdi nasazlıqların üst-üstə düşməsi ola bilməz (ehtimalı həddindən aşağıdır),
İNFRASTRUKTUR ZƏDƏSİNİN İMZASIDIR.

Niyə bu vacibdir: mövcud sistemimiz (dispatch.py) hər bayraqlanan sayğac üçün
AYRI iş əmri yaradır. Fəlakət zamanı bu, 30+ təcili bilet yaradıb sahə
komandasını iflic edərdi ("alert fatigue"). Bu modul əvəzinə BİR konsolidə
edilmiş "ehtimal olunan infrastruktur zədəsi" xəbərdarlığı yaradır — həm
enerji, HƏM DƏ qaz sensorlarını birləşdirərək (əgər hər ikisi eyni zonada,
eyni gündə kütləvi bayraqlanırsa, bu, ikiqat təsdiqdir).

Dürüstlük qeydi: Bu, sadə statistik "kütləvi hadisə" aşkarlanmasıdır — real
qraf-əsaslı AI marşrutlaşdırma (GNN/DRL, AC power flow optimallaşdırması)
DEYİL. Mentor bu istiqaməti (graph analysis, elektrik şəbəkəsinin e-mobillik
üçün yenidən marşrutlaşdırılması) qeyd etdi — bu, real və maraqlı tədqiqat
istiqamətidir, amma qalan vaxtda tam qurmaq mümkün deyil. Bu modul onun
YERİNƏ deyil, ONA APARAN İLK ADDIM kimi düşünülüb: zona-qraf strukturu və
kütləvi-hadisə aşkarlanması artıq mövcuddur — gələcəkdə buna GNN-əsaslı
marşrutlaşdırma qatıla bilər (bax roadmap qeydi API cavabında).
"""

import numpy as np
import pandas as pd

ALL_ZONES = ["Zona A", "Zona B", "Zona C", "Zona D", "Zona E", "Zona F"]

# Real dispatch/gas_infra ENGINEERS obyekt-zonalarına (Pump Station, Compression
# və s.) bağlıdır — sayğac-zonaları (Zona A-F) fərqli miqyasdır. Fəlakət kimi
# YÜKSƏK səviyyəli hadisələr üçün ayrıca, xüsusiləşmiş fövqəladə hallar
# komandası daha realistikdir (adi sayğac auditi komandası yox).
EMERGENCY_RESPONSE_TEAMS = {
    "energy": {
        "name_az": "SOCAR Enerji Fövqəladə Qrupu", "name_en": "SOCAR Energy Emergency Unit",
        "role_az": "Xətt Bərpası və Təhlükəsizlik Yoxlaması", "role_en": "Line Restoration & Safety Inspection",
        "eta_minutes": 45,
    },
    "gas": {
        "name_az": "Qaz Fövqəladə Təhlükəsizlik Qrupu", "name_en": "Gas Emergency Safety Unit",
        "role_az": "Xətt Bağlanması və Sızıntı Yoxlaması", "role_en": "Line Shutoff & Leak Inspection",
        "eta_minutes": 30,
    },
    "municipal": {
        "name_az": "Bələdiyyə Fövqəladə Hallar Xidməti", "name_en": "Municipal Emergency Services",
        "role_az": "Ümumi Koordinasiya və Təxliyə", "role_en": "Overall Coordination & Evacuation",
        "eta_minutes": 20,
    },
}


def inject_disaster_event(raw_df, value_col, zone_name, day_index=160,
                           affected_fraction=0.7, recovery_days=5, seed=777):
    """Bir zonada, bir gündə kütləvi infrastruktur zədəsini simulyasiya edir:
    seçilmiş zonadakı sayğacların böyük əksəriyyəti EYNİ GÜN demək olar sıfıra
    enir (xətlərin kəsilməsi/boruların zədələnməsi), sonra bir neçə gün
    ərzində tədricən bərpa olur (təmir işləri)."""
    rng = np.random.default_rng(seed)
    df = raw_df.copy()
    df["date"] = pd.to_datetime(df["date"])

    zone_meters = df[df["zone"] == zone_name]["meter_id"].unique()
    n_affected = max(1, int(len(zone_meters) * affected_fraction))
    affected = rng.choice(zone_meters, size=n_affected, replace=False)

    all_dates = sorted(df["date"].unique())
    disaster_date = all_dates[day_index]

    for meter in affected:
        for offset in range(recovery_days):
            target_date = disaster_date + pd.Timedelta(days=offset)
            recovery_frac = min(1.0, 0.05 + 0.95 * (offset / max(1, recovery_days - 1)))
            row_mask = (df["meter_id"] == meter) & (df["date"] == target_date)
            df.loc[row_mask, value_col] = df.loc[row_mask, value_col] * recovery_frac

    return df, {
        "zone": zone_name,
        "date": disaster_date.strftime("%Y-%m-%d"),
        "affected_meters": list(affected),
        "affected_count": len(affected),
        "total_zone_meters": len(zone_meters),
    }


def zone_daily_flagged_series(result_df, zone_name, day_index, window=20):
    """Zona üçün gündəlik bayraqlı sayğac sayının zaman sırası (fəlakət
    gününün ətrafında) — bu, 'kütləvi hadisə statistikası'nı bir rəqəm kimi
    deyil, HƏQİQİ görünən bir spike kimi göstərmək üçündür."""
    zdf = result_df[result_df["zone"] == zone_name]
    daily = zdf.groupby("day_idx")["predicted_anomaly"].sum().reindex(
        range(max(0, day_index - window), min(int(result_df["day_idx"].max()), day_index + window) + 1), fill_value=0
    )
    dates = zdf.drop_duplicates("day_idx").set_index("day_idx")["date"]
    out = []
    for di, count in daily.items():
        date_val = dates.get(di)
        date_str = date_val.strftime("%Y-%m-%d") if date_val is not None and hasattr(date_val, "strftime") else None
        out.append({"day_offset": di - day_index, "date": date_str, "flagged_count": int(count)})
    return out


def zone_recovery_curve(raw_df, value_col, zone_name, affected_meters, day_index, days_after=10):
    """Yalnız TƏSİRLƏNMİŞ sayğacların orta göstəricisini fəlakətdən sonrakı
    günlər üzrə izləyir — xidmətin tədricən necə bərpa olunduğunu göstərən
    real (sintetik inject edilmiş, amma hesablanmış) əyri."""
    df = raw_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    all_dates = sorted(df["date"].unique())
    sub = df[(df["meter_id"].isin(affected_meters)) & (df["zone"] == zone_name)]
    out = []
    for offset in range(-3, days_after + 1):
        di = day_index + offset
        if di < 0 or di >= len(all_dates):
            continue
        target_date = all_dates[di]
        avg_val = sub[sub["date"] == target_date][value_col].mean()
        out.append({"day_offset": offset, "avg_value": round(float(avg_val), 2) if avg_val == avg_val else 0})
    return out


def detect_cascade_risk(result_df, epicenter_zone, day_index, watch_days=7, elevation_threshold=1.8):
    """Epicenter-dən BAŞQA bütün zonalarda fəlakətdən sonrakı günlərdə
    anomaliya nisbətinin adi səviyyəyə nisbətən yüksəlib-yüksəlmədiyini
    yoxlayır — bu, kütləvi-hadisə həddinə çatmasa da, yayılma riskinin erkən
    xəbərdarlığıdır (şəbəkə interkoneksiyası ehtimalı)."""
    results = []
    for zone in ALL_ZONES:
        if zone == epicenter_zone:
            continue
        zdf = result_df[result_df["zone"] == zone]
        if zdf.empty:
            continue
        before = zdf[zdf["day_idx"] < day_index]["predicted_anomaly"].mean()
        after_window = zdf[(zdf["day_idx"] >= day_index) & (zdf["day_idx"] < day_index + watch_days)]
        after = after_window["predicted_anomaly"].mean()
        ratio = (after / before) if before and before > 0 else (float("inf") if after > 0 else 1.0)
        is_elevated = ratio >= elevation_threshold and after > 0
        results.append({
            "zone": zone,
            "baseline_rate_pct": round(before * 100, 2),
            "post_disaster_rate_pct": round(after * 100, 2),
            "elevation_ratio": round(min(ratio, 9.99), 2) if ratio != float("inf") else 9.99,
            "cascade_watch": bool(is_elevated),
        })
    return sorted(results, key=lambda r: -r["elevation_ratio"])


def detect_mass_events(result_df, min_absolute=2, min_fraction=0.4, z_threshold=2.5):
    """Fərdi sayğac nasazlığından fərqli olaraq, eyni gündə bir zonada
    qeyri-adi sayda sayğacın eyni vaxtda anomal olmasını axtarır. Zonalar
    ölçücə çox fərqli ola bildiyi üçün (3-11 sayğac), sabit mütləq say
    əvəzinə NİSBİ hədd istifadə olunur: zonanın sayğaclarının ən azı
    min_fraction (default 40%) hissəsi EYNİ GÜN bayraqlanmalı, VƏ bu, zonanın
    öz tarixi gündəlik bayraq sayı paylanmasına nisbətən statistik outlier
    olmalıdır (z_threshold)."""
    flagged = result_df[result_df["predicted_anomaly"]].copy()
    if flagged.empty:
        return []
    zone_totals = result_df.groupby("zone")["meter_id"].nunique()
    daily_counts = flagged.groupby(["zone", "date"]).size().reset_index(name="flagged_count")

    events = []
    for zone, zg in daily_counts.groupby("zone"):
        total_in_zone = int(zone_totals.get(zone, 0)) or 1
        mean_c = zg["flagged_count"].mean()
        std_c = zg["flagged_count"].std() or 1
        for _, row in zg.iterrows():
            z = (row["flagged_count"] - mean_c) / std_c
            fraction = row["flagged_count"] / total_in_zone
            if row["flagged_count"] >= min_absolute and fraction >= min_fraction and z > z_threshold:
                d = row["date"]
                events.append({
                    "zone": zone,
                    "date": d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d),
                    "affected_meter_count": int(row["flagged_count"]),
                    "zone_meter_count": total_in_zone,
                    "affected_fraction_pct": round(fraction * 100, 1),
                    "z_score_of_event": round(float(z), 1),
                })
    return sorted(events, key=lambda e: -e["affected_fraction_pct"])


def run_disaster_scenario(zone_name="Zona D", day_index=160):
    """Tam ssenari: enerji VƏ qaz datasına EYNİ zona/gündə fəlakət inject
    edir, hər ikisini müstəqil aşkarlayır, sonra kütləvi-hadisə aşkarlanmasını
    tətbiq edir. "Without" / "with" müqayisəsi göstərir ki, konsolidasiya
    olmadan sistem neçə ayrı təcili bilet yaradardı."""
    from app.pipeline import generate_synthetic_data, detect_anomalies
    from app.gas_pipeline import generate_gas_data, detect_gas_anomalies

    energy_raw = generate_synthetic_data()
    energy_disaster_raw, energy_meta = inject_disaster_event(
        energy_raw, "consumption_kwh", zone_name, day_index
    )
    energy_result = detect_anomalies(energy_disaster_raw)

    gas_raw = generate_gas_data()
    gas_disaster_raw, gas_meta = inject_disaster_event(
        gas_raw, "consumption_m3", zone_name, day_index
    )
    gas_result = detect_gas_anomalies(gas_disaster_raw)

    energy_events = detect_mass_events(energy_result)
    gas_events = detect_mass_events(gas_result)

    energy_hit = next((e for e in energy_events if e["zone"] == zone_name and e["date"] == energy_meta["date"]), None)
    gas_hit = next((e for e in gas_events if e["zone"] == zone_name and e["date"] == gas_meta["date"]), None)

    without_consolidation_tickets = (energy_hit["affected_meter_count"] if energy_hit else 0) + \
                                     (gas_hit["affected_meter_count"] if gas_hit else 0)

    dual_confirmed = bool(energy_hit and gas_hit)

    energy_series = zone_daily_flagged_series(energy_result, zone_name, day_index)
    gas_series = zone_daily_flagged_series(gas_result, zone_name, day_index)

    energy_recovery = zone_recovery_curve(energy_disaster_raw, "consumption_kwh", zone_name, energy_meta["affected_meters"], day_index)
    gas_recovery = zone_recovery_curve(gas_disaster_raw, "consumption_m3", zone_name, gas_meta["affected_meters"], day_index)

    cascade_energy = detect_cascade_risk(energy_result, zone_name, day_index)
    cascade_gas = detect_cascade_risk(gas_result, zone_name, day_index)

    return {
        "scenario": {
            "zone": zone_name,
            "date": energy_meta["date"],
            "energy_meters_affected": energy_meta["affected_count"],
            "energy_meters_total_in_zone": energy_meta["total_zone_meters"],
            "gas_meters_affected": gas_meta["affected_count"],
            "gas_meters_total_in_zone": gas_meta["total_zone_meters"],
        },
        "detection": {
            "energy_mass_event_detected": energy_hit is not None,
            "energy_event": energy_hit,
            "gas_mass_event_detected": gas_hit is not None,
            "gas_event": gas_hit,
            "dual_utility_confirmed": dual_confirmed,
        },
        "without_consolidation": {
            "individual_tickets_created": without_consolidation_tickets,
            "note_az": f"Konsolidasiya olmadan sistem {without_consolidation_tickets} ayrı TƏCİLİ iş əmri yaradardı — sahə komandası üçün 'alert fatigue'.",
            "note_en": f"Without consolidation, the system would create {without_consolidation_tickets} separate URGENT work orders — alert fatigue for the field team.",
        },
        "with_consolidation": {
            "consolidated_alerts": 1 if (energy_hit or gas_hit) else 0,
            "note_az": (
                f"Konsolidasiya ilə: BİR xəbərdarlıq — 'Zona {zone_name.split()[-1]}: Ehtimal olunan infrastruktur zədəsi"
                + (" (enerji VƏ qaz ikiqat təsdiqlədi)'" if dual_confirmed else "'")
                + " — fərdi audit yox, dərhal fövqəladə hallar protokolu işə düşür."
            ),
            "note_en": (
                f"With consolidation: ONE alert — 'Zone {zone_name.split()[-1]}: Suspected infrastructure damage"
                + (" (confirmed by BOTH energy and gas)'" if dual_confirmed else "'")
                + " — triggers emergency protocol immediately instead of individual audits."
            ),
        },
        "timeline": {
            "energy_series": energy_series,
            "gas_series": gas_series,
        },
        "recovery": {
            "energy_curve": energy_recovery,
            "gas_curve": gas_recovery,
        },
        "cascade_risk": {
            "energy": cascade_energy,
            "gas": cascade_gas,
            "any_watch": any(z["cascade_watch"] for z in cascade_energy + cascade_gas),
        },
        "emergency_teams": EMERGENCY_RESPONSE_TEAMS,
        "detection_speed_comparison": {
            "traditional_days": 90,
            "traditional_method_az": "Aylıq/rüblük əl auditi və ya müştəri şikayətləri ilə aşkarlanma",
            "traditional_method_en": "Detected via monthly/quarterly manual audits or customer complaints",
            "gridpulse_hours": 24,
            "gridpulse_method_az": "Gündəlik avtomatik toplu analiz ilə eyni gün aşkarlanma",
            "gridpulse_method_en": "Detected same-day via daily automated batch analysis",
        },
        "roadmap_note_az": (
            "Bu, sadə statistik kütləvi-hadisə aşkarlanmasıdır. Mentorun qeyd etdiyi qraf-əsaslı "
            "AI marşrutlaşdırma (GNN/DRL, real-vaxt şəbəkə yenidən konfiqurasiyası) real və dəyərli "
            "gələcək istiqamətdir — bizim zona-qraf strukturumuz artıq buna həndəsi cəhətdən uyğundur, "
            "amma real AC power flow optimallaşdırması qalan vaxtda qurula bilməzdi."
        ),
        "roadmap_note_en": (
            "This is simple statistical mass-event detection. The graph-based AI routing the mentor "
            "raised (GNN/DRL, real-time network reconfiguration) is a real and valuable future "
            "direction — our zone-graph structure is already structurally compatible, but real AC "
            "power flow optimization wasn't buildable in the remaining time."
        ),
    }