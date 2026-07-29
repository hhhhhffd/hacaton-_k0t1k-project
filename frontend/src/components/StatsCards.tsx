import { useTranslation } from '../i18n/useTranslation';
import type { StatsResponse } from '../types';

interface StatsCardsProps {
  stats: StatsResponse;
}

/** Ряд из 4 карточек статистики для страницы аналитики */
export default function StatsCards({ stats }: StatsCardsProps) {
  const { t } = useTranslation();
  const redCount = stats.anomaly_counts['red'] || 0;
  const yellowCount = stats.anomaly_counts['yellow'] || 0;
  const anomalyCount = redCount + yellowCount;
  const greenCount = stats.anomaly_counts['green'] || 0;
  const total = Math.max(stats.total_applications, 1);

  const cards = [
    {
      title: t('analytics.totalApps'),
      value: stats.total_applications.toLocaleString('ru-RU'),
      subtitle: `${stats.scored_applications.toLocaleString('ru-RU')} ${t('stats.scored').toLowerCase()}`,
      panelCls: 'col-span-4 bg-[#C0F11C] border-[#a8d400]',
    },
    {
      title: t('analytics.avgScore'),
      value: stats.avg_score !== null ? stats.avg_score.toFixed(1) : '—',
      subtitle: t('stats.outOf100'),
      panelCls: 'col-span-3',
    },
    {
      title: t('analytics.lowRisk'),
      value: greenCount.toLocaleString('ru-RU'),
      subtitle: `${((greenCount / total) * 100).toFixed(0)}% ${t('stats.ofTotal')}`,
      panelCls: 'col-span-2',
    },
    {
      title: t('analytics.anomalies'),
      value: anomalyCount.toLocaleString('ru-RU'),
      subtitle: `${((anomalyCount / total) * 100).toFixed(1)}% ${t('stats.ofTotal')}`,
      panelCls: 'col-span-3',
    },
  ];

  return (
    <div className="bento-grid">
      {cards.map((card) => (
        <div key={card.title} className={`bento-panel min-h-32 p-4 sm:p-5 ${card.panelCls}`}>
          <div className="flex h-full flex-col justify-between">
            <p className="data-label">{card.title}</p>
            <div>
              <p className="data-value mt-3 text-3xl font-extrabold sm:text-4xl">{card.value}</p>
              {card.subtitle && <p className="mt-1 text-xs text-gray-500">{card.subtitle}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
