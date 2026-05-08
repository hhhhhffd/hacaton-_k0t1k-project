"""Загрузка данных из Excel-выгрузки GISS и сохранение в PostgreSQL."""

import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Application

logger = logging.getLogger("k0t1k.data_loader")

# Маппинг колонок Excel → понятные английские имена
# col0=№ п/п, col1=Дата, col2=пусто, col3=пусто, col4=Область, col5=Акимат,
# col6=Номер заявки, col7=Направление, col8=Наименование, col9=Статус,
# col10=Норматив, col11=Сумма, col12=Район
_COLUMN_RENAME = {
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
}

# Пустые колонки, которые нужно удалить
_DROP_COLUMNS = ["col2", "col3"]


def load_dataset(filepath: str) -> pd.DataFrame:
    """
    Загружает Excel-файл и возвращает чистый DataFrame.

    Поддерживает два формата:
    1. GISS-формат (оригинальная выгрузка): 4 мусорных строки сверху,
       колонки col0..col12, переименование по _COLUMN_RENAME.
    2. Обогащённый формат (generate_synthetic_features.py): стандартный
       pandas-Excel, заголовок в строке 0, новые признаки сохраняются
       (pasture_area_ha, historical_mortality_rate, current_head_count,
       is_merit_worthy).

    Args:
        filepath: путь к Excel-файлу (.xlsx)

    Returns:
        Очищенный DataFrame с переименованными колонками
    """
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"Файл не найден: {filepath}")

    logger.info("Загрузка данных из %s", filepath)

    # --- Авто-детекция формата: читаем только заголовок ---
    peek = pd.read_excel(filepath, nrows=0, engine="openpyxl")
    enriched_markers = {"sequential_number", "application_number", "normativ", "subsidy_name"}
    is_enriched = bool(enriched_markers.intersection(set(str(c) for c in peek.columns)))

    if is_enriched:
        logger.info("Обнаружен обогащённый формат — читаем напрямую (header=0)")
        return _load_enriched_dataset(filepath)
    else:
        logger.info("Обнаружен GISS-формат — применяем skiprows=4 + col-реименование")
        return _load_giss_dataset(filepath)


def _load_giss_dataset(filepath: Path) -> pd.DataFrame:
    """Загружает оригинальный GISS-Excel (4 мусорных строки сверху)."""
    df = pd.read_excel(
        filepath,
        skiprows=4,
        header=None,
        names=[f"col{i}" for i in range(13)],
    )
    logger.info("Загружено %d строк из GISS-Excel (до очистки)", len(df))
    df = df.drop(columns=_DROP_COLUMNS, errors="ignore")
    df = df.rename(columns=_COLUMN_RENAME)
    return _clean_dataset(df)


def _load_enriched_dataset(filepath: Path) -> pd.DataFrame:
    """
    Загружает обогащённый Excel (выход generate_synthetic_features.py).
    Заголовок в строке 0, новые признаки (pasture_area_ha и др.) сохраняются.
    """
    df = pd.read_excel(filepath, header=0, engine="openpyxl")
    logger.info("Загружено %d строк из обогащённого Excel (до очистки)", len(df))
    logger.info("Колонки обогащённого файла: %s", list(df.columns))
    return _clean_dataset(df)


def _clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """Общая очистка данных для обоих форматов."""
    # Парсим дату (пробуем стандартный GISS-формат, потом ISO)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], format="%d.%m.%Y %H:%M:%S", errors="coerce")
        # Fallback: ISO / datetime objects из enriched Excel
        if df["date"].isna().all():
            df["date"] = pd.to_datetime(df["date"], errors="coerce")

    # Нормализуем числовые поля
    for col in ["normativ", "amount"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    # Нормализуем строковые поля
    str_cols = ["region", "akimat", "application_number", "direction", "subsidy_name", "status", "district"]
    for col in str_cols:
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str).str.strip()

    if "sequential_number" in df.columns:
        df["sequential_number"] = pd.to_numeric(df["sequential_number"], errors="coerce").fillna(0).astype(int)

    # === Очистка мусорных строк ===
    before = len(df)
    if "application_number" in df.columns:
        df = df[df["application_number"].str.match(r"^\d{5,}$", na=False)]
    if "date" in df.columns:
        df = df[df["date"].notna()]
    if "region" in df.columns:
        df = df[df["region"] != ""]
    df = df.reset_index(drop=True)

    removed = before - len(df)
    if removed > 0:
        logger.info("Удалено %d мусорных строк", removed)

    logger.info("Данные очищены: %d строк, колонки: %s", len(df), list(df.columns))
    return df


async def load_and_store(filepath: str, session: AsyncSession) -> int:
    """
    Загружает Excel-файл и массово вставляет записи в таблицу applications.

    Args:
        filepath: путь к Excel-файлу
        session: асинхронная сессия SQLAlchemy

    Returns:
        Количество вставленных записей
    """
    df = load_dataset(filepath)

    logger.info("Начинаем вставку %d записей в БД", len(df))

    # Формируем список объектов Application для массовой вставки
    applications: list[Application] = []
    for _, row in df.iterrows():
        app = Application(
            sequential_number=int(row["sequential_number"]),
            submission_date=row["date"] if pd.notna(row["date"]) else None,
            region=row["region"],
            akimat=row["akimat"],
            application_number=row["application_number"],
            direction=row["direction"],
            subsidy_name=row["subsidy_name"],
            status=row["status"],
            normativ=float(row["normativ"]),
            amount=float(row["amount"]),
            farm_district=row["district"],
        )
        applications.append(app)

    # Массовая вставка батчами по 5000 записей
    batch_size = 5000
    inserted = 0
    for i in range(0, len(applications), batch_size):
        batch = applications[i : i + batch_size]
        session.add_all(batch)
        await session.flush()
        inserted += len(batch)
        logger.info("Вставлено %d / %d записей", inserted, len(applications))

    await session.commit()
    logger.info("Все %d записей успешно вставлены в БД", inserted)

    return inserted
