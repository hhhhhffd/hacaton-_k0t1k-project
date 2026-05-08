import { X, Scale } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import type { Application } from '../types';
import { fmtAmount } from '../utils/formatters';

interface CompareModalProps {
  apps: Application[];
  onClose: () => void;
}

/** Модальное окно сравнения N заявок */
export default function CompareModal({ apps, onClose }: CompareModalProps) {
  const { t } = useTranslation();

  type Direction = 'higher' | 'lower';

  interface Metric {
    label: string;
    values: (string | number | null)[];
    nums: (number | null)[];
    direction: Direction;
  }

  const riskOrder = { green: 3, yellow: 2, red: 1 };

  const metrics: Metric[] = [
    {
      label: t('compare.score'),
      values: apps.map(a => a.merit_score?.toFixed(1) ?? '—'),
      nums: apps.map(a => a.merit_score ?? null),
      direction: 'higher',
    },
    {
      label: t('compare.amount'),
      values: apps.map(a => fmtAmount(a.amount) + ' ₸'),
      nums: apps.map(a => a.amount ?? null),
      direction: 'lower',
    },
    {
      label: t('compare.pasture'),
      values: apps.map(a => a.pasture_area_ha ? `${a.pasture_area_ha.toLocaleString('ru-RU')} га` : '—'),
      nums: apps.map(a => a.pasture_area_ha ?? null),
      direction: 'higher',
    },
    {
      label: t('compare.heads'),
      values: apps.map(a => a.current_head_count ? `${a.current_head_count.toLocaleString('ru-RU')} гол.` : '—'),
      nums: apps.map(a => a.current_head_count ?? null),
      direction: 'higher',
    },
    {
      label: t('compare.mortality'),
      values: apps.map(a => a.historical_mortality_rate != null ? `${a.historical_mortality_rate.toFixed(1)}%` : '—'),
      nums: apps.map(a => a.historical_mortality_rate ?? null),
      direction: 'lower',
    },
    {
      label: t('compare.risk'),
      values: apps.map(a => t(`risk.${a.risk_level || 'green'}`)),
      nums: apps.map(a => riskOrder[(a.risk_level as keyof typeof riskOrder) || 'green'] || 0),
      direction: 'higher',
    },
  ];

  // Для каждой метрики находим лучшее значение и отмечаем победителей
  function getBestIndices(nums: (number | null)[], direction: Direction): Set<number> {
    const valid = nums.map((n, i) => ({ n, i })).filter(x => x.n !== null);
    if (valid.length === 0) return new Set();
    const best = direction === 'higher'
      ? Math.max(...valid.map(x => x.n as number))
      : Math.min(...valid.map(x => x.n as number));
    return new Set(valid.filter(x => x.n === best).map(x => x.i));
  }

  // Победитель — кто набрал больше всего "лучших" метрик
  const winCounts = new Array(apps.length).fill(0);
  const bestSets = metrics.map(m => {
    const s = getBestIndices(m.nums, m.direction);
    s.forEach(i => winCounts[i]++);
    return s;
  });
  const maxWins = Math.max(...winCounts);
  const winners = new Set(winCounts.map((c, i) => c === maxWins ? i : -1).filter(i => i !== -1));

  const n = apps.length;
  // Для широких таблиц используем горизонтальный скролл
  const colWidth = Math.max(120, Math.min(200, 600 / n));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white border border-gray-200 rounded-2xl max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl shadow-black/10"
        style={{ width: Math.min(160 + n * colWidth + 32, window.innerWidth * 0.95) }}
        onClick={e => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#C0F11C] rounded-xl flex items-center justify-center">
              <Scale className="w-5 h-5 text-[#333333]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#333333]">{t('compare.title')}</h3>
              <p className="text-xs text-gray-400">{n} {t('compare.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-[#333333]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Контент со скроллом */}
        <div className="overflow-auto p-6">
          {/* Заголовки приложений */}
          <div
            className="grid gap-3 mb-4"
            style={{ gridTemplateColumns: `160px repeat(${n}, ${colWidth}px)` }}
          >
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider self-center">
              {t('compare.metric')}
            </div>
            {apps.map((app, i) => (
              <div
                key={app.id}
                className={`text-center p-3 rounded-2xl border ${winners.has(i) ? 'bg-[#C0F11C]/20 border-[#C0F11C]/40' : 'bg-gray-50 border-gray-200'}`}
              >
                <p className="text-xs text-gray-500 mb-0.5">#{app.sequential_number}</p>
                <p className="text-sm font-semibold text-[#333333] truncate">{app.farm_district}</p>
                <p className="text-xs text-gray-400 truncate">{app.direction}</p>
                {winners.has(i) && winners.size === 1 && (
                  <span className="text-xs text-[#333333] font-bold mt-1 block">🏆 {t('compare.winner')}</span>
                )}
              </div>
            ))}
          </div>

          {/* Строки метрик */}
          <div className="space-y-2">
            {metrics.map((metric, mi) => (
              <div
                key={mi}
                className="grid gap-3 items-center"
                style={{ gridTemplateColumns: `160px repeat(${n}, ${colWidth}px)` }}
              >
                <div className="text-sm text-gray-500 pr-2">{metric.label}</div>
                {apps.map((_, i) => {
                  const isBest = bestSets[mi].has(i);
                  return (
                    <div
                      key={i}
                      className={`text-center p-2 rounded-xl text-sm font-medium ${
                        isBest
                          ? 'bg-[#C0F11C]/20 text-[#333333] font-bold'
                          : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      {String(metric.values[i])}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Итог */}
          <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center text-sm text-[#333333]">
            {winners.size === apps.length ? (
              t('compare.tie')
            ) : (
              <>
                {[...winners].map(i => (
                  <span key={i} className="font-bold">#{apps[i].sequential_number} </span>
                ))}
                {t('compare.winsBy')}{' '}
                <span className="font-bold">{maxWins} {t('compare.metrics')}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
