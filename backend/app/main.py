from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pydantic import BaseModel

from app.copilot import ask_copilot
from app.dispatch import generate_work_orders
from app.pipeline import generate_synthetic_data, detect_anomalies, score_zone_risk, forecast_demand, diagnose_meters
from app.devices import generate_device_data, diagnose_devices, DEVICES

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
    raw_df = generate_synthetic_data()
    result_df = detect_anomalies(raw_df)
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


@app.get("/api/health")
def health():
    return {"status": "ok", "meters_loaded": int(_state["result_df"]["meter_id"].nunique())}


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

@app.post("/api/copilot/ask")
def copilot_ask(payload: CopilotQuestion):
    return ask_copilot(
        payload.question,
        _state["device_status"],
        _state["meter_diagnoses"],
        _state["zone_risk"],
    )


@app.get("/api/dispatch/queue")
def dispatch_queue():
    return _state["work_orders"]