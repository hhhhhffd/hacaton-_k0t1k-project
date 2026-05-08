"""Proactive Offer Service — генерация предложений для перспективных фермеров.

Для демо: генерируем 50 фейковых фермеров с реалистичными данными,
прогоняем через LightGBM скоринг и возвращаем топ кандидатов со скором > 75.
"""

import logging
import random
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger("_k0t1k.proactive_offers")

# Казахстанские регионы
REGIONS = [
    "Almaty", "Akmola", "Aktobe", "Atyrau", "East Kazakhstan", 
    "Zhambyl", "West Kazakhstan", "Karagandy", "Kostanay", 
    "Kyzylorda", "Mangystau", "Pavlodar", "North Kazakhstan", 
    "Turkistan", "Ulytau", "Abai", "Zhetysu"
]

# Направления животноводства
DIRECTIONS = [
    "Молочное животноводство",
    "Мясное скотоводство", 
    "Овцеводство",
    "Коневодство",
    "Птицеводство",
    "Верблюдоводство",
]

# Казахские фамилии и названия для генерации
SURNAMES = [
    "Абдрахманов", "Айтжанов", "Бекетов", "Ержанов", "Жумабеков",
    "Касымов", "Мұратов", "Нұрланов", "Оразов", "Сейдалиев",
    "Темірханов", "Уразбаев", "Хасенов", "Шаймерденов", "Әлиев",
]

FARM_PREFIXES = [
    "ТОО", "КХ", "ФХ", "Кооператив", "АО",
]

FARM_NAMES = [
    "Агро-Инвест", "Степь", "Жайлау", "Қазақ Мал", "Береке",
    "Өнім", "Алтын Дән", "Шубар", "Табиғат", "Нұр Жер",
    "Сарыарка", "Есіл", "Алатау", "Сыр", "Иртыш",
]

DISTRICTS = [
    "Каскелен", "Талдыкорган", "Кокпар", "Атбасар", "Державинск",
    "Аягоз", "Шымкент", "Тараз", "Павлодар", "Костанай",
    "Петропавл", "Караганда", "Актобе", "Уральск", "Кызылорда",
]


def _generate_fake_farmer() -> dict:
    """Генерирует одного фейкового фермера с реалистичными данными."""
    region = random.choice(REGIONS)
    direction = random.choice(DIRECTIONS)
    
    # Генерируем название хозяйства
    if random.random() < 0.3:  # 30% — кооперативы
        name = f"Кооператив '{random.choice(FARM_NAMES)} {random.choice(DISTRICTS)}'"
        is_cooperative = True
    else:
        prefix = random.choice(FARM_PREFIXES[:4])  # без АО
        name = f"{prefix} '{random.choice(FARM_NAMES)} {random.choice(DISTRICTS)}'"
        is_cooperative = prefix == "Кооператив"
    
    # Пастбища: 500-10000 га (логнормальное распределение)
    pasture_area = max(500, min(15000, np.random.lognormal(7.5, 0.8)))
    
    # Поголовье: зависит от направления и площади
    base_density = {
        "Молочное животноводство": 0.15,  # голов/га
        "Мясное скотоводство": 0.12,
        "Овцеводство": 0.5,
        "Коневодство": 0.08,
        "Птицеводство": 5.0,
        "Верблюдоводство": 0.05,
    }
    density = base_density.get(direction, 0.1) * random.uniform(0.6, 1.4)
    head_count = max(50, int(pasture_area * density))
    
    # Падёж: 0.5-5% (хорошие хозяйства — низкий)
    # Для proactive offers берём хорошие хозяйства
    mortality_rate = random.uniform(0.3, 2.5)
    
    # Рост производства: -5% до +30%
    production_growth = random.uniform(-5, 30)
    
    # Племенное хозяйство (20% вероятность)
    is_breeding = random.random() < 0.2
    
    return {
        "farmer_name": name,
        "region": region,
        "direction": direction,
        "pasture_area_ha": round(pasture_area, 1),
        "current_head_count": head_count,
        "historical_mortality_rate": round(mortality_rate, 2),
        "production_growth_pct": round(production_growth, 1),
        "is_cooperative": is_cooperative,
        "is_breeding": is_breeding,
        "years_in_business": random.randint(3, 25),
        # Дополнительные поля для скоринга
        "land_area": round(pasture_area * random.uniform(1.1, 1.5), 1),
        "subsidy_count_last_3y": random.randint(0, 5),
    }


def generate_fake_farmers(count: int = 50) -> list[dict]:
    """Генерирует список фейковых фермеров для демо."""
    random.seed(42)  # для воспроизводимости
    np.random.seed(42)
    return [_generate_fake_farmer() for _ in range(count)]


def score_farmers_with_model(
    farmers: list[dict],
    scoring_service: Any,
    lang: str = "ru",
) -> list[dict]:
    """
    Прогоняет фермеров через LightGBM модель и возвращает скоры.
    
    Если модель не загружена — использует эвристический скоринг.
    """
    if not scoring_service or not scoring_service.is_ready:
        logger.warning("Модель не загружена — используем эвристический скоринг")
        return _heuristic_scoring(farmers, lang=lang)
    
    try:
        # Преобразуем в DataFrame для модели
        df = _prepare_features_for_scoring(farmers)
        
        # Получаем предсказания модели
        model = scoring_service.model
        if hasattr(model, "predict_proba"):
            probas = model.predict_proba(df)
            # Конвертируем в скор 0-100
            scores = (probas[:, 1] * 100).round(1)
        else:
            # Fallback на эвристику
            return _heuristic_scoring(farmers)
        
        # Добавляем скоры к фермерам
        for farmer, score in zip(farmers, scores):
            farmer["predicted_merit_score"] = float(score)
            farmer["recommendation_text"] = _generate_recommendation(farmer, score, lang=lang)

        return farmers

    except Exception as e:
        logger.warning("Ошибка ML-скоринга: %s — используем эвристику", e)
        return _heuristic_scoring(farmers, lang=lang)


def _prepare_features_for_scoring(farmers: list[dict]) -> pd.DataFrame:
    """Подготавливает фичи для модели (маппинг на фичи LightGBM)."""
    data = []
    for f in farmers:
        # Расчёт head_count через нормативы (эмуляция)
        head_count = f.get("current_head_count", 100)
        pasture = f.get("pasture_area_ha", 1000)
        
        # Нагрузка на пастбище (голов/га)
        pasture_load = head_count / max(pasture, 1)
        
        row = {
            "head_count": head_count,
            "is_cooperative": 1 if f.get("is_cooperative") else 0,
            "is_breeding": 1 if f.get("is_breeding") else 0,
            "amount_per_head": 50000,  # средний норматив
            "amount_log": np.log1p(head_count * 50000),
            "normativ_tier": 1,  # средний тир
            "month": 3,  # весна — сезон субсидий
            "hour": 10,  # дневная подача
            "day_of_week": 2,  # будний день
            "pasture_load": pasture_load,
            "mortality_rate": f.get("historical_mortality_rate", 2.0),
            "production_growth_pct": f.get("production_growth_pct", 5.0),
        }
        data.append(row)
        
    return pd.DataFrame(data)


def _heuristic_scoring(farmers: list[dict], lang: str = "ru") -> list[dict]:
    """
    Эвристический скоринг без ML-модели.
    
    Формула балла (0-100):
    - Базовый: 50
    - Кооператив: +10
    - Племенное: +10  
    - Низкий падёж (<2%): +15
    - Рост производства (>10%): +10
    - Большое поголовье (>500): +5
    - Опыт (>10 лет): +5
    """
    for farmer in farmers:
        score = 50  # базовый балл
        
        # Кооператив — поддержка государства
        if farmer.get("is_cooperative"):
            score += 10
            
        # Племенное хозяйство
        if farmer.get("is_breeding"):
            score += 10
            
        # Низкий падёж
        mortality = farmer.get("historical_mortality_rate", 5)
        if mortality < 1:
            score += 15
        elif mortality < 2:
            score += 10
        elif mortality < 3:
            score += 5
            
        # Рост производства
        growth = farmer.get("production_growth_pct", 0)
        if growth > 20:
            score += 10
        elif growth > 10:
            score += 7
        elif growth > 5:
            score += 3
            
        # Масштаб хозяйства
        head_count = farmer.get("current_head_count", 0)
        if head_count > 1000:
            score += 8
        elif head_count > 500:
            score += 5
        elif head_count > 200:
            score += 3
            
        # Опыт работы
        years = farmer.get("years_in_business", 0)
        if years > 15:
            score += 5
        elif years > 10:
            score += 3
            
        # Нормализуем до 100
        score = min(100, max(0, score))
        
        # Добавляем небольшой шум для реалистичности
        score = round(score + random.uniform(-3, 3), 1)
        score = min(100, max(0, score))
        
        farmer["predicted_merit_score"] = score
        farmer["recommendation_text"] = _generate_recommendation(farmer, score, lang=lang)

    return farmers


_STRINGS = {
    "ru": {
        "cooperative": "Кооперативная форма хозяйствования",
        "breeding": "Племенное хозяйство",
        "mortality": "Отличный показатель падежа ({val}%)",
        "growth": "Высокий рост производства (+{val:.0f}%)",
        "potential": "Большой потенциал для расширения поголовья",
        "stable": "Стабильные показатели хозяйства",
        "prefix_ideal": "Идеальный кандидат: ",
        "prefix_prospect": "Перспективный кандидат: ",
        "prefix_potential": "Потенциальный кандидат: ",
    },
    "kz": {
        "cooperative": "Кооперативтік шаруашылық нысаны",
        "breeding": "Асыл тұқымды шаруашылық",
        "mortality": "Өлім-жітім деңгейі өте төмен ({val}%)",
        "growth": "Өндіріс өсімі жоғары (+{val:.0f}%)",
        "potential": "Мал басын ұлғайтуға үлкен әлеует бар",
        "stable": "Шаруашылықтың тұрақты көрсеткіштері",
        "prefix_ideal": "Үздік үміткер: ",
        "prefix_prospect": "Перспективті үміткер: ",
        "prefix_potential": "Ықтимал үміткер: ",
    },
}


def _generate_recommendation(farmer: dict, score: float, lang: str = "ru") -> str:
    """Генерирует персонализированную рекомендацию на заданном языке."""
    s = _STRINGS.get(lang, _STRINGS["ru"])
    parts = []

    if farmer.get("is_cooperative"):
        parts.append(s["cooperative"])

    if farmer.get("is_breeding"):
        parts.append(s["breeding"])

    mortality = farmer.get("historical_mortality_rate", 5)
    if mortality < 1.5:
        parts.append(s["mortality"].format(val=mortality))

    growth = farmer.get("production_growth_pct", 0)
    if growth > 15:
        parts.append(s["growth"].format(val=growth))

    pasture = farmer.get("pasture_area_ha", 0)
    head_count = farmer.get("current_head_count", 0)
    if pasture > 0 and head_count > 0:
        if head_count / pasture < 0.2:
            parts.append(s["potential"])

    if not parts:
        parts.append(s["stable"])

    if score >= 85:
        prefix = s["prefix_ideal"]
    elif score >= 75:
        prefix = s["prefix_prospect"]
    else:
        prefix = s["prefix_potential"]

    return prefix + ". ".join(parts) + "."


def get_proactive_offers(
    scoring_service: Any,
    min_score: float = 75.0,
    limit: int = 10,
    lang: str = "ru",
) -> list[dict]:
    """
    Главная функция — возвращает топ фермеров для проактивных предложений.
    
    Args:
        scoring_service: ScoringService из app.state
        min_score: минимальный балл для включения в список
        limit: максимальное количество предложений
        
    Returns:
        Список фермеров со скором >= min_score, отсортированных по убыванию
    """
    # Генерируем фермеров
    farmers = generate_fake_farmers(50)
    
    # Скорим
    scored_farmers = score_farmers_with_model(farmers, scoring_service, lang=lang)
    
    # Фильтруем и сортируем
    qualified = [f for f in scored_farmers if f.get("predicted_merit_score", 0) >= min_score]
    qualified.sort(key=lambda x: x.get("predicted_merit_score", 0), reverse=True)
    
    # Возвращаем топ
    return qualified[:limit]
