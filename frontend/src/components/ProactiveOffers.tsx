import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Send, MapPin, Target, Leaf, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { getProactiveOffers } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';
import type { ProactiveOffer } from '../types';

/**
 * Компонент "Проактивные предложения" (Auto-Offer)
 *
 * Показывает список перспективных фермеров, которым государство может
 * проактивно предложить субсидию на основе их данных из внешних источников.
 *
 * Концепция: вместо "фермер подаёт заявку и ждёт" → "государство само находит достойных".
 */
export default function ProactiveOffers() {
  const { t, language } = useTranslation();
  const [offers, setOffers] = useState<ProactiveOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(75);
  const [sentOffers, setSentOffers] = useState<Set<string>>(new Set());

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProactiveOffers(minScore, 10, language);
      setOffers(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('offers.loadError');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [minScore, language, t]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const handleSendOffer = (farmerName: string) => {
    // В демо просто показываем уведомление
    setSentOffers(prev => new Set([...prev, farmerName]));
    // Здесь был бы вызов API для отправки через eGov/SMS
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-[#333333]';
    if (score >= 75) return 'text-blue-600';
    return 'text-yellow-700';
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'bg-[#C0F11C] border-[#C0F11C]';
    if (score >= 75) return 'bg-white border-gray-300';
    return 'bg-white border-gray-300';
  };

  return (
    <div className="bento-panel overflow-hidden">
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="brand-mark">
            <UserPlus className="w-5 h-5 text-[#333333]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#333333]">
              {t('offers.title')}
            </h3>
            <p className="text-sm text-gray-500">
              {t('offers.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Фильтр по минимальному баллу */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">{t('offers.minScore')}</label>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#C0F11C]"
            >
              <option value={90}>90+</option>
              <option value={85}>85+</option>
              <option value={80}>80+</option>
              <option value={75}>75+</option>
              <option value={70}>70+</option>
            </select>
          </div>

          <button
            onClick={fetchOffers}
            disabled={loading}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="p-5">
        {loading && offers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-[#333333] gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {t('offers.noFarmers', { minScore })}
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer, index) => (
              <div
                key={`${offer.farmer_name}-${index}`}
                className={`border-b border-gray-200 p-4 transition-colors last:border-b-0 ${
                  sentOffers.has(offer.farmer_name)
                    ? 'bg-[#C0F11C]/20 border-[#C0F11C]/40'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
                  {/* Информация о фермере */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-[#333333] font-medium truncate">
                        {offer.farmer_name}
                      </h4>
                      <div className={`px-2.5 py-0.5 rounded-full text-sm font-medium border ${getScoreBg(offer.predicted_merit_score)}`}>
                        <span className={getScoreColor(offer.predicted_merit_score)}>
                          {offer.predicted_merit_score.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {offer.region}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-3.5 h-3.5" />
                        {offer.direction}
                      </span>
                      <span className="flex items-center gap-1">
                        <Leaf className="w-3.5 h-3.5" />
                        {offer.pasture_area_ha.toLocaleString('ru-RU')} га
                      </span>
                      <span className="flex items-center gap-1">
                        🐄 {offer.current_head_count.toLocaleString('ru-RU')} {t('offers.heads')}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {t('offers.mortality')} {offer.historical_mortality_rate}%
                      </span>
                    </div>

                    <p className="text-sm text-[#333333]">
                      {offer.recommendation_text}
                    </p>
                  </div>

                  {/* Кнопка отправки */}
                  <div className="flex-shrink-0">
                    {sentOffers.has(offer.farmer_name) ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#C0F11C]/20 text-[#333333] rounded-xl text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('offers.sent')}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSendOffer(offer.farmer_name)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#C0F11C] hover:brightness-95 text-[#333333] rounded-xl text-sm font-medium transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        {t('offers.send')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Подвал с информацией */}
      <div className="px-5 py-3 border-t border-gray-200 bg-white">
        <p className="text-xs text-gray-400 text-center">
          {t('offers.hint')}
        </p>
      </div>
    </div>
  );
}
