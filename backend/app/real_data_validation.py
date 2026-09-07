"""
GridPulse — Real-World Data Validation

Sintetik datada əldə edilən nəticələrin (Recall 96.1%, Precision 70.5%)
sadəcə öz yaratdığımız sintetik "səs-küyə" uyğunlaşmadığını göstərmək üçün,
aşkarlama metodologiyasını real, açıq mənbəli enerji istehlakı datası
üzərində sınayırıq.

Data mənbəyi: PJM Interconnection (ABŞ-ın böyük regional enerji operatoru) —
12 real regional utility-nin saatlıq yük datası (MW), 2002-2018. Açıq mənbə
(əsli: Kaggle "Hourly Energy Consumption", robikscube), GitHub-da güzgülənib.
Fayllar ilk sorğuda avtomatik yüklənib yerli keşə saxlanılır (~26MB, bir dəfəlik).

Metodologiya: gündəlik BAZA (baseline) tam realdır — heç bir sintetik törəmə
yoxdur. Yalnız ANOMALİYA HADİSƏLƏRİ (12 regiondan 4-ünə) eyni metodologiya ilə
inject edilib (açıq mənbədə etiketlənmiş oğurluq/nasazlıq nümunəsi olmadığı
üçün). Qalan 8 region tərtəmiz saxlanılıb — bunlar real dünya yalançı-həyəcan
testini təşkil edir.

TAPINTI (dürüst hesabat): Pilot sınaqda istifadə etdiyimiz sabit 45-günlük
kalibrasiya (bax pipeline.py) TƏMİZ real datada 34.65% yalançı həyəcan
dərəcəsi verdi — sintetik datadakından qat-qat yüksək. Səbəbini araşdırdıq:
seçdiyimiz fasiləsiz-data pəncərələri təsadüfən yaz→yay aralığına düşüb,
real yay AC yükü (bəzi regionlarda +50-65%) 45-günlük yaz bazasını
"köhnəldib". Bu, sintetik datamızın həddindən sadə mövsümi modelinin (±15%
sinusoid) gizlətdiyi REAL bir problemdir.

Bunun cavabında "robust trailing" kalibrasiya yanaşmasını sınadıq: sabit
45-günlük snapshot əvəzinə, sürüşən pəncərə (son 42 gün, EYNİ HƏFTƏ GÜNÜ)
istifadə edir, VƏ artıq bayraqlanmış günləri bu pəncərədən çıxarır (əks
halda davam edən anomaliya "yeni normal" kimi öyrənilib gizlənir — bunu da
sınaqla aşkar etdik: sadə sürüşən pəncərə Recall-ı 99.6%-dən 7.1%-ə
çökdürdü). Nəticə: FP dərəcəsi 34.65%→3.96%, Precision 76.7%→96.1%,
Recall isə 99.6%→76.8% (real dünya routluğu üçün məqbul mübadilə).
"""

import numpy as np
import pandas as pd
import requests
from pathlib import Path

from app.pipeline import _detect_single_meter, CALIB_DAYS, detect_robust_trailing as _detect_robust_trailing

DATA_DIR = Path(__file__).parent / "real_data"
RAW_BASE = "https://raw.githubusercontent.com/panambY/Hourly_Energy_Consumption/master/data"
WINDOW_DAYS = 180
TRAILING_WINDOW = 42

REGIONS = ["AEP", "COMED", "DAYTON", "DEOK", "DOM", "DUQ", "EKPC", "FE", "NI", "PJME", "PJMW", "PJM_Load"]

# 4 region qəsdən anomaliya inject olunur (hər tipdən 1), 8-i tərtəmiz qalır.
INJECTED = {
    "AEP": ("theft_drop", 90),
    "COMED": ("meter_fault", 100),
    "DOM": ("spike", 80),
    "DUQ": ("gradual_decline", 70),
}


def _ensure_downloaded():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for region in REGIONS:
        path = DATA_DIR / f"{region}_hourly.csv"
        if path.exists() and path.stat().st_size > 1000:
            continue
        url = f"{RAW_BASE}/{region}_hourly.csv"
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        path.write_bytes(resp.content)


def _load_region_daily(region):
    path = DATA_DIR / f"{region}_hourly.csv"
    df = pd.read_csv(path)
    df["Datetime"] = pd.to_datetime(df["Datetime"])
    df = df.sort_values("Datetime")
    col = f"{region}_MW"
    daily = df.set_index("Datetime")[col].resample("D").agg(["sum", "count"])
    complete = daily["count"] == 24
    grp = (~complete).cumsum()
    run_lengths = complete.groupby(grp).sum()
    if run_lengths.empty or run_lengths.max() < WINDOW_DAYS:
        return None
    best_grp = run_lengths.idxmax()
    run = daily[(grp == best_grp) & complete]
    window = run.iloc[:WINDOW_DAYS]
    out = window["sum"].reset_index().rename(columns={"Datetime": "date", "sum": "consumption_kwh"})
    out["weekday"] = out["date"].dt.weekday
    return out


def _inject_anomaly(daily_df, anomaly_type, start_day):
    df = daily_df.copy()
    label = np.array(["normal"] * len(df), dtype=object)
    for i in range(start_day, len(df)):
        days_since = i - start_day
        if anomaly_type == "theft_drop":
            df.loc[i, "consumption_kwh"] *= 0.15
            label[i] = "anomaly"
        elif anomaly_type == "meter_fault":
            df.loc[i, "consumption_kwh"] = 0.0
            label[i] = "anomaly"
        elif anomaly_type == "spike" and days_since < 5:
            df.loc[i, "consumption_kwh"] *= 3.0
            label[i] = "anomaly"
        elif anomaly_type == "gradual_decline":
            decline_factor = max(0.2, 1 - 0.01 * days_since)
            df.loc[i, "consumption_kwh"] *= decline_factor
            if decline_factor < 0.7:
                label[i] = "anomaly"
    df["true_label"] = label
    return df


def _score(all_df):
    injected_df = all_df[all_df["meter_id"].isin(INJECTED.keys())]
    clean_df = all_df[~all_df["meter_id"].isin(INJECTED.keys())]
    is_true = injected_df["true_label"] == "anomaly"
    total_true = int(is_true.sum())
    tp = int((injected_df["predicted_anomaly"] & is_true).sum())
    flagged_n = int(injected_df["predicted_anomaly"].sum())
    recall = round(tp / total_true * 100, 1) if total_true else 0
    precision = round(tp / flagged_n * 100, 1) if flagged_n else 0
    fp_rate = round(int(clean_df["predicted_anomaly"].sum()) / int(len(clean_df)) * 100, 2) if len(clean_df) else 0
    return recall, precision, fp_rate


def run_real_data_validation():
    _ensure_downloaded()

    raw_regions = {}
    for region in REGIONS:
        daily = _load_region_daily(region)
        if daily is None:
            continue
        if region in INJECTED:
            a_type, start = INJECTED[region]
            daily = _inject_anomaly(daily, a_type, start)
        else:
            daily["true_label"] = "normal"
        raw_regions[region] = daily

    naive_results = [_detect_single_meter(r, d.copy()) for r, d in raw_regions.items()]
    naive_df = pd.concat(naive_results, ignore_index=True)
    naive_recall, naive_precision, naive_fp = _score(naive_df)

    robust_results = [_detect_robust_trailing(r, d.copy()) for r, d in raw_regions.items()]
    robust_df = pd.concat(robust_results, ignore_index=True)
    robust_recall, robust_precision, robust_fp = _score(robust_df)

    per_region = []
    for region in REGIONS:
        if region not in raw_regions:
            continue
        rdf = robust_df[robust_df["meter_id"] == region]
        ndf = naive_df[naive_df["meter_id"] == region]
        per_region.append({
            "region": region,
            "injected_type": INJECTED.get(region, (None, None))[0],
            "naive_flagged_days": int(ndf["predicted_anomaly"].sum()),
            "robust_flagged_days": int(rdf["predicted_anomaly"].sum()),
            "total_days": int(len(rdf)),
        })

    return {
        "naive": {
            "label_az": "Sabit 45-günlük kalibrasiya (sintetik pilot ilə eyni metod)",
            "label_en": "Fixed 45-day calibration (same method as synthetic pilot)",
            "recall_pct": naive_recall,
            "precision_pct": naive_precision,
            "clean_false_positive_rate_pct": naive_fp,
        },
        "robust": {
            "label_az": "Robust sürüşən kalibrasiya (real-data tapıntısından təkmilləşmə)",
            "label_en": "Robust trailing calibration (improvement from real-data finding)",
            "recall_pct": robust_recall,
            "precision_pct": robust_precision,
            "clean_false_positive_rate_pct": robust_fp,
        },
        "synthetic_benchmark_recall_pct": 96.1,
        "synthetic_benchmark_precision_pct": 70.5,
        "injected_regions_count": len(INJECTED),
        "clean_regions_count": len(raw_regions) - len(INJECTED),
        "per_region": per_region,
        "window_days": WINDOW_DAYS,
        "data_source_url": "https://www.kaggle.com/datasets/robikscube/hourly-energy-consumption",
        "data_source_label": "PJM Interconnection \u2014 12 real regional utilities, hourly load (MW), 2002\u20132018",
        "finding_az": (
            "Real datada sınaq apardıqda, sintetik pilotda istifadə etdiyimiz sabit "
            "45-günlük kalibrasiya TƏMİZ regionlarda 34.65% yalançı həyəcan verdi — "
            "səbəb real mövsümi trend idi (yaz bazası, yay AC yükü ilə tanınmaz oldu). "
            "Sintetik datamız bunu göstərməmişdi, çünki onun mövsümi modeli çox sadə "
            "idi. Bunun cavabında sürüşən, 'özünü təmizləyən' kalibrasiya hazırladıq "
            f"(bayraqlanmış günləri baza pəncərəsindən çıxarır, N-günlük davamlılıq tələb edir) — FP dərəcəsi {robust_fp}%-ə "
            f"düşdü, Precision {robust_precision}%-ə qalxdı (Recall {robust_recall}% — daha uzun davamlılıq tələbi "
            "bəzi qısa-müddətli hadisələri ötürür, bu, şüurlu dəyişdirilmədir)."
        ),
        "finding_en": (
            "Testing on real data revealed that the fixed 45-day calibration used in "
            "our synthetic pilot produced a 34.65% false-positive rate on clean "
            "regions — caused by real seasonal trend (a spring baseline became "
            "outdated by summer AC load). Our synthetic data hadn't shown this "
            "because its seasonal model was too simple. In response we built a "
            "trailing, self-cleaning calibration (excludes already-flagged days from "
            f"the baseline window, requires N-day persistence) — the false-positive rate dropped to {robust_fp}%, with "
            f"precision rising to {robust_precision}% (recall {robust_recall}% — the longer persistence "
            "requirement trades away some short-lived events by design)."
        ),
    }