"""Санитизация текста от LLM — удаление HTML/скриптов для защиты от XSS."""

import re


# Паттерн для удаления HTML-тегов
_HTML_TAG_RE = re.compile(r"<[^>]+>")

# Паттерн для JS-обработчиков событий (onclick, onerror, и т.д.)
_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)

# Паттерн для javascript: URL-схемы
_JS_SCHEME_RE = re.compile(r"javascript\s*:", re.IGNORECASE)


def sanitize_llm_text(text: str) -> str:
    """
    Очищает текст от потенциально опасного HTML/JS.

    Используется для LLM-объяснений перед сохранением в БД и отдачей клиенту.
    Удаляет: HTML-теги, JS event handlers, javascript: URL-схемы.

    Args:
        text: сырой текст от Qwen или другого LLM

    Returns:
        очищенный текст, безопасный для рендера
    """
    if not text:
        return text

    # Удаляем HTML-теги (<script>, <img onerror=...>, и т.д.)
    cleaned = _HTML_TAG_RE.sub("", text)

    # Удаляем JS event handlers
    cleaned = _EVENT_HANDLER_RE.sub("", cleaned)

    # Удаляем javascript: схемы
    cleaned = _JS_SCHEME_RE.sub("", cleaned)

    return cleaned.strip()
