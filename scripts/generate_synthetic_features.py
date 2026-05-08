import logging
import sys
from pathlib import Path
import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("k0t1k.enricher")

_BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BASE / "backend"))

from app.core.laws import get_mortality_norm, get_pasture_requirement_ha
from app.ml.features import _classify_by_keywords, _ANIMAL_TYPE_KEYWORDS

# Пастбища и падеж теперь подтягиваются динамически из laws.py
MERIT_AMOUNT_PER_HEAD_MAX = 5_000_000 # Порог "эффективности" субсидии на голову

def enrich_real_data(input_excel: str, output_excel: str, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    
    logger.info(f"Читаем реальные данные из: {input_excel}...")

    df = pd.read_excel(
        input_excel,
        skiprows=4,
        header=None,
        names=[f"col{i}" for i in range(13)],
        engine="openpyxl",
    )

    df = df.rename(columns={
        "col0": "sequential_number",
        "col1": "date",
        "col4": "region",
        "col5": "akimat",
        "col6": "application_number",
        "col7": "direction",
        "col8": "subsidy_name",
        "col9": "status",
        "col10": "normativ",
        "col11": "amount",
        "col12": "district",
    })
    df = df.drop(columns=["col2", "col3"], errors="ignore")

    df["normativ"] = pd.to_numeric(df["normativ"], errors="coerce").fillna(0.0)
    df["amount"]   = pd.to_numeric(df["amount"],   errors="coerce").fillna(0.0)

    before = len(df)
    df = df[df["application_number"].astype(str).str.match(r"^\d{5,}$", na=False)]
    df = df.reset_index(drop=True)
    logger.info(f"Найдено реальных заявок: {len(df)} (удалено мусорных: {before - len(df)}).")

    n_rows = len(df)

    # 1. Извлекаем animal_type для применения законов
    df["animal_type"] = df["subsidy_name"].apply(
        lambda x: _classify_by_keywords(str(x), _ANIMAL_TYPE_KEYWORDS, default="другое")
    )

    # Динамические нормы для каждой заявки
    ha_per_head = df.apply(lambda row: get_pasture_requirement_ha(row.get("animal_type"), row.get("region")), axis=1)
    mortality_norm = df["animal_type"].apply(get_mortality_norm)

    # 2. Считаем запрашиваемое количество голов
    df["requested_quantity"] = np.where(
        df["normativ"] > 0,
        df["amount"] / df["normativ"],
        0.0,
    ).clip(0, 50000)

    # 3. Генерируем текущее поголовье
    base_heads = np.where(
        df["requested_quantity"] < 5000,
        df["requested_quantity"] * rng.uniform(1.5, 5.0, size=n_rows),
        rng.lognormal(mean=5.0, sigma=1.0, size=n_rows),
    )
    df["current_head_count"] = np.clip(base_heads, 20, 10000).astype(int)

    # 4. Генерируем площадь пастбищ (pasture_area_ha)
    # Здоровые: площадь = (текущее поголовье * ha_per_head) * шум(1.1 до 2.0) -- с запасом
    base_area = df["current_head_count"] * ha_per_head
    area_noise = rng.uniform(1.1, 2.0, n_rows)
    df["pasture_area_ha"] = np.where(ha_per_head > 0, (base_area * area_noise).clip(lower=10.0), 0.0).round(2)

    # Добавляем ~20% нарушителей (у кого земли меньше нормы)
    # Площадь = (текущее поголовье + requested) * ha_per_head * 0.5
    violator_mask = rng.random(n_rows) < 0.20
    n_violators = int(violator_mask.sum())
    if n_violators > 0:
        total_heads = df.loc[violator_mask, "current_head_count"] + df.loc[violator_mask, "requested_quantity"]
        violator_ha_req = ha_per_head.loc[violator_mask]
        df.loc[violator_mask, "pasture_area_ha"] = np.where(
            violator_ha_req > 0,
            (total_heads * violator_ha_req * rng.uniform(0.2, 0.9, n_violators)).clip(5.0).round(2),
            0.0
        )

    # 5. Генерируем падеж скота
    # Для каждой строки генерируем относительно её нормы mortality_norm
    is_healthy_mortality = rng.random(n_rows) < 0.70
    
    # Здоровые: от 0.1% до mortality_norm
    mortality_healthy = rng.uniform(0.1, 1.0) * mortality_norm
    
    # Нарушители: от mortality_norm + 0.1 до mortality_norm + 5.0
    mortality_troubled = mortality_norm + rng.uniform(0.1, 5.0, n_rows)
    
    df["historical_mortality_rate"] = np.where(
        is_healthy_mortality, 
        mortality_healthy, 
        mortality_troubled
    ).round(2)

    # 6. РАСЧЁТ ЦЕЛЕВОЙ ПЕРЕМЕННОЙ is_merit_worthy
    # Критерий 1 (V1500012488)
    low_mortality = df["historical_mortality_rate"] <= mortality_norm

    # Критерий 2
    amount_per_head = np.where(
        df["requested_quantity"] > 0,
        df["amount"] / df["requested_quantity"],
        0.0,
    ).clip(0, 10_000_000)
    efficient_amount = (amount_per_head > 0) & (amount_per_head <= MERIT_AMOUNT_PER_HEAD_MAX)

    # Критерий 3 (V1500011064)
    total_proposed_heads = df["current_head_count"] + df["requested_quantity"]
    legal_capacity = np.where(ha_per_head > 0, df["pasture_area_ha"] / ha_per_head, np.inf)
    legal_pasture_load = total_proposed_heads <= legal_capacity

    df["is_merit_worthy"] = (low_mortality & efficient_amount & legal_pasture_load).astype(int)

    # Удаляем вспомогательные
    df.drop(columns=["requested_quantity", "animal_type"], inplace=True, errors="ignore")

    merit_rate = df["is_merit_worthy"].mean() * 100
    pasture_violators = (~legal_pasture_load).sum()

    logger.info("✅ Обогащение завершено!")
    logger.info("   Merit-worthy (целевая=1): %.1f%%", merit_rate)
    logger.info("   Нарушителей нормы пастбищ (Приказ №11064): %d (%.1f%%)",
                pasture_violators, pasture_violators / n_rows * 100)
    logger.info("   Нарушителей по падежу (Приказ №12488): %d (%.1f%%)",
                (~low_mortality).sum(), (~low_mortality).sum() / n_rows * 100)

    logger.info(f"Сохраняем итоговый файл: {output_excel}")
    df.to_excel(output_excel, index=False, engine="openpyxl")
    logger.info(f"Готово! Размер датасета: {len(df)} строк x {len(df.columns)} колонок")

    return df

if __name__ == "__main__":
    INPUT_FILE  = str(_BASE / "backend/data/raw/Выгрузка по выданным субсидиям 2025 год (обезлич).xlsx")
    OUTPUT_FILE = str(_BASE / "backend/data/raw/enriched_data_2025_merit.xlsx")

    import os
    if not os.path.exists(INPUT_FILE):
        logger.warning(f"Файл {INPUT_FILE} не найден. Убедитесь, что он существует для генерации.")
    else:
        enrich_real_data(INPUT_FILE, OUTPUT_FILE)