"""
GridPulse AI Co-Pilot

Mühəndis sual verir ("M048 sayğacında niyə anomaliya var?"), sistem bizim
ARTIQ HESABLADIĞIMIZ diaqnoz datasını (device/meter/zone) kontekst kimi
Gemini-yə göndərir və YALNIZ bu kontekstə əsaslanaraq cavab verməyi tələb edir.

Bu, iki şeydən qorunur:
1. Uydurma cavab (hallucination) — model öz "bilik"indən yox, bizim real
   hesabladığımız rəqəmlərdən istifadə edir.
2. Demo-nun sınması — API çağırışı uğursuz olsa (şəbəkə, key, timeout),
   avtomatik olaraq eyni kontekstdən qayda-əsaslı cavaba keçir.

Qurulum: `.env` faylında GEMINI_API_KEY=... olmalıdır (pulsuz, aistudio.google.com-dan).
"""

import os
import re
import requests

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-3.5-flash-lite:generateContent"
)
TIMEOUT_SECONDS = 8


def _find_referenced_entity(question, device_status, meter_diagnoses, zone_risk):
    """Sualda konkret cihaz/sayğac/zona adı axtarır."""
    q = question.upper()

    dev_match = re.search(r"\bD0?\d{1,2}\b", q)
    if dev_match:
        did = dev_match.group().replace("D", "D0") if len(dev_match.group()) == 2 else dev_match.group()
        for d in device_status:
            if d["id"] == did or d["id"] == dev_match.group():
                return {"type": "device", "data": d}

    meter_match = re.search(r"\bM0?\d{1,3}\b", q)
    if meter_match:
        for m in meter_diagnoses:
            if m["meter_id"].upper() == meter_match.group() or m["meter_id"].upper().endswith(meter_match.group()):
                return {"type": "meter", "data": m}

    zone_match = re.search(r"ZONA\s?([A-F])", q)
    if zone_match:
        zname = f"Zona {zone_match.group(1)}"
        for z in zone_risk:
            if z["zone"] == zname:
                return {"type": "zone", "data": z}

    for d in device_status:
        if d["name"].upper() in q:
            return {"type": "device", "data": d}

    return None


def _build_context(question, device_status, meter_diagnoses, zone_risk):
    entity = _find_referenced_entity(question, device_status, meter_diagnoses, zone_risk)
    if entity:
        return entity, f"Referenced {entity['type']}:\n{entity['data']}"

    flagged_devices = [d for d in device_status if d["status"] == "flagged"]
    critical_meters = [m for m in meter_diagnoses if m["severity"] == "critical"]
    top_zones = sorted(zone_risk, key=lambda z: -z["risk_score"])[:3]
    zones_str = ", ".join(f"{str(z['zone'])} ({float(z['risk_score'])}/100, {z['band']})" for z in top_zones)
    summary = (
        f"{len(flagged_devices)}/10 devices flagged. "
        f"{len(critical_meters)} critical meter alert(s). "
        f"Top risk zones: {zones_str}."
    )
    return None, summary


def _rule_based_fallback(entity, question, context_text=None):
    if not entity:
        if context_text:
            return f"Ümumi vəziyyət: {context_text}"
        return ("Sualınızda konkret cihaz/sayğac/zona tapa bilmədim. Nümunə: "
                "'M048 sayğacında niyə anomaliya var?' və ya 'D08 nə üçün bayraqlıdır?'")

    d = entity["data"]
    if entity["type"] == "device":
        if d["status"] != "flagged":
            return f"{d['name']} normal işləyir, anomaliya aşkarlanmayıb."
        diag = d["diagnosis"]
        return (f"{d['name']}: {diag['label']} ({diag['confidence_pct']}% əminlik). "
                f"{diag['explanation']} Tövsiyə: {diag['recommended_action']} "
                f"Təxmini illik qənaət: {diag['est_savings_azn_per_year']} AZN.")
    if entity["type"] == "meter":
        return (f"{d['meter_id']} ({d['zone']}): {d['label']}. {d['explanation']} "
                f"Tövsiyə: {d['recommended_action']}")
    if entity["type"] == "zone":
        return f"{d['zone']}: risk balı {d['risk_score']}/100 ({d['band']})."
    return "Məlumat tapılmadı."


def ask_copilot(question, device_status, meter_diagnoses, zone_risk):
    entity, context_text = _build_context(question, device_status, meter_diagnoses, zone_risk)

    if not GEMINI_API_KEY:
        return {
            "answer": _rule_based_fallback(entity, question, context_text),
            "source": "rule_based",
            "note": "GEMINI_API_KEY tapılmadı — .env faylında təyin edin ki, real AI cavabı alasınız.",
        }

    prompt = (
        "You are GridPulse's engineering assistant. Answer the question using "
        "ONLY the data provided below — do not invent numbers or facts not "
        "present in it. Be concise (2-4 sentences), technical, and specific. "
        "If the data doesn't answer the question, say so plainly.\n\n"
        f"DATA:\n{context_text}\n\n"
        f"QUESTION: {question}"
    )

    try:
        resp = requests.post(
            GEMINI_URL,
            headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()
        answer = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"answer": answer.strip(), "source": "gemini", "note": None}
    except Exception as e:
        detail = str(e)
        try:
            detail = resp.text[:300]
        except Exception:
            pass
        return {
            "answer": _rule_based_fallback(entity, question, context_text),
            "source": "rule_based_fallback",
            "note": f"Gemini API xətası, ehtiyat cavaba keçdi: {detail}",
        }