"""
GridPulse Auto-Dispatch

Kritik/yüksək şiddətli tapıntıları avtomatik "İş Əmri"nə (Work Order) çevirir,
zona/ixtisasa görə ən uyğun mühəndisə təyin edir.

Dürüstlük qeydi: bu, real SMS/email/push bildirişi GÖNDƏRMİR — real insanlara
mesaj yollamaq üçün real telefon nömrələri/inteqrasiya (Twilio və s.) lazımdır,
bu, prototip üçün nə real, nə də təhlükəsizdir. Əvəzinə, DAXİLİ dispatç
növbəsi yaradırıq — konsepti tam göstərir, iş axını (pending -> acknowledged
-> resolved) real vaxt izlənilir.
"""

ENGINEERS = {
    "mechanical": {"name": "Elvin M.", "role_az": "Mexanik Texnik", "role_en": "Mechanical Technician", "zones": ["Pump Station", "Compression Unit"]},
    "electrical": {"name": "Aysel R.", "role_az": "Elektrik/HVAC Texniki", "role_en": "Electrical/HVAC Technician", "zones": ["Utilities", "Admin Building"]},
    "safety": {"name": "Vüqar T.", "role_az": "Sahə Təhlükəsizlik Müfəttişi", "role_en": "Field Safety Inspector", "zones": ["Tank Farm", "Perimeter", "Safety Systems", "Berth / Loading Dock"]},
    "audit": {"name": "Sahə Audit Komandası", "role_az": "Sayğac Auditi", "role_en": "Meter Audit Team", "zones": []},
}

PRIORITY_ORDER = {"URGENT": 0, "HIGH": 1, "MEDIUM": 2}


def _assign_engineer(zone):
    for eng in ENGINEERS.values():
        if zone in eng["zones"]:
            return eng
    return ENGINEERS["audit"]


def generate_work_orders(device_status, meter_diagnoses):
    orders = []
    counter = 1

    for d in device_status:
        if d["status"] != "flagged":
            continue
        diag = d["diagnosis"]
        priority = "URGENT" if diag["cause_id"] == "unexpected_activation" else "HIGH"
        eng = _assign_engineer(d["zone"])
        orders.append({
            "ticket_id": f"WO-2026-{counter:04d}",
            "target_type": "device",
            "target_id": d["id"],
            "target_name_az": d["name_az"], "target_name_en": d["name_en"],
            "zone_az": d["zone_az"], "zone_en": d["zone_en"],
            "priority": priority,
            "assigned_engineer": eng["name"],
            "assigned_role_az": eng["role_az"], "assigned_role_en": eng["role_en"],
            "diagnosis_label_az": diag["label_az"], "diagnosis_label_en": diag["label_en"],
            "recommended_action_az": diag["recommended_action_az"], "recommended_action_en": diag["recommended_action_en"],
            "confidence_pct": diag["confidence_pct"],
        })
        counter += 1

    for m in meter_diagnoses:
        if m["type"] not in ("theft_drop", "meter_fault"):
            continue
        priority = "URGENT" if m["type"] == "theft_drop" else "HIGH"
        eng = ENGINEERS["audit"]
        orders.append({
            "ticket_id": f"WO-2026-{counter:04d}",
            "target_type": "meter",
            "target_id": m["meter_id"],
            "target_name_az": f"Sayğac {m['meter_id']}", "target_name_en": f"Meter {m['meter_id']}",
            "zone_az": m["zone"], "zone_en": m["zone"],
            "priority": priority,
            "assigned_engineer": eng["name"],
            "assigned_role_az": eng["role_az"], "assigned_role_en": eng["role_en"],
            "diagnosis_label_az": m["label_az"], "diagnosis_label_en": m["label_en"],
            "recommended_action_az": m["recommended_action_az"], "recommended_action_en": m["recommended_action_en"],
            "confidence_pct": None,
        })
        counter += 1

    return sorted(orders, key=lambda o: PRIORITY_ORDER[o["priority"]])