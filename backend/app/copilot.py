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

Dil dəstəyi: `lang` parametri ("az" | "en") həm kontekst mətnini, həm
rule-based ehtiyat cavabını, həm də Gemini-yə göndərilən təlimatı idarə edir
— dashboard-dakı dil dəyişdiricisi ilə sinxron işləyir.

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

NO_KEY_NOTE = {
    "az": "GEMINI_API_KEY tapılmadı — .env faylında təyin edin ki, real AI cavabı alasınız.",
    "en": "GEMINI_API_KEY not found — set it in .env to get a real AI-generated answer.",
}
NO_ENTITY_FOUND = {
    "az": "Sualınızda konkret cihaz/sayğac/zona tapa bilmədim. Nümunə: "
          "'M048 sayğacında niyə anomaliya var?' və ya 'D08 nə üçün bayraqlıdır?'",
    "en": "I couldn't find a specific device/meter/zone in your question. Example: "
          "'Why is there an anomaly on meter M048?' or 'Why is D08 flagged?'",
}


def _find_referenced_entity(question, device_status, meter_diagnoses, zone_risk):
    """Sualda konkret cihaz/sayğac/zona adı axtarır (hər iki dildə)."""
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
        if d["name_az"].upper() in q or d["name_en"].upper() in q:
            return {"type": "device", "data": d}

    return None


def _build_context(question, device_status, meter_diagnoses, zone_risk, lang):
    entity = _find_referenced_entity(question, device_status, meter_diagnoses, zone_risk)
    if entity:
        return entity, f"Referenced {entity['type']}:\n{entity['data']}"

    flagged_devices = [d for d in device_status if d["status"] == "flagged"]
    critical_meters = [m for m in meter_diagnoses if m["severity"] == "critical"]
    top_zones = sorted(zone_risk, key=lambda z: -z["risk_score"])[:3]
    band_key = "band_az" if lang == "az" else "band_en"
    zones_str = ", ".join(f"{str(z['zone'])} ({float(z['risk_score'])}/100, {z[band_key]})" for z in top_zones)
    summary = (
        f"{len(flagged_devices)}/10 devices flagged. "
        f"{len(critical_meters)} critical meter alert(s). "
        f"Top risk zones: {zones_str}."
    )
    return None, summary


def _rule_based_fallback(entity, question, lang, context_text=None):
    if not entity:
        if context_text:
            prefix = "Ümumi vəziyyət: " if lang == "az" else "Overall status: "
            return f"{prefix}{context_text}"
        return NO_ENTITY_FOUND[lang]

    d = entity["data"]
    name_k, label_k, expl_k, action_k, zone_k = (
        ("name_az", "label_az", "explanation_az", "recommended_action_az", "zone_az")
        if lang == "az" else
        ("name_en", "label_en", "explanation_en", "recommended_action_en", "zone_en")
    )

    if entity["type"] == "device":
        if d["status"] != "flagged":
            return (f"{d[name_k]} normal işləyir, anomaliya aşkarlanmayıb." if lang == "az"
                    else f"{d[name_k]} is operating normally — no anomaly detected.")
        diag = d["diagnosis"]
        if lang == "az":
            return (f"{d[name_k]}: {diag[label_k]} ({diag['confidence_pct']}% əminlik). "
                    f"{diag[expl_k]} Tövsiyə: {diag[action_k]} "
                    f"Təxmini illik qənaət: {diag['est_savings_azn_per_year']} AZN.")
        return (f"{d[name_k]}: {diag[label_k]} ({diag['confidence_pct']}% confidence). "
                f"{diag[expl_k]} Recommendation: {diag[action_k]} "
                f"Estimated annual savings: {diag['est_savings_azn_per_year']} AZN.")

    if entity["type"] == "meter":
        if lang == "az":
            return f"{d['meter_id']} ({d['zone']}): {d[label_k]}. {d[expl_k]} Tövsiyə: {d[action_k]}"
        return f"{d['meter_id']} ({d['zone']}): {d[label_k]}. {d[expl_k]} Recommendation: {d[action_k]}"

    if entity["type"] == "zone":
        band_k = "band_az" if lang == "az" else "band_en"
        if lang == "az":
            return f"{d['zone']}: risk balı {d['risk_score']}/100 ({d[band_k]})."
        return f"{d['zone']}: risk score {d['risk_score']}/100 ({d[band_k]})."

    return "Məlumat tapılmadı." if lang == "az" else "No data found."


def ask_copilot(question, device_status, meter_diagnoses, zone_risk, lang="az"):
    lang = lang if lang in ("az", "en") else "az"
    entity, context_text = _build_context(question, device_status, meter_diagnoses, zone_risk, lang)

    if not GEMINI_API_KEY:
        return {
            "answer": _rule_based_fallback(entity, question, lang, context_text),
            "source": "rule_based",
            "note": NO_KEY_NOTE[lang],
        }

    language_name = "Azerbaijani" if lang == "az" else "English"
    prompt = (
        f"You are GridPulse's engineering assistant. Answer the question using "
        f"ONLY the data provided below — do not invent numbers or facts not "
        f"present in it. Be concise (2-4 sentences), technical, and specific. "
        f"Respond ONLY in {language_name}. "
        f"If the data doesn't answer the question, say so plainly.\n\n"
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
        note_prefix = "Gemini API xətası, ehtiyat cavaba keçdi: " if lang == "az" else "Gemini API error, switched to fallback answer: "
        return {
            "answer": _rule_based_fallback(entity, question, lang, context_text),
            "source": "rule_based_fallback",
            "note": f"{note_prefix}{detail}",
        }