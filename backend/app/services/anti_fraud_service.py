"""Anti-Fraud Service — детекция аномалий и потенциального сговора.

Rule-based система для выявления подозрительных заявок:
- Дубликаты сумм в одном регионе (сговор)
- Новые хозяйства (< 3 месяцев)  
- Ночные подачи
- Экстремальные суммы
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
import numpy as np

logger = logging.getLogger("_k0t1k.anti_fraud")


class AntiFraudChecker:
    """Детектор аномалий и паттернов сговора."""

    # Порог для определения "одинаковых" сумм (с учётом округления)
    AMOUNT_TOLERANCE = 0.01  # 1% отклонение считается "одинаковым"
    
    # Минимальное количество заявок с одинаковой суммой для флага сговора
    MIN_COLLUSION_COUNT = 50   # yellow: 50+ одинаковых сумм в районе
    RED_COLLUSION_COUNT = 70   # red:    70+ одинаковых сумм в районе
    
    # Временной интервал для "новых" хозяйств
    NEW_FARM_DAYS = 90  # 3 месяца

    def __init__(self):
        self._region_amount_index: dict[str, dict[float, list[int]]] = {}
        
    def check_single(self, app_data: dict, all_apps: list[dict] | None = None) -> tuple[str, str | None]:
        """
        Проверяет одну заявку на аномалии.
        
        Returns:
            tuple: (risk_level, risk_reason)
            - risk_level: "green", "yellow", "red"
            - risk_reason: текстовое описание или None
        """
        reasons = []
        risk_level = "green"
        
        # === Правило 1: Нулевые значения ===
        if app_data.get("normativ", 0) == 0:
            reasons.append("Норматив равен 0 — невозможно рассчитать head_count")
            risk_level = "red"
        
        if app_data.get("amount", 0) == 0:
            reasons.append("Сумма заявки равна 0")
            risk_level = "red"
            
        # === Правило 2: Ночная подача (подозрительно) ===
        submission_date = app_data.get("submission_date") or app_data.get("date")
        if submission_date:
            if isinstance(submission_date, str):
                try:
                    submission_date = datetime.fromisoformat(submission_date.replace("Z", "+00:00"))
                except:
                    submission_date = None
            if submission_date and hasattr(submission_date, "hour"):
                hour = submission_date.hour
                if hour < 6:  # 00:00 - 05:59
                    reasons.append(f"Заявка подана ночью ({hour}:00) — нетипичное время")
                    if risk_level == "green":
                        risk_level = "yellow"
                        
        # === Правило 3: Новое хозяйство ===
        farm_created = app_data.get("farm_created_date")
        if farm_created:
            if isinstance(farm_created, str):
                try:
                    farm_created = datetime.fromisoformat(farm_created.replace("Z", "+00:00"))
                except:
                    farm_created = None
            if farm_created:
                age_days = (datetime.now(farm_created.tzinfo) - farm_created).days
                if age_days < self.NEW_FARM_DAYS:
                    reasons.append(f"Хозяйство создано недавно ({age_days} дней назад)")
                    if risk_level == "green":
                        risk_level = "yellow"
                        
        # === Правило 4: Экстремальная сумма ===
        amount = app_data.get("amount", 0)
        region_median = app_data.get("region_amount_median")
        if region_median and region_median > 0 and amount > 0:
            ratio = amount / region_median
            if ratio > 10:
                reasons.append(f"Сумма в {ratio:.1f}x выше медианы региона — возможное завышение")
                risk_level = "red"
            elif ratio > 5:
                reasons.append(f"Сумма в {ratio:.1f}x выше медианы региона")
                if risk_level == "green":
                    risk_level = "yellow"
                    
        risk_reason = "; ".join(reasons) if reasons else None
        return risk_level, risk_reason
    
    def check_batch_for_collusion(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Проверяет batch заявок на паттерны сговора.
        
        Добавляет колонки:
        - risk_level: green/yellow/red
        - risk_reason: текстовое описание
        
        Паттерны сговора:
        1. 3+ заявки с одинаковой суммой в одном регионе
        2. 3+ заявки с одинаковой площадью в одном регионе
        """
        df = df.copy()
        
        # Инициализируем колонки если их нет
        if "risk_level" not in df.columns:
            df["risk_level"] = "green"
        if "risk_reason" not in df.columns:
            df["risk_reason"] = None
            
        # === Детекция сговора по сумме ===
        self._detect_amount_collusion(df)
        
        # === Детекция сговора по площади ===
        self._detect_area_collusion(df)
        
        # === Базовые правила для каждой заявки ===
        self._apply_basic_rules(df)
        
        return df
    
    def _detect_amount_collusion(self, df: pd.DataFrame) -> None:
        """Детекция сговора по одинаковым суммам в районе."""
        if "amount" not in df.columns:
            return

        group_col = "district" if "district" in df.columns else "region"
        if group_col not in df.columns:
            return

        # Группируем по району + округлённой сумме
        df["_amount_bucket"] = (df["amount"] / 1000).round() * 1000  # округление до 1000 тенге

        # Считаем количество заявок с такой же суммой в районе
        collusion_counts = df.groupby([group_col, "_amount_bucket"])["amount"].transform("count")

        # Помечаем подозрительные
        mask = collusion_counts >= self.MIN_COLLUSION_COUNT
        suspicious_idx = df.index[mask]

        for idx in suspicious_idx:
            district = df.loc[idx, group_col]
            amount = df.loc[idx, "amount"]
            count = collusion_counts.loc[idx]

            current_reason = df.loc[idx, "risk_reason"]
            new_reason = f"Аномалия: {int(count)} заявок с суммой ~{amount:,.0f}₸ в районе {district}"
            
            if current_reason:
                df.loc[idx, "risk_reason"] = f"{current_reason}; {new_reason}"
            else:
                df.loc[idx, "risk_reason"] = new_reason
                
            # Повышаем уровень риска
            if df.loc[idx, "risk_level"] == "green":
                df.loc[idx, "risk_level"] = "yellow"
            if count >= self.RED_COLLUSION_COUNT:
                df.loc[idx, "risk_level"] = "red"
                
        # Удаляем временную колонку
        df.drop(columns=["_amount_bucket"], inplace=True)
        
    def _detect_area_collusion(self, df: pd.DataFrame) -> None:
        """Детекция сговора по одинаковой площади пастбищ."""
        area_col = "pasture_area_ha" if "pasture_area_ha" in df.columns else "land_area"
        group_col = "district" if "district" in df.columns else "region"
        if area_col not in df.columns or group_col not in df.columns:
            return

        # Группируем по району + округлённой площади (до 10 га)
        df["_area_bucket"] = (df[area_col] / 10).round() * 10

        collusion_counts = df.groupby([group_col, "_area_bucket"])[area_col].transform("count")

        mask = (collusion_counts >= self.MIN_COLLUSION_COUNT) & (df["_area_bucket"] > 0)
        suspicious_idx = df.index[mask]

        for idx in suspicious_idx:
            district = df.loc[idx, group_col]
            area = df.loc[idx, area_col]
            count = collusion_counts.loc[idx]

            current_reason = df.loc[idx, "risk_reason"]
            new_reason = f"Аномалия: {int(count)} заявок с площадью ~{area:.0f} га в районе {district}"
            
            if current_reason:
                if "площадью" not in current_reason:  # избегаем дублирования
                    df.loc[idx, "risk_reason"] = f"{current_reason}; {new_reason}"
            else:
                df.loc[idx, "risk_reason"] = new_reason
                
            if df.loc[idx, "risk_level"] == "green":
                df.loc[idx, "risk_level"] = "yellow"
                
        df.drop(columns=["_area_bucket"], inplace=True)
        
    def _apply_basic_rules(self, df: pd.DataFrame) -> None:
        """Применяет базовые правила детекции аномалий."""
        # Нулевой норматив
        if "normativ" in df.columns:
            mask = df["normativ"] == 0
            df.loc[mask, "risk_level"] = "red"
            df.loc[mask, "risk_reason"] = df.loc[mask, "risk_reason"].apply(
                lambda x: f"{x}; Норматив = 0" if x else "Норматив = 0"
            )
            
        # Нулевая сумма
        if "amount" in df.columns:
            mask = df["amount"] == 0
            df.loc[mask, "risk_level"] = "red"
            df.loc[mask, "risk_reason"] = df.loc[mask, "risk_reason"].apply(
                lambda x: f"{x}; Сумма = 0" if x else "Сумма = 0"
            )
            
        # Ночная подача
        if "date" in df.columns or "submission_date" in df.columns:
            date_col = "submission_date" if "submission_date" in df.columns else "date"
            if df[date_col].dtype == "datetime64[ns]" or hasattr(df[date_col].iloc[0] if len(df) > 0 else None, "hour"):
                hour = df[date_col].dt.hour
                mask = hour < 6
                # Только если ещё не red
                green_yellow_mask = mask & (df["risk_level"] != "red")
                df.loc[green_yellow_mask, "risk_level"] = "yellow"
                df.loc[green_yellow_mask, "risk_reason"] = df.loc[green_yellow_mask, "risk_reason"].apply(
                    lambda x: f"{x}; Ночная подача" if x else "Ночная подача"
                )


# Singleton для удобства использования
anti_fraud_checker = AntiFraudChecker()


def check_application_fraud(app_data: dict) -> tuple[str, str | None]:
    """Быстрая проверка одной заявки."""
    return anti_fraud_checker.check_single(app_data)


def enrich_with_fraud_flags(df: pd.DataFrame) -> pd.DataFrame:
    """Обогащает DataFrame флагами сговора и аномалий."""
    return anti_fraud_checker.check_batch_for_collusion(df)
