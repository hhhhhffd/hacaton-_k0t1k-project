import { BarChart3, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
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
      icon: BarChart3,
      title: t('analytics.totalApps'),
      value: stats.total_applications.toLocaleString('ru-RU'),
      subtitle: `${stats.scored_applications.toLocaleString('ru-RU')} ${t('stats.scored').toLowerCase()}`,
      iconCls: 'bg-[#C0F11C] text-[#333333]',
    },
    {
      icon: TrendingUp,
      title: t('analytics.avgScore'),
      value: stats.avg_score !== null ? stats.avg_score.toFixed(1) : '—',
      subtitle: t('stats.outOf100'),
      iconCls: 'bg-[#C0F11C] text-[#333333]',
    },
    {
      icon: ShieldCheck,
      title: t('analytics.lowRisk'),
      value: greenCount.toLocaleString('ru-RU'),
      subtitle: `${((greenCount / total) * 100).toFixed(0)}% ${t('stats.ofTotal')}`,
      iconCls: 'bg-[#C0F11C] text-[#333333]',
    },
    {
      icon: AlertTriangle,
      title: t('analytics.anomalies'),
      value: anomalyCount.toLocaleString('ru-RU'),
      subtitle: `${((anomalyCount / total) * 100).toFixed(1)}% ${t('stats.ofTotal')}`,
      iconCls: 'bg-[#C0F11C] text-[#333333]',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.title} className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 mb-1">{card.title}</p>
              <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{card.value}</p>
              {card.subtitle && <p className="text-sm text-gray-400 mt-1">{card.subtitle}</p>}
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3 ${card.iconCls}`}>
              <card.icon className="w-5 h-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
