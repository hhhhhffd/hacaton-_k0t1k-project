import os
from io import BytesIO
from datetime import datetime
from fpdf import FPDF


class ProtocolPDF(FPDF):
    """PDF-протокол с поддержкой кириллицы и красивым оформлением."""

    def __init__(self):
        super().__init__()
        self.font_loaded = False
        font_path = os.path.join(os.path.dirname(__file__), "..", "data", "DejaVuSans.ttf")
        if os.path.exists(font_path):
            try:
                self.add_font("DejaVu", "", font_path, uni=True)
                self.font_loaded = True
            except Exception:
                pass

    def header(self):
        if self.font_loaded:
            self.set_font("DejaVu", "", 10)
        else:
            self.set_font("helvetica", "", 10)
        self.set_text_color(128)
        self.cell(0, 10, "Министерство сельского хозяйства Республики Казахстан", align="C")
        self.ln(5)
        self.cell(0, 10, "Автоматизированная система скоринга субсидий", align="C")
        self.ln(10)
        self.set_text_color(0)

    def footer(self):
        self.set_y(-15)
        if self.font_loaded:
            self.set_font("DejaVu", "", 8)
        else:
            self.set_font("helvetica", "", 8)
        self.set_text_color(128)
        self.cell(0, 10, f"Страница {self.page_no()}", align="C")


def create_application_pdf(app_data: dict, explanation: str, score: float) -> BytesIO:
    """
    Генерация PDF-протокола решения комиссии на русском языке.

    Включает:
    - Данные заявки
    - Merit-балл и уровень риска
    - LLM-обоснование
    - Места для подписей
    """
    pdf = ProtocolPDF()
    pdf.add_page()

    # === ЗАГОЛОВОК ===
    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 18)
    else:
        pdf.set_font("helvetica", "B", 18)

    pdf.ln(5)
    pdf.cell(0, 12, "ПРОТОКОЛ РЕШЕНИЯ КОМИССИИ", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 8, "по рассмотрению заявки на субсидию", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(8)

    # === ДАННЫЕ ЗАЯВКИ ===
    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 11)
    else:
        pdf.set_font("helvetica", "", 11)

    pdf.set_fill_color(245, 245, 245)

    pdf.cell(0, 8, f"№ п/п: {app_data.get('sequential_number', 'N/A')}", new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.cell(0, 8, f"Дата рассмотрения: {datetime.now().strftime('%d.%m.%Y')}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, f"Регион: {app_data.get('region', 'N/A')}", new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.cell(0, 8, f"Направление: {app_data.get('direction', 'N/A')}", new_x="LMARGIN", new_y="NEXT")

    amount = app_data.get('amount', 0)
    if isinstance(amount, (int, float)):
        amount_str = f"{amount:,.0f}".replace(",", " ")
    else:
        amount_str = str(amount)
    pdf.cell(0, 8, f"Запрашиваемая сумма: {amount_str} тенге", new_x="LMARGIN", new_y="NEXT", fill=True)

    if app_data.get('farmer_name'):
        pdf.cell(0, 8, f"Заявитель: {app_data.get('farmer_name')}", new_x="LMARGIN", new_y="NEXT")

    if app_data.get('subsidy_name'):
        # Используем multi_cell чтобы длинное название влезало полностью
        label = "Вид субсидии: "
        label_w = pdf.get_string_width(label)
        pdf.set_fill_color(245, 245, 245)
        pdf.set_x(pdf.l_margin)
        # Рисуем метку и текст в одной multi_cell с отступом
        pdf.multi_cell(
            0, 7,
            f"{label}{app_data.get('subsidy_name')}",
            new_x="LMARGIN", new_y="NEXT",
            fill=True,
        )

    pdf.ln(8)

    # === РЕЗУЛЬТАТЫ AI-СКОРИНГА ===
    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 14)
    else:
        pdf.set_font("helvetica", "B", 14)

    pdf.cell(0, 10, "РЕЗУЛЬТАТЫ AI-СКОРИНГА", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(3)

    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 12)
    else:
        pdf.set_font("helvetica", "", 12)

    if score >= 70:
        pdf.set_text_color(0, 128, 0)
        verdict = "РЕКОМЕНДОВАНО К ОДОБРЕНИЮ"
    elif score >= 50:
        pdf.set_text_color(200, 150, 0)
        verdict = "ТРЕБУЕТ ДОПОЛНИТЕЛЬНОГО РАССМОТРЕНИЯ"
    else:
        pdf.set_text_color(200, 0, 0)
        verdict = "НЕ РЕКОМЕНДОВАНО"

    pdf.cell(0, 10, f"Merit Score: {score:.1f} / 100", new_x="LMARGIN", new_y="NEXT", align="C")

    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 13)
    else:
        pdf.set_font("helvetica", "B", 13)
    pdf.cell(0, 10, verdict, new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_text_color(0)
    pdf.ln(5)

    # === ОБОСНОВАНИЕ ===
    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 12)
    else:
        pdf.set_font("helvetica", "B", 12)

    pdf.cell(0, 8, "Обоснование решения (AI-анализ):", new_x="LMARGIN", new_y="NEXT")

    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 10)
    else:
        pdf.set_font("helvetica", "", 10)

    try:
        pdf.multi_cell(0, 6, explanation, align="J")
    except Exception:
        pdf.multi_cell(0, 6, "Текстовое обоснование недоступно. См. детали в системе.", align="J")

    pdf.ln(10)

    # === ПОДПИСИ ===
    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 11)
    else:
        pdf.set_font("helvetica", "", 11)

    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)

    pdf.cell(0, 8, "Председатель комиссии: _______________________ / _______________", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "Член комиссии:              _______________________ / _______________", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "Секретарь:                    _______________________ / _______________", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.cell(0, 8, f"Дата: «____» _____________ {datetime.now().year} г.", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(10)

    # === ОТМЕТКА О ГЕНЕРАЦИИ ===
    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 8)
    else:
        pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(128)
    pdf.cell(0, 6, "Документ сформирован автоматически системой AI-скоринга", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 6, f"Дата генерации: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}", new_x="LMARGIN", new_y="NEXT", align="C")

    output = BytesIO()
    pdf.output(output)
    output.seek(0)
    return output


# Ширины колонок таблицы (мм), итого 190 = A4 - поля
_COL_W = [12, 32, 28, 70, 28, 10, 10]
_COL_HEADERS = ["№", "Область", "Направление", "Вид субсидии", "Сумма (тг)", "Балл", "Риск"]


def _calc_row_height(pdf: FPDF, row: list[str], line_h: float) -> float:
    """Вычисляет высоту строки на основе самой длинной ячейки."""
    max_lines = 1
    for text, w in zip(row, _COL_W):
        # Считаем количество строк которое займёт текст в данной ширине
        words = str(text).split()
        lines = 1
        line_w = 0.0
        for word in words:
            ww = pdf.get_string_width(word + " ")
            if line_w + ww > w - 1:
                lines += 1
                line_w = ww
            else:
                line_w += ww
        max_lines = max(max_lines, lines)
    return max_lines * line_h


def _draw_row(pdf: FPDF, row: list[str], line_h: float, row_h: float, fill: bool = False) -> None:
    """Рисует одну строку таблицы с переносом текста."""
    x0 = pdf.l_margin
    y0 = pdf.get_y()
    x = x0
    for text, w in zip(row, _COL_W):
        pdf.set_xy(x, y0)
        pdf.multi_cell(w, line_h, str(text), border=1, align="L", fill=fill, max_line_height=line_h)
        x += w
    pdf.set_y(y0 + row_h)


def create_budget_pdf(
    budget: float,
    funded_count: int,
    total_amount: float,
    remaining_budget: float,
    avg_score: float,
    applications: list[dict],
    region: str | None = None,
    direction: str | None = None,
) -> BytesIO:
    """
    Генерация PDF-протокола распределения бюджета субсидий.

    Страница 1 — сводка, страницы 2+ — таблица профинансированных заявок.
    """
    pdf = ProtocolPDF()
    pdf.add_page()

    def _font(size: int) -> None:
        if pdf.font_loaded:
            pdf.set_font("DejaVu", "", size)
        else:
            pdf.set_font("helvetica", "", size)

    # === ЗАГОЛОВОК ===
    _font(16)
    pdf.ln(5)
    pdf.cell(0, 12, "ПРОТОКОЛ РАСПРЕДЕЛЕНИЯ СУБСИДИЙ", new_x="LMARGIN", new_y="NEXT", align="C")
    _font(11)
    pdf.cell(0, 7, "Результаты бюджетной симуляции по критерию merit-score", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(6)

    # === СВОДНАЯ ТАБЛИЦА ===
    def fmt_money(v: float) -> str:
        return f"{v:,.0f} тг".replace(",", " ")

    rows_summary = [
        ("Дата формирования", datetime.now().strftime("%d.%m.%Y %H:%M")),
        ("Регион", region or "Все регионы"),
        ("Направление", direction or "Все направления"),
        ("Выделенный бюджет", fmt_money(budget)),
        ("Профинансировано заявок", str(funded_count)),
        ("Сумма к выплате", fmt_money(total_amount)),
        ("Остаток бюджета", fmt_money(remaining_budget)),
        ("Средний merit-score", f"{avg_score:.1f} / 100"),
    ]

    _font(11)
    pdf.set_fill_color(245, 245, 245)
    for i, (label, value) in enumerate(rows_summary):
        fill = i % 2 == 0
        pdf.set_x(pdf.l_margin)
        pdf.cell(70, 8, label, border="LTB", fill=fill)
        pdf.cell(120, 8, value, border="RTB", new_x="LMARGIN", new_y="NEXT", fill=fill)

    pdf.ln(10)

    # === ВЕРДИКТ ===
    pct_used = (total_amount / budget * 100) if budget > 0 else 0
    _font(11)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(
        0, 7,
        f"Бюджет использован на {pct_used:.1f}%. "
        f"Список ниже отсортирован по убыванию merit-score — "
        f"заявки с наивысшим баллом получают финансирование в первую очередь.",
        align="J",
    )
    pdf.set_text_color(0)
    pdf.ln(8)

    # === ПОДПИСИ НА ПЕРВОЙ СТРАНИЦЕ ===
    _font(11)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + 190, pdf.get_y())
    pdf.ln(8)
    pdf.cell(0, 8, "Председатель комиссии: _______________________ / _______________", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "Член комиссии:              _______________________ / _______________", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "Секретарь:                    _______________________ / _______________", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.cell(0, 8, f"Дата: «____» _____________ {datetime.now().year} г.", new_x="LMARGIN", new_y="NEXT")

    # === ТАБЛИЦА ЗАЯВОК ===
    if applications:
        pdf.add_page()

        _font(12)
        pdf.cell(0, 9, "ПЕРЕЧЕНЬ ПРОФИНАНСИРОВАННЫХ ЗАЯВОК", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.ln(4)

        LINE_H = 4.5

        # Заголовок таблицы
        _font(8)
        pdf.set_fill_color(30, 60, 90)
        pdf.set_text_color(255, 255, 255)
        x = pdf.l_margin
        y0 = pdf.get_y()
        for header, w in zip(_COL_HEADERS, _COL_W):
            pdf.set_xy(x, y0)
            pdf.multi_cell(w, LINE_H, header, border=1, align="C", fill=True, max_line_height=LINE_H)
            x += w
        pdf.set_y(y0 + LINE_H * 2)
        pdf.set_text_color(0)

        # Строки данных
        for idx, app in enumerate(applications):
            amount = app.get("amount", 0)
            amount_str = f"{float(amount):,.0f}".replace(",", " ") if amount else "—"

            score_val = app.get("merit_score")
            score_str = f"{float(score_val):.1f}" if score_val is not None else "—"

            risk = app.get("risk_level") or "—"
            risk_map = {"green": "Зел.", "yellow": "Жёл.", "red": "Кра."}
            risk_str = risk_map.get(risk, risk[:4])

            row = [
                str(app.get("sequential_number", idx + 1)),
                str(app.get("region", "")),
                str(app.get("direction", "")),
                str(app.get("subsidy_name", "")),
                amount_str,
                score_str,
                risk_str,
            ]

            _font(7)
            row_h = _calc_row_height(pdf, row, LINE_H)

            # Перенос страницы
            if pdf.get_y() + row_h > pdf.h - pdf.b_margin - 5:
                pdf.add_page()
                # Повторяем заголовок
                _font(8)
                pdf.set_fill_color(30, 60, 90)
                pdf.set_text_color(255, 255, 255)
                x = pdf.l_margin
                y0 = pdf.get_y()
                for header, w in zip(_COL_HEADERS, _COL_W):
                    pdf.set_xy(x, y0)
                    pdf.multi_cell(w, LINE_H, header, border=1, align="C", fill=True, max_line_height=LINE_H)
                    x += w
                pdf.set_y(y0 + LINE_H * 2)
                pdf.set_text_color(0)
                _font(7)

            fill = idx % 2 == 0
            if fill:
                pdf.set_fill_color(248, 250, 252)
            else:
                pdf.set_fill_color(255, 255, 255)

            _draw_row(pdf, row, LINE_H, row_h, fill=fill)

    # === ОТМЕТКА О ГЕНЕРАЦИИ ===
    _font(8)
    pdf.set_text_color(128)
    pdf.ln(4)
    pdf.cell(0, 5, "Документ сформирован автоматически системой AI-скоринга", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 5, f"Дата генерации: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}", new_x="LMARGIN", new_y="NEXT", align="C")

    output = BytesIO()
    pdf.output(output)
    output.seek(0)
    return output


def create_refusal_pdf(
    app_data: dict,
    risk_reason: str | None,
    merit_score: float,
    llm_explanation: str | None = None,
) -> BytesIO:
    """
    Генерация PDF-уведомления об отказе в субсидии.

    Включает:
    - Официальный заголовок МСХ РК
    - Данные заявки
    - Причина отказа (risk_reason + низкий балл)
    - Ссылки на нормативные акты
    - Места для подписей
    - Водяной знак "ОТКАЗ"
    """
    pdf = ProtocolPDF()
    pdf.add_page()

    def _font(size: int) -> None:
        if pdf.font_loaded:
            pdf.set_font("DejaVu", "", size)
        else:
            pdf.set_font("helvetica", "", size)

    # === ВОДЯНОЙ ЗНАК ===
    pdf.set_text_color(255, 200, 200)
    if pdf.font_loaded:
        pdf.set_font("DejaVu", "", 60)
    else:
        pdf.set_font("helvetica", "", 60)
    with pdf.rotation(angle=45, x=105, y=150):
        pdf.set_xy(40, 130)
        pdf.cell(130, 40, "ОТКАЗ", align="C")
    pdf.set_text_color(0)

    # === ЗАГОЛОВОК ===
    _font(16)
    pdf.set_xy(10, 35)
    pdf.cell(0, 12, "УВЕДОМЛЕНИЕ ОБ ОТКАЗЕ", new_x="LMARGIN", new_y="NEXT", align="C")
    _font(11)
    pdf.cell(0, 7, "в предоставлении государственной субсидии", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(8)

    # === ДАННЫЕ ЗАЯВКИ ===
    _font(11)
    pdf.set_fill_color(245, 245, 245)

    pdf.cell(0, 8, f"№ п/п: {app_data.get('sequential_number', 'N/A')}", new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.cell(0, 8, f"Номер заявки: {app_data.get('application_number', 'N/A')}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, f"Дата рассмотрения: {datetime.now().strftime('%d.%m.%Y')}", new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.cell(0, 8, f"Регион: {app_data.get('region', 'N/A')}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, f"Направление: {app_data.get('direction', 'N/A')}", new_x="LMARGIN", new_y="NEXT", fill=True)

    amount = app_data.get('amount', 0)
    if isinstance(amount, (int, float)):
        amount_str = f"{amount:,.0f}".replace(",", " ")
    else:
        amount_str = str(amount)
    pdf.cell(0, 8, f"Запрашиваемая сумма: {amount_str} тенге", new_x="LMARGIN", new_y="NEXT")

    if app_data.get('farmer_name'):
        pdf.cell(0, 8, f"Заявитель: {app_data.get('farmer_name')}", new_x="LMARGIN", new_y="NEXT", fill=True)

    if app_data.get('subsidy_name'):
        pdf.multi_cell(
            0, 7,
            f"Вид субсидии: {app_data.get('subsidy_name')}",
            new_x="LMARGIN", new_y="NEXT",
        )

    pdf.ln(8)

    # === РЕЗУЛЬТАТ СКОРИНГА ===
    _font(14)
    pdf.set_text_color(180, 0, 0)
    pdf.cell(0, 10, "РЕШЕНИЕ: ОТКАЗАНО", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_text_color(0)
    
    _font(12)
    pdf.cell(0, 8, f"Merit Score: {merit_score:.1f} / 100 (ниже порогового значения)", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(5)

    # === ПРИЧИНА ОТКАЗА ===
    _font(12)
    pdf.cell(0, 8, "Основание для отказа:", new_x="LMARGIN", new_y="NEXT")
    
    _font(10)
    reasons = []
    
    if merit_score < 30:
        reasons.append(f"• Балл заявки ({merit_score:.1f}) значительно ниже проходного порога (30 баллов)")
    elif merit_score < 50:
        reasons.append(f"• Балл заявки ({merit_score:.1f}) ниже рекомендуемого порога (50 баллов)")
    
    if risk_reason:
        reasons.append(f"• {risk_reason}")
    
    # Добавляем стандартные причины на основе risk_level
    risk_level = app_data.get('risk_level', '')
    if risk_level == 'red':
        if not risk_reason or 'аномалия' not in risk_reason.lower():
            reasons.append("• Выявлены признаки нарушения процедуры подачи заявки")
    
    if not reasons:
        reasons.append("• Заявка не соответствует критериям эффективного использования субсидий")

    for reason in reasons:
        # Проверяем, хватает ли места на странице
        if pdf.get_y() > 250:
            pdf.add_page()
        pdf.multi_cell(0, 6, reason, align="L")
    
    pdf.ln(5)

    # === AI-ОБОСНОВАНИЕ (если есть) ===
    if llm_explanation:
        _font(11)
        pdf.cell(0, 8, "AI-анализ заявки:", new_x="LMARGIN", new_y="NEXT")
        _font(9)
        try:
            pdf.multi_cell(0, 5, llm_explanation[:800], align="J")  # Ограничиваем длину
        except Exception:
            pdf.multi_cell(0, 5, "Автоматический анализ недоступен.", align="J")
        pdf.ln(3)

    # === НОРМАТИВНЫЕ ОСНОВАНИЯ ===
    _font(11)
    pdf.cell(0, 8, "Нормативно-правовые акты:", new_x="LMARGIN", new_y="NEXT")
    
    _font(9)
    legal_refs = [
        "• Приказ МСХ РК №11064 — Нормы нагрузки на пастбища",
        "• Приказ МСХ РК №12488 — Нормы естественной убыли скота",
        "• Приказ МСХ РК №108 — Правила субсидирования племенного животноводства",
    ]
    for ref in legal_refs:
        pdf.cell(0, 5, ref, new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(5)

    # === ПОРЯДОК ОБЖАЛОВАНИЯ ===
    if pdf.get_y() > 230:
        pdf.add_page()
    _font(10)
    pdf.set_fill_color(255, 250, 230)
    pdf.multi_cell(
        0, 6,
        "Порядок обжалования: Данное решение может быть обжаловано в течение "
        "30 календарных дней с момента получения уведомления путём подачи "
        "апелляции в территориальное управление сельского хозяйства.",
        fill=True,
    )
    
    pdf.ln(8)

    # === ПОДПИСИ ===
    if pdf.get_y() > 240:
        pdf.add_page()
    _font(11)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)

    pdf.cell(0, 8, "Председатель комиссии: _______________________ / _______________", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "Член комиссии:              _______________________ / _______________", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "Секретарь:                    _______________________ / _______________", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.cell(0, 8, f"Дата: «____» _____________ {datetime.now().year} г.", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(10)

    # === ОТМЕТКА О ГЕНЕРАЦИИ ===
    _font(8)
    pdf.set_text_color(128)
    pdf.cell(0, 6, "Документ сформирован автоматически системой AI-скоринга", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 6, f"Дата генерации: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}", new_x="LMARGIN", new_y="NEXT", align="C")

    output = BytesIO()
    pdf.output(output)
    output.seek(0)
    return output
