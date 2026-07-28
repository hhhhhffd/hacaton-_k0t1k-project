import { useState } from 'react';
import { SlidersHorizontal, RefreshCw, ArrowUp, ArrowDown, Minus, Loader2 } from 'lucide-react';
import { simulateWeights } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';
import type { WeightSimResponse } from '../types';
import { fmtTenge } from '../utils/formatters';

/** Конфигурация слайдеров — фичи для симуляции */
const WEIGHT_SLIDERS = [
  { key: 'head_count', icon: '🐄' },
  { key: 'is_cooperative', icon: '🤝' },
  { key: 'subsidy_type_approval_rate', icon: '📊' },
  { key: 'is_breeding', icon: '🧬' },
  { key: 'amount_per_head', icon: '💸' },
  { key: 'amount_vs_region_median', icon: '💰' },
];

export default function WeightSimulator() {
  const { t } = useTranslation();
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(WEIGHT_SLIDERS.map((s) => [s.key, 50])),
  );
  const [result, setResult] = useState<WeightSimResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWeightChange = (key: string, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setWeights(Object.fromEntries(WEIGHT_SLIDERS.map((s) => [s.key, 50])));
    setResult(null);
  };

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await simulateWeights({ weights, top_n: 10 });
      setResult(data);
    } catch {
      setError(t('weight.error'));
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = Object.values(weights).some((v) => v !== 50);

  return (
    <div className="bento-panel overflow-hidden">
      {/* Заголовок */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C0F11C] rounded-xl">
              <SlidersHorizontal className="w-5 h-5 text-[#333333]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#333333] tracking-tight">{t('weight.title')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('weight.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500
              bg-gray-100 rounded-xl hover:bg-gray-200 hover:text-[#333333] transition-all font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('weight.reset')}
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Слайдеры — 3 колонки на всю ширину */}
        <div className="mb-6 grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {WEIGHT_SLIDERS.map((slider) => {
            const value = weights[slider.key];
            const isDefault = value === 50;
            const isHigh = value > 60;
            const isLow = value < 40;

            return (
              <div key={slider.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{slider.icon}</span>
                    <span className="text-sm font-semibold text-[#333333]">{t(`featureLabels.${slider.key}`)}</span>
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      isHigh ? 'text-[#333333]' : isLow ? 'text-[#333333]' : 'text-gray-400'
                    }`}
                  >
                    {value}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={value}
                  onChange={(e) => handleWeightChange(slider.key, Number(e.target.value))}
                  className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-all
                    ${isHigh ? 'bg-[#C0F11C]' : isLow ? 'bg-gray-300' : 'bg-gray-200'}
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                    ${isHigh
                      ? '[&::-webkit-slider-thumb]:bg-[#080000] [&::-webkit-slider-thumb]:shadow-black/20'
                      : isLow
                        ? '[&::-webkit-slider-thumb]:bg-gray-500 [&::-webkit-slider-thumb]:shadow-gray-500/30'
                        : '[&::-webkit-slider-thumb]:bg-gray-400 [&::-webkit-slider-thumb]:shadow-gray-400/30'}
                    [&::-webkit-slider-thumb]:shadow-lg`}
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>{t('weight.low')}</span>
                  {isDefault && <span className="text-gray-400">{t('weight.default')}</span>}
                  <span>{t('weight.high')}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Кнопка пересчёта */}
        <button
          onClick={handleSimulate}
          disabled={loading}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            hasChanges
              ? 'bg-[#C0F11C] text-[#333333] hover:brightness-95'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('weight.recalculating')}
            </>
          ) : (
            <>
              <SlidersHorizontal className="w-4 h-4" />
              {t('weight.recalculate')}
            </>
          )}
        </button>

        {error && (
          <div className="text-[#333333] text-sm text-center mt-3">{error}</div>
        )}

        {/* Результаты */}
        {result && (
          <div className="mt-6 space-y-4">
            {/* Сводка */}
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-[#C0F11C]/10 border border-[#C0F11C]/30 rounded-xl p-3 text-center">
                <div className="text-xl font-extrabold text-[#333333]">
                  {result.avg_score_change > 0 ? '+' : ''}{result.avg_score_change.toFixed(1)}
                </div>
                <div className="text-[10px] text-gray-500">{t('weight.avgShift')}</div>
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                <div className="text-xl font-extrabold text-[#333333]">
                  {result.total_reshuffle}
                </div>
                <div className="text-[10px] text-gray-500">{t('weight.reshuffled')}</div>
              </div>
            </div>

            {/* Таблица топ-10 */}
            <div>
              <h4 className="text-sm font-extrabold text-[#333333] mb-2 tracking-tight">
                {t('weight.topTitle')}
              </h4>
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-2 px-3 text-gray-400 font-extrabold text-[11px] uppercase">#</th>
                      <th className="text-left py-2 px-3 text-gray-400 font-extrabold text-[11px] uppercase">{t('weight.colRegion')}</th>
                      <th className="text-left py-2 px-3 text-gray-400 font-extrabold text-[11px] uppercase">{t('weight.colDirection')}</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-extrabold text-[11px] uppercase">{t('weight.colAmount')}</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-extrabold text-[11px] uppercase">{t('weight.colWas')}</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-extrabold text-[11px] uppercase">{t('weight.colNow')}</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-extrabold text-[11px] uppercase">{t('weight.colRank')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.top_applications.map((app, i) => (
                      <tr
                        key={app.id}
                        className={`border-t border-gray-100 ${
                          i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                      >
                        <td className="py-2 px-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="py-2 px-3 text-[#333333] font-medium text-xs max-w-[120px]">
                          <span className="block truncate" title={app.region}>
                            {app.region.replace(/\s*область\s*/i, '')}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500 text-xs max-w-[140px]">
                          <span className="block truncate" title={app.direction}>
                            {app.direction}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-[#333333] font-medium tabular-nums text-xs">
                          {fmtTenge(app.amount)} тг
                        </td>
                        <td className="py-2 px-3 text-right text-gray-400 tabular-nums text-xs">
                          {app.original_score.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right font-extrabold tabular-nums text-[#333333] text-xs">
                          {app.new_score.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <RankChange change={app.rank_change} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Бейдж изменения ранга: ↑ зелёный, ↓ красный, — серый */
function RankChange({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#333333]">
        <ArrowUp className="w-3 h-3" />
        {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#333333]">
        <ArrowDown className="w-3 h-3" />
        {Math.abs(change)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs text-gray-400">
      <Minus className="w-3 h-3" />
    </span>
  );
}
