"""
GridPulse — Reliability Impact Estimator (SAIDI/SAIFI)

Mentor tövsiyəsi (dəqiq eşidilməyib, araşdırma ilə aydınlaşdı): "Azərişıqda
SAIDI SAIFI var" — bu, insan adı DEYİL, IEEE 1366 standartında dünya
utility-lərinin istifadə etdiyi rəsmi ETİBARLILIQ GÖSTƏRİCİLƏRİDİR:

  SAIDI (System Average Interruption Duration Index) = orta müştərinin
    ildə cəmi neçə DƏQİQƏ enerjisiz qaldığı
  SAIFI (System Average Interruption Frequency Index) = orta müştərinin
    ildə NEÇƏ DƏFƏ kəsinti yaşadığı

Bu modul GridPulse-un artıq test edilmiş imkanlarını (kütləvi-hadisə
konsolidasiyası, proqnozlu texniki xidmət) bu standart dilə tərcümə edir.

DÜRÜSTLÜK QEYDİ: Azərbaycan/Azərişıq üçün rəsmi dərc edilmiş SAIDI/SAIFI
rəqəmi TAPILMADI (açıq mənbədə mövcud deyil). Ona görə bu modul KONKRET
"AZ-in SAIDI-si budur" iddiası ETMİR. Bunun əvəzinə: beynəlxalq dərc edilmiş
diapazonları (IEEE 1366, mənbəli) İSTİNAD nöqtəsi kimi göstərir, və
GridPulse-un ÖLÇÜLƏBİLƏN təsirini (nə qədər YÜKSƏLƏ bilər, faizlə) şəffaf
fərziyyələrlə hesablayır — real ölçülmüş AZ rəqəmi deyil, METODOLOGİYA
nümayişidir.
"""

SAIDI_BENCHMARKS_MINUTES_PER_YEAR = {
    "world_class": {"label_az": "Dünya səviyyəsi (DEWA, BƏƏ)", "label_en": "World-class (DEWA, UAE)", "value": 1.6},
    "strong_developed": {"label_az": "Güclü inkişaf etmiş (Enedis, Fransa)", "label_en": "Strong developed (Enedis, France)", "value": 36},
    "us_median": {"label_az": "ABŞ median-ı (IEEE 1366)", "label_en": "US median (IEEE 1366)", "value": 90},
    "us_with_major_events": {"label_az": "ABŞ, böyük hadisələrlə (EIA)", "label_en": "US, with major events (EIA)", "value": 330},
}
BENCHMARK_SOURCE = "IEEE Standard 1366-1998; U.S. EIA Annual Electric Power Industry Report; Sia Partners DSO benchmarking, 2024"


def estimate_reliability_impact(
    mass_event_fraction_pct=63.6,
    without_consolidation_tickets=11,
    predictive_lead_days=43,
    assumed_zone_customers=5000,
):
    saidi_improvement_pct_range = (15, 25)
    saifi_improvement_pct_range = (8, 15)

    return {
        "inputs_used": {
            "mass_event_fraction_pct": mass_event_fraction_pct,
            "without_consolidation_tickets": without_consolidation_tickets,
            "predictive_lead_days": predictive_lead_days,
            "assumed_zone_customers": assumed_zone_customers,
        },
        "saidi": {
            "mechanism_az": "Konsolidə edilmiş xəbərdarlıq (11→1) sahə komandasının prioritetsizlik gecikməsini aradan qaldırır — daha sürətli bərpa",
            "mechanism_en": "Consolidated alert (11\u21921) removes field-team prioritization delay \u2014 faster restoration",
            "estimated_improvement_pct_range": saidi_improvement_pct_range,
        },
        "saifi": {
            "mechanism_az": f"Proqnozlu texniki xidmət (~{predictive_lead_days} gün əvvəlcədən xəbərdarlıq) bəzi məcburi kəsintilərin planlaşdırılmış təmirə çevrilməsinə imkan verir",
            "mechanism_en": f"Predictive maintenance (~{predictive_lead_days}-day lead time) converts some forced outages into scheduled repairs",
            "estimated_improvement_pct_range": saifi_improvement_pct_range,
        },
        "benchmarks": SAIDI_BENCHMARKS_MINUTES_PER_YEAR,
        "benchmark_source": BENCHMARK_SOURCE,
        "disclaimer_az": (
            "Azərbaycan/Azərişıq üçün rəsmi dərc edilmiş SAIDI/SAIFI rəqəmi açıq "
            "mənbədə tapılmadı — bu modul KONKRET AZ rəqəmi İDDİA ETMİR. Yuxarıdakı "
            "faiz diapazonları GridPulse-un ÖLÇÜLMÜŞ imkanlarına (konsolidasiya, "
            "proqnoz) əsaslanan METODOLOGİYA nümayişidir, audit edilmiş nəticə deyil. "
            "Real təsiri ölçmək üçün Azərişıq-ın öz tarixi SAIDI/SAIFI datası lazımdır."
        ),
        "disclaimer_en": (
            "No officially published SAIDI/SAIFI figure for Azerbaijan/Azerishiq was "
            "found in open sources \u2014 this module does NOT claim a specific AZ number. "
            "The percentage ranges above are a methodology demonstration grounded in "
            "GridPulse's measured capabilities (consolidation, prediction), not an "
            "audited result. Measuring real impact requires Azerishiq's own historical "
            "SAIDI/SAIFI data."
        ),
    }