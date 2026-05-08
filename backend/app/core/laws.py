"""Справочник законов РК для системы скоринга."""

import logging

logger = logging.getLogger("_k0t1k.laws")

# ================================================================
# Приказ №1061 (V1500012488) — Нормы естественной убыли
# ================================================================

# Максимально допустимый процент естественной убыли в зависимости от типа животного.
MORTALITY_NORMS = {
    "свиньи": 12.5,
    "птица": 7.5,
    "верблюды": 6.0,
    "мрс": 5.0,        # Мелкий рогатый скот (овцы, козы)
    "лошади": 3.0,
    "крс": 2.5,        # Крупный рогатый скот (взрослые)
    "молоко": 2.5,     # Молочный КРС — аналогичен КРС
    "мёд": 15.0,       # Пчёлы — высокий естественный отход, не лимитируется жёстко
    "другое": 3.0,     # Fallback
}

def get_mortality_norm(animal_type: str) -> float:
    """Возвращает предельный % естественной убыли для животного."""
    if not animal_type:
        return MORTALITY_NORMS["другое"]
    animal = str(animal_type).lower()
    for key, norm in MORTALITY_NORMS.items():
        if key in animal:
            return norm
    # Синонимы
    if "овц" in animal or "коз" in animal:
        return MORTALITY_NORMS["мрс"]
    if "молок" in animal or "молоч" in animal or "дойн" in animal:
        return MORTALITY_NORMS["молоко"]
    if "мёд" in animal or "мед" in animal or "пчел" in animal or "пасек" in animal:
        return MORTALITY_NORMS["мёд"]
    return MORTALITY_NORMS["другое"]


# ================================================================
# Приказ №332 (V1500011064) — Нагрузка на пастбища (гектар на 1 голову)
# ================================================================

# Базовые нормативы нагрузки на пастбища (гектар на 1 голову)
# В законе есть сложная разбивка по природным зонам и степени деградации,
# для MVP используем усредненные значения по категориям.
BASE_PASTURE_REQUIREMENT_HA_PER_HEAD = {
    "верблюды": 15.0,   # Пустынная зона
    "лошади": 12.0,     # Степная / Полупустынная зона
    "крс": 6.0,         # Степная зона
    "молоко": 6.0,      # Молочный КРС — аналогичен КРС
    "мрс": 1.5,         # Мелкий рогатый скот
    "свиньи": 0.0,      # Стойловое содержание — пастбища не требуются
    "птица": 0.0,       # Птицефабрика — пастбища не требуются
    "мёд": 0.0,         # Пасека — нет выпаса на пастбищах
    "другое": 5.0,
}

# Коэффициенты по всем 17 областям Казахстана (V1500011064)
# Юго-Запад (засушливый, пустынная зона) → коэффициент > 1 (нужно больше пастбищ)
# Север (лесостепь, чернозёмы) → коэффициент < 1 (пастбища продуктивнее)
# Центр — коэффициент ≈ 1.0 (базовая норма)
REGION_PASTURE_COEFFS = {
    # Пустынная / полупустынная зона — засушливые, нужно больше пастбищ
    "мангистауская": 2.0,
    "кызылординская": 1.8,
    "атырауская": 1.6,
    "туркестанская": 1.4,
    "жамбылская": 1.3,
    # Степная зона — базовая норма ± корректировка
    "алматинская": 1.1,
    "карагандинская": 1.1,
    "актюбинская": 1.2,
    "улытауская": 1.2,
    "абайская": 1.0,
    "жетісуская": 1.0,
    "восточно-казахстанская": 0.9,
    "павлодарская": 0.9,
    "западно-казахстанская": 1.0,
    # Лесостепная зона — плодородные, нужно меньше пастбищ
    "акмолинская": 0.8,
    "северо-казахстанская": 0.6,
    "костанайская": 0.8,
}

def get_pasture_requirement_ha(animal_type: str, region: str = None) -> float:
    """
    Возвращает норму пастбищ (га на 1 голову) согласно Приказу V1500011064.
    """
    if not animal_type:
        base_ha = BASE_PASTURE_REQUIREMENT_HA_PER_HEAD["другое"]
    else:
        animal = str(animal_type).lower()
        base_ha = None
        for key, ha in BASE_PASTURE_REQUIREMENT_HA_PER_HEAD.items():
            if key in animal:
                base_ha = ha
                break
        if base_ha is None:
            if "овц" in animal or "коз" in animal:
                base_ha = BASE_PASTURE_REQUIREMENT_HA_PER_HEAD["мрс"]
            elif "молок" in animal or "молоч" in animal or "дойн" in animal:
                base_ha = BASE_PASTURE_REQUIREMENT_HA_PER_HEAD["молоко"]
            elif "мёд" in animal or "мед" in animal or "пчел" in animal or "пасек" in animal:
                base_ha = 0.0  # Пасека — пастбища не требуются
            else:
                base_ha = BASE_PASTURE_REQUIREMENT_HA_PER_HEAD["другое"]
                
    if base_ha == 0.0:
        return 0.0 # Стойловое содержание / пасека — пастбища не требуются
        
    coeff = 1.0
    if region:
        reg = str(region).lower()
        for key, c in REGION_PASTURE_COEFFS.items():
            if key in reg:
                coeff = c
                break
                
    return round(base_ha * coeff, 2)


# ================================================================
# Приказ №108 (V1900018404) — Правила субсидирования
# ================================================================

# Динамические пороги эффективности субсидии на 1 голову (тенге)
# Основано на нормативах V1900018404: разные ставки для разных категорий
MERIT_AMOUNT_PER_HEAD_MAX = {
    "КРС": 2_000_000,
    "молоко": 2_000_000,
    "лошади": 3_000_000,
    "верблюды": 5_000_000,
    "овцы": 500_000,
    "мрс": 500_000,
    "свиньи": 1_000_000,
    "птица": 200_000,
    "мёд": 1_000_000,
    "другое": 5_000_000,     # Консервативный fallback
}

def get_merit_amount_threshold(animal_type: str) -> float:
    """Возвращает максимальный порог субсидии на 1 голову по типу животного."""
    if not animal_type:
        return MERIT_AMOUNT_PER_HEAD_MAX["другое"]
    animal = str(animal_type).lower()
    for key, threshold in MERIT_AMOUNT_PER_HEAD_MAX.items():
        if key.lower() in animal:
            return threshold
    if "овц" in animal or "коз" in animal:
        return MERIT_AMOUNT_PER_HEAD_MAX["овцы"]
    return MERIT_AMOUNT_PER_HEAD_MAX["другое"]


# Этот текст используется для Score API (Reranker), чтобы оценивать
# насколько цель заявки соответствует реальным жестким критериям регламента
STRICT_REGULATION_TEXT = (
    "Правила субсидирования развития племенного животноводства. "
    "Целевые требования: наличие ветеринарного паспорта на животное, "
    "наличие идентификационных номеров, регистрация скота в Информационной системе идентификации (ИЖС), "
    "соответствие зоотехническим нормативам породы. Для получения субсидии хозяйство должно "
    "иметь инфраструктуру: базы для стоянки, ограждения или помещения для содержания скота. "
    "Субсидируется только высокопродуктивный селекционный и импортный скот с подтвержденной племенной "
    "ценностью (индекс племенной ценности). Удешевление стоимости направлено сугубо на повышение качества поголовья."
)


# ================================================================
# Проверка жёстких правил (Hard-Rule Validator) — Task 4
# ================================================================

def evaluate_hard_rules(
    pasture_area_ha: float | None,
    current_head_count: int | None,
    historical_mortality_rate: float | None,
    amount: float | None,
    region: str | None,
    animal_type: str | None,
    normativ: float | None
) -> list[dict]:
    """
    Оценивает заявку по жёстким нормам законодательства.
    Возвращает список правил с результатами проверки.
    
    Returns:
        list[dict]: [
            {"rule": "Норма пастбищ (11064)", "law": "Приказ №332", "passed": True, "value": "1.2 га/гол", "required": "≥1.0 га/гол"},
            ...
        ]
    """
    rules = []
    
    # 1. Норма пастбищ (Приказ №332, V1500011064)
    pasture_required = get_pasture_requirement_ha(animal_type, region)
    if pasture_required > 0 and current_head_count and current_head_count > 0:
        actual_per_head = (pasture_area_ha or 0) / current_head_count
        passed = actual_per_head >= pasture_required
        rules.append({
            "rule": "Норма нагрузки на пастбища",
            "law": "Приказ №332 (V1500011064)",
            "passed": passed,
            "value": f"{actual_per_head:.2f} га/гол",
            "required": f"≥{pasture_required:.2f} га/гол"
        })
    elif pasture_required == 0:
        # Стойловое содержание — пастбища не требуются
        rules.append({
            "rule": "Норма нагрузки на пастбища",
            "law": "Приказ №332 (V1500011064)",
            "passed": True,
            "value": "Стойловое содержание",
            "required": "Не требуется"
        })
    
    # 2. Норма естественной убыли (Приказ №1061, V1500012488)
    mortality_norm = get_mortality_norm(animal_type)
    if historical_mortality_rate is not None:
        passed = historical_mortality_rate <= mortality_norm
        rules.append({
            "rule": "Предельный уровень падежа",
            "law": "Приказ №1061 (V1500012488)",
            "passed": passed,
            "value": f"{historical_mortality_rate:.1f}%",
            "required": f"≤{mortality_norm:.1f}%"
        })
    else:
        rules.append({
            "rule": "Предельный уровень падежа",
            "law": "Приказ №1061 (V1500012488)",
            "passed": None,  # Не удалось проверить
            "value": "Нет данных",
            "required": f"≤{mortality_norm:.1f}%"
        })
    
    # 3. Порог субсидии на голову (Приказ №108, V1900018404)
    amount_threshold = get_merit_amount_threshold(animal_type)
    if amount and current_head_count and current_head_count > 0:
        actual_per_head = amount / current_head_count
        passed = actual_per_head <= amount_threshold
        rules.append({
            "rule": "Лимит субсидии на голову",
            "law": "Приказ №108 (V1900018404)",
            "passed": passed,
            "value": f"{actual_per_head:,.0f} ₸/гол".replace(",", " "),
            "required": f"≤{amount_threshold:,.0f} ₸/гол".replace(",", " ")
        })
    
    # 4. Ненулевой норматив (общее требование)
    if normativ is not None:
        passed = normativ > 0
        rules.append({
            "rule": "Наличие норматива",
            "law": "Общие правила субсидирования",
            "passed": passed,
            "value": f"{normativ:,.0f} ₸".replace(",", " ") if normativ > 0 else "Отсутствует",
            "required": ">0"
        })
    
    # 5. Ненулевая сумма заявки
    if amount is not None:
        passed = amount > 0
        rules.append({
            "rule": "Корректность суммы",
            "law": "Общие правила субсидирования",
            "passed": passed,
            "value": f"{amount:,.0f} ₸".replace(",", " ") if amount > 0 else "Некорректно",
            "required": ">0"
        })
    
    return rules


# ================================================================
# Единый словарь имён признаков на русском языке
# ================================================================
# Single source of truth — используется в scoring_pipeline, alemplus, endpoints
FEATURE_NAMES_RU = {
    "historical_mortality_rate": "Уровень смертности скота (%)",
    "current_head_count":        "Текущее поголовье (голов)",
    "pasture_area_ha":           "Площадь пастбищ (га)",
    "head_count":                "Запрошено голов по заявке",
    "amount_per_head":           "Субсидия на одну голову (тенге)",
    "normativ_amount_ratio":     "Нормативная обоснованность суммы",
    "amount_log":                "Размер субсидии",
    "amount_vs_region_median":   "Сумма относительно региона",
    "amount_vs_subsidy_median":  "Сумма относительно типа субсидии",
    "subsidy_type_approval_rate":"Исторический % одобрения по типу",
    "direction_competition":     "Конкуренция в направлении",
    "month":                     "Месяц подачи заявки",
    "hour":                      "Час подачи заявки",
    "day_of_week":               "День недели подачи",
    "is_cooperative":            "Кооператив",
    "is_breeding":               "Племенное хозяйство",
    "is_import":                 "Импортный скот",
    "animal_type":               "Вид животных",
    "subsidy_category":          "Категория субсидии",
    "normativ_tier":             "Уровень норматива",
}
