import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import ruTranslations from './ru.json';
import kzTranslations from './kz.json';

/** Словари переводов по языкам */
const translations: Record<string, Record<string, unknown>> = {
  ru: ruTranslations as Record<string, unknown>,
  kz: kzTranslations as Record<string, unknown>,
};

/**
 * Хук для получения переводов.
 */
export function useTranslation() {
  const language = useAppStore((s) => s.language);
  const locale = language; // Alias for StatusPage

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const dict = translations[language] || translations.ru;

    // Сначала ищем плоский ключ ("analytics.title" → dict["analytics.title"])
    // Это основной формат JSON. Вложенный обход нужен только для "featureLabels.xxx"
    let text: unknown = dict[key];

    if (text === undefined) {
      // Fallback: обход вложенных объектов (для "featureLabels.head_count")
      const keys = key.split('.');
      let nested: unknown = dict;
      for (const k of keys) {
        if (typeof nested === 'object' && nested !== null) {
          nested = (nested as Record<string, unknown>)[k];
        } else {
          nested = undefined;
          break;
        }
      }
      text = nested;
    }

    let textStr = typeof text === 'string' ? text : key;

    // Подстановка параметров: {count} → значение
    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        textStr = textStr.replace(`{${paramKey}}`, String(paramValue));
      }
    }

    return textStr;
  }, [language]);

  return { t, language, locale };
}
