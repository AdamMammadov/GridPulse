"""
GridPulse — State Backup & Recovery

Mentor/öz tapıntımız: "Etibarlılıq" səhifəsinin BCP cədvəlində açıq yazmışdıq
ki, "Verilənlər bazası zədələnir → Gündəlik backup — HƏLƏ QURULMAYIB, açıq
boşluqdur". Bu modul məhz bunu bağlayır.

Nə edir: FastAPI-nin `_state` dict-i (bütün hesablanmış nəticələr — pipeline
DataFrame-ləri, diaqnozlar, keşlənmiş fəlakət/real-data nəticələri) hər
startup-dan sonra diskə "snapshot" kimi yazılır (pickle). Server yenidən
başlasa (kəsinti, deploy, çökmə), YENİ startup əvvəlcə bu snapshot-u
yükləməyə cəhd edir — uğurlu olsa, bütün ağır hesablamaları (fəlakət
ssenarisi ~13san, real-data validasiyası və s.) TƏKRAR ETMİR, saniyələr
ərzində əvvəlki vəziyyətə qayıdır.

Dürüstlük qeydi: bu, "real production-grade" verilənlər bazası (Postgres,
replication və s.) DEYİL — bu, tək-fayl, tək-server snapshot mexanizmidir.
Real SOCAR miqyasında bu, idarə olunan bulud verilənlər bazasına
(RDS/Cloud SQL) keçirilməlidir. Amma "heç nə yoxdur" ilə "bir snapshot
mexanizmi var" arasındakı fərq böyükdür — bu, o fərqi bağlayır.
"""

import pickle
import time
from pathlib import Path

SNAPSHOT_PATH = Path(__file__).parent / "data_snapshot.pkl"
SNAPSHOT_MAX_AGE_SECONDS = 24 * 3600  # 24 saatdan köhnə snapshot etibarsız sayılır


def save_snapshot(state: dict) -> dict:
    """`_state` dict-ini diskə yazır. Uğursuz olsa belə, server öz işinə
    davam edir (backup uğursuzluğu heç vaxt canlı sistemi dayandırmamalıdır)."""
    try:
        payload = {"saved_at": time.time(), "state": state}
        tmp_path = SNAPSHOT_PATH.with_suffix(".tmp")
        with open(tmp_path, "wb") as f:
            pickle.dump(payload, f, protocol=pickle.HIGHEST_PROTOCOL)
        tmp_path.replace(SNAPSHOT_PATH)  # atomik yazı — yazma zamanı kəsinti olsa, köhnə fayl zədələnmir
        return {"success": True, "saved_at": payload["saved_at"], "size_bytes": SNAPSHOT_PATH.stat().st_size}
    except Exception as e:
        return {"success": False, "error": str(e)}


def load_snapshot() -> dict | None:
    """Diskdən snapshot yükləməyə cəhd edir. Fayl yoxdursa, köhnədirsə, ya da
    zədələnibsə, None qaytarır — çağıran tərəf normal (tam) startup-a keçməlidir."""
    if not SNAPSHOT_PATH.exists():
        return None
    try:
        with open(SNAPSHOT_PATH, "rb") as f:
            payload = pickle.load(f)
        age = time.time() - payload["saved_at"]
        if age > SNAPSHOT_MAX_AGE_SECONDS:
            return None
        return payload["state"]
    except Exception:
        return None


def snapshot_status() -> dict:
    """API üçün: son backup nə vaxt olub, nə qədər köhnədir."""
    if not SNAPSHOT_PATH.exists():
        return {"exists": False, "note_az": "Hələ heç bir backup yaradılmayıb", "note_en": "No backup has been created yet"}
    try:
        with open(SNAPSHOT_PATH, "rb") as f:
            payload = pickle.load(f)
        age_minutes = round((time.time() - payload["saved_at"]) / 60, 1)
        return {
            "exists": True,
            "saved_at_unix": payload["saved_at"],
            "age_minutes": age_minutes,
            "size_bytes": SNAPSHOT_PATH.stat().st_size,
            "is_fresh": age_minutes < (SNAPSHOT_MAX_AGE_SECONDS / 60),
        }
    except Exception as e:
        return {"exists": True, "error": str(e)}