from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pydantic import BaseModel

from app.copilot import ask_copilot
from app.dispatch import generate_work_orders
from app.pipeline import generate_synthetic_data, detect_anomalies, score_zone_risk, forecast_demand, diagnose_meters, benchmark_scaling, estimate_meter_losses, compute_roi_summary, compute_threshold_sweep
from app.devices import generate_device_data, diagnose_devices, DEVICES
from app.real_data_validation import run_real_data_validation
from app.real_data_validation_v2 import run_recent_validation, run_az_calibrated_validation
from app.reliability_impact import estimate_reliability_impact
from app.backup import save_snapshot, load_snapshot, snapshot_status
from app.gas_pipeline import (
    generate_gas_data, detect_gas_anomalies, score_gas_zone_risk,
    diagnose_gas_meters, estimate_gas_losses, compute_gas_summary,
)
from app.critical_infra import generate_critical_infra_data, diagnose_critical_infra
from app.disaster_scenario import run_disaster_scenario, ALL_ZONES as DISASTER_ZONES
from app.gas_infra import generate_gas_infra_data, diagnose_gas_infra, generate_gas_work_orders

app = FastAPI(title="GridPulse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_state = {}


@app.on_event("startup")
def compute_pipeline():
    # ── Backup/Recovery: əvvəlcə son snapshot-u yükləməyə cəhd et ──────────
    # Uğurlu olsa, bütün ağır hesablamaları (fəlakət ssenarisi ~13san və s.)
    # TƏKRAR ETMİRİK — bu, "Etibarlılıq" səhifəsindəki BCP boşluğunu bağlayır.
    restored = load_snapshot()
    if restored is not None:
        _state.update(restored)
        print(f"[backup] Snapshot yükləndi — {len(restored)} açar bərpa olundu, tam yenidən hesablama ATLANDI")
        return

    raw_df = generate_synthetic_data()
    result_df = detect_anomalies(raw_df, n_jobs=-1)  # bütün nüvələrdə paralel
    _state["raw_df"] = raw_df
    _state["result_df"] = result_df
    _state["zone_risk"] = score_zone_risk(result_df)
    _state["meter_diagnoses"] = diagnose_meters(result_df)
    _state["forecast"] = forecast_demand(raw_df)
    device_raw = generate_device_data()
    device_status, device_full = diagnose_devices(device_raw)
    _state["device_status"] = device_status
    _state["device_full"] = device_full
    _state["work_orders"] = generate_work_orders(_state["device_status"], _state["meter_diagnoses"])
    _state["scaling"] = benchmark_scaling()
    meter_losses = estimate_meter_losses(result_df, _state["meter_diagnoses"])
    _state["roi"] = compute_roi_summary(_state["device_status"], meter_losses)
    _state["threshold_sweep"] = compute_threshold_sweep(result_df)

    # ── Qaz sızıntısı monitorinqi (mentor tövsiyəsi, Həftə 3) ──────────────
    gas_raw = generate_gas_data()
    gas_result = detect_gas_anomalies(gas_raw)
    _state["gas_raw_df"] = gas_raw
    _state["gas_result_df"] = gas_result
    _state["gas_zone_risk"] = score_gas_zone_risk(gas_result)
    _state["gas_diagnoses"] = diagnose_gas_meters(gas_result)
    gas_losses = estimate_gas_losses(gas_result, _state["gas_diagnoses"])
    _state["gas_summary"] = compute_gas_summary(gas_result, _state["gas_diagnoses"], gas_losses)
    _state["gas_forecast"] = forecast_demand(gas_raw, value_col="consumption_m3")

    gas_infra_raw = generate_gas_infra_data()
    _state["gas_infra_status"], _state["gas_infra_full"] = diagnose_gas_infra(gas_infra_raw)
    _state["gas_work_orders"] = generate_gas_work_orders(_state["gas_infra_status"], _state["gas_diagnoses"])

    # ── Kritik infrastruktur (mentor tövsiyəsi, Ssenari 2) ─────────────────
    critical_raw = generate_critical_infra_data()
    _state["critical_status"], _state["critical_full"] = diagnose_critical_infra(critical_raw)

    # ── Backup: tam hesablama bitdi, snapshot yaz ki, növbəti restart bunu
    # təkrar etməsin ────────────────────────────────────────────────────────
    backup_result = save_snapshot(dict(_state))
    if backup_result["success"]:
        print(f"[backup] Snapshot yazıldı ({backup_result['size_bytes']} bayt)")
    else:
        print(f"[backup] XƏBƏRDARLIQ: snapshot yazıla bilmədi ({backup_result['error']}) — sistem normal işləyir, sadəcə backup yoxdur")


@app.get("/api/health")
def health():
    return {"status": "ok", "meters_loaded": int(_state["result_df"]["meter_id"].nunique())}


@app.get("/api/admin/backup-status")
def backup_status():
    """BCP boşluğunu bağlayan endpoint — 'Etibarlılıq' səhifəsi bunu göstərir.
    Artıq 'hələ qurulmayıb' deyil, canlı status."""
    return snapshot_status()


@app.post("/api/admin/backup-now")
def backup_now():
    """Manual backup tetikləyici (məs. Demo Day-dən əvvəl)."""
    result = save_snapshot(dict(_state))
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/api/meters")
def list_meters():
    df = _state["result_df"]
    meters = df.groupby("meter_id").agg(
        zone=("zone", "first"),
        meter_type=("meter_type", "first"),
        anomaly_days=("predicted_anomaly", "sum"),
    ).reset_index()
    return meters.to_dict(orient="records")


@app.get("/api/meters/{meter_id}/history")
def meter_history(meter_id: str):
    df = _state["result_df"]
    sub = df[df["meter_id"] == meter_id].sort_values("date")
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"Meter {meter_id} not found")
    return {
        "meter_id": meter_id,
        "zone": sub["zone"].iloc[0],
        "history": [
            {
                "date": row["date"].strftime("%Y-%m-%d"),
                "consumption_kwh": row["consumption_kwh"],
                "expected_kwh": round(row["expected"], 2),
                "zscore": round(row["zscore"], 2),
                "is_anomaly": bool(row["predicted_anomaly"]),
            }
            for _, row in sub.iterrows()
        ],
    }


@app.get("/api/anomalies")
def list_anomalies(days: int = 30):
    df = _state["result_df"]
    max_day = df["day_idx"].max()
    recent = df[(df["day_idx"] > max_day - days) & (df["predicted_anomaly"])]
    return recent.sort_values("date", ascending=False)[
        ["meter_id", "zone", "date", "consumption_kwh", "expected", "zscore"]
    ].assign(date=lambda d: d["date"].dt.strftime("%Y-%m-%d")).to_dict(orient="records")


@app.get("/api/zones/risk")
def zones_risk():
    return _state["zone_risk"]


@app.get("/api/meters/security-alerts")
def meters_security_alerts():
    return _state["meter_diagnoses"]


@app.get("/api/forecast")
def forecast():
    return _state["forecast"]


@app.get("/api/summary")
def summary():
    df = _state["result_df"]
    recall_proxy = round(
        (df[df["true_label"] == "anomaly"]["predicted_anomaly"].mean()) * 100, 1
    )
    return {
        "meters_monitored": int(df["meter_id"].nunique()),
        "days_of_data": int(df["day_idx"].max() + 1),
        "total_flagged_events": int(df["predicted_anomaly"].sum()),
        "recall_pct": recall_proxy,
        "zone_risk": _state["zone_risk"],
    }


@app.get("/api/devices")
def list_devices():
    return _state["device_status"]


@app.get("/api/devices/{device_id}")
def device_detail(device_id: str):
    match = [d for d in _state["device_status"] if d["id"] == device_id]
    if not match:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")

    df = _state["device_full"]
    sub = df[df["device_id"] == device_id].sort_values("date")
    history = [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "power_kw": row["power_kw"],
            "expected_kw": round(row["expected_kw"], 1),
            "is_anomaly": bool(row["is_anomaly"]),
        }
        for _, row in sub.iterrows()
    ]
    return {**match[0], "history": history}


class CopilotQuestion(BaseModel):
    question: str
    lang: str = "az"

@app.post("/api/copilot/ask")
def copilot_ask(payload: CopilotQuestion):
    return ask_copilot(
        payload.question,
        _state["device_status"],
        _state["meter_diagnoses"],
        _state["zone_risk"],
        lang=payload.lang,
    )


@app.get("/api/dispatch/queue")
def dispatch_queue():
    return _state["work_orders"]


@app.get("/api/scaling")
def scaling():
    return _state["scaling"]


@app.get("/api/roi")
def roi():
    return _state["roi"]


@app.get("/api/threshold-sweep")
def threshold_sweep():
    return _state["threshold_sweep"]


@app.get("/api/real-data-validation")
def real_data_validation_endpoint():
    """Lazy: ilk çağırışda real dataset yüklənir (~26MB, GitHub-dan) və
    hesablanır (~5-15san), nəticə yaddaşda keşlənir. Sonrakı çağırışlar
    anında qayıdır. Demo-dan əvvəl bir dəfə "isindirmək" tövsiyə olunur."""
    if "real_data_validation" not in _state:
        try:
            _state["real_data_validation"] = run_real_data_validation()
            save_snapshot(dict(_state))
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Real data validation unavailable: {e}")
    return _state["real_data_validation"]


@app.get("/api/real-data-validation/recent")
def real_data_validation_recent_endpoint():
    """2020-2024 EIA datası (19 real PJM alt-regionu) — mentor tövsiyəsi:
    2002-2018 köhnə idi, daha yeni data ilə sınayın."""
    if "real_data_validation_recent" not in _state:
        try:
            _state["real_data_validation_recent"] = run_recent_validation()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Recent validation unavailable: {e}")
    return _state["real_data_validation_recent"]


@app.get("/api/real-data-validation/azerbaijan")
def real_data_validation_az_endpoint():
    """AZ-kalibrlənmiş sintetik ssenari — real AZ meter datası mövcud
    olmadığı üçün, real Bakı iqlim normaları ilə kalibrlənib. Aydın
    etiketlənib: bu, real data DEYİL."""
    if "real_data_validation_az" not in _state:
        _state["real_data_validation_az"] = run_az_calibrated_validation()
    return _state["real_data_validation_az"]


@app.get("/api/reliability-impact")
def reliability_impact_endpoint():
    """SAIDI/SAIFI-yə tərcümə — GridPulse-un ölçülmüş imkanlarını (disaster
    scenario konsolidasiyası, predictive maintenance) standart utility
    etibarlılıq dilinə çevirir. Metodologiya nümayişidir, audit deyil."""
    return estimate_reliability_impact()


# ═══ QAZ SIZINTISI MONİTORİNQİ (mentor tövsiyəsi, Həftə 3) ═════════════════

@app.get("/api/gas/summary")
def gas_summary():
    return _state["gas_summary"]


@app.get("/api/gas/zones/risk")
def gas_zones_risk():
    return _state["gas_zone_risk"]


@app.get("/api/gas/meters")
def gas_list_meters():
    df = _state["gas_result_df"]
    meters = df.groupby("meter_id").agg(
        zone=("zone", "first"), meter_type=("meter_type", "first"),
        anomaly_days=("predicted_anomaly", "sum"),
    ).reset_index()
    return meters.to_dict(orient="records")


@app.get("/api/gas/meters/{meter_id}/history")
def gas_meter_history(meter_id: str):
    df = _state["gas_result_df"]
    sub = df[df["meter_id"] == meter_id].sort_values("date")
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"Gas meter {meter_id} not found")
    return {
        "meter_id": meter_id, "zone": sub["zone"].iloc[0],
        "history": [
            {
                "date": row["date"].strftime("%Y-%m-%d"),
                "consumption_m3": row["consumption_m3"],
                "expected_m3": round(row["expected"], 2),
                "zscore": round(row["zscore"], 2),
                "is_anomaly": bool(row["predicted_anomaly"]),
            }
            for _, row in sub.iterrows()
        ],
    }


@app.get("/api/gas/anomalies")
def gas_list_anomalies(days: int = 30):
    df = _state["gas_result_df"]
    max_day = df["day_idx"].max()
    recent = df[(df["day_idx"] > max_day - days) & (df["predicted_anomaly"])]
    return recent.sort_values("date", ascending=False)[
        ["meter_id", "zone", "date", "consumption_m3", "expected", "zscore"]
    ].assign(date=lambda d: d["date"].dt.strftime("%Y-%m-%d")).to_dict(orient="records")


@app.get("/api/gas/security-alerts")
def gas_security_alerts():
    return _state["gas_diagnoses"]


@app.get("/api/gas/forecast")
def gas_forecast():
    return _state["gas_forecast"]


@app.get("/api/gas/infra/devices")
def gas_infra_devices():
    return _state["gas_infra_status"]


@app.get("/api/gas/infra/devices/{device_id}")
def gas_infra_device_detail(device_id: str):
    match = [d for d in _state["gas_infra_status"] if d["id"] == device_id]
    if not match:
        raise HTTPException(status_code=404, detail=f"Gas infra device {device_id} not found")
    df = _state["gas_infra_full"]
    sub = df[df["device_id"] == device_id].sort_values("date")
    history = [
        {
            "date": row["date"].strftime("%Y-%m-%d"), "reading": row["reading"],
            "expected_reading": round(row["expected_reading"], 1), "is_anomaly": bool(row["is_anomaly"]),
        }
        for _, row in sub.iterrows()
    ]
    return {**match[0], "history": history}


@app.get("/api/gas/dispatch/queue")
def gas_dispatch_queue():
    return _state["gas_work_orders"]


# ═══ KRİTİK İNFRASTRUKTUR (mentor tövsiyəsi, Ssenari 2) ════════════════════

@app.get("/api/critical-infra/devices")
def critical_infra_devices():
    return _state["critical_status"]


@app.get("/api/critical-infra/devices/{device_id}")
def critical_infra_device_detail(device_id: str):
    match = [d for d in _state["critical_status"] if d["id"] == device_id]
    if not match:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    df = _state["critical_full"]
    sub = df[df["device_id"] == device_id].sort_values("date")
    history = [
        {
            "date": row["date"].strftime("%Y-%m-%d"), "power_kw": row["power_kw"],
            "expected_kw": round(row["expected_kw"], 1), "is_anomaly": bool(row["is_anomaly"]),
        }
        for _, row in sub.iterrows()
    ]
    return {**match[0], "history": history}


# ═══ FƏLAKƏT SSENARİSİ (mentor tövsiyəsi, Ssenari 1) ═══════════════════════

@app.get("/api/disaster-scenario")
def disaster_scenario_endpoint(zone: str = "Zona D"):
    """Lazy + zona üzrə keşlənir (hər zona ~11-15san çəkir, təkrar sorğularda
    anında qayıdır). `zone` parametri jürinin canlı olaraq fərqli zonalar
    seçib yenidən simulyasiya işə salması üçündür."""
    if zone not in DISASTER_ZONES:
        raise HTTPException(status_code=400, detail=f"Unknown zone: {zone}")
    cache_key = f"disaster_scenario::{zone}"
    if cache_key not in _state:
        _state[cache_key] = run_disaster_scenario(zone_name=zone)
        save_snapshot(dict(_state))
    return _state[cache_key]

@app.get("/api/disaster-scenario/zones")
def disaster_scenario_zones():
    return DISASTER_ZONES