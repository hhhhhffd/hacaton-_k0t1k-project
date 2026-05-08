"""Тесты санитизации LLM-текста (XSS защита)."""

from app.core.sanitize import sanitize_llm_text


def test_clean_text_unchanged():
    """Чистый текст без HTML не изменяется."""
    text = "Заявка получила 78.3 балла из 100. Высокий процент одобрения в районе."
    assert sanitize_llm_text(text) == text


def test_strips_html_tags():
    """HTML-теги удаляются."""
    text = 'Заявка <script>alert("xss")</script> получила 50 баллов.'
    result = sanitize_llm_text(text)
    assert "<script>" not in result
    assert "alert" in result  # сам текст остаётся, только тег убран


def test_strips_img_onerror():
    """img с onerror — классическая XSS атака — удаляется."""
    text = '<img src=x onerror=alert(1)> Заявка одобрена.'
    result = sanitize_llm_text(text)
    assert "<img" not in result
    assert "onerror" not in result


def test_strips_javascript_scheme():
    """javascript: URL-схема удаляется."""
    text = 'Подробнее: javascript:alert(document.cookie)'
    result = sanitize_llm_text(text)
    assert "javascript:" not in result


def test_empty_string():
    """Пустая строка возвращается как есть."""
    assert sanitize_llm_text("") == ""


def test_none_passthrough():
    """None возвращается как None."""
    assert sanitize_llm_text(None) is None


def test_nested_tags():
    """Вложенные теги удаляются."""
    text = '<div><b>Важно:</b> <a href="http://evil.com">тут</a></div>'
    result = sanitize_llm_text(text)
    assert "<" not in result
    assert "Важно:" in result
    assert "тут" in result


def test_multiline_with_tags():
    """Многострочный текст с тегами."""
    text = """Анализ заявки:
<br>1. Регион: Алматы
<br>2. Балл: <b>85.3</b>
<script>document.location='http://evil.com'</script>"""
    result = sanitize_llm_text(text)
    assert "<script>" not in result
    assert "<br>" not in result
    assert "<b>" not in result
    assert "Алматы" in result
    assert "85.3" in result
