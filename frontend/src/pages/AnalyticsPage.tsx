import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import { Loader2, FileText, Copy, Check, X } from 'lucide-react';
import Header from '../components/Header';
import StatsCards from '../components/StatsCards';
import WeightSimulator from '../components/WeightSimulator';
import EmptyState from '../components/EmptyState';
import ExpandableChart from '../components/ExpandableChart';
import { useTranslation } from '../i18n/useTranslation';
import { useAppStore } from '../store/appStore';
import { getTransparencyReport } from '../services/api';

/** Страница аналитики — StatsCards + Weight Simulator + SHAP + графики */
export default function AnalyticsPage() {
  const { t, language } = useTranslation();
  const { stats, fetchStats, statsLoading, statsError } = useAppStore();
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const [reportText, setReportText] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerateReport() {
    setReportLoading(true);
    setReportText(null);
    try {
      const result = await getTransparencyReport(language);
      setReportText(result.report);
    } finally {
      setReportLoading(false);
    }
  }

  function handleCopy() {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Распределение баллов — горизонтальный бар-чарт
  const scoreDistData = stats
    ? Object.entries(stats.score_distribution).map(([range, count]) => ({
        range,
        count,
      }))
    : [];

  // Риск-уровни для пирога
  const riskData = stats
    ? [
        { name: t('risk.green'), value: stats.anomaly_counts['green'] || 0, color: '#10b981' },
        { name: t('risk.yellow'), value: stats.anomaly_counts['yellow'] || 0, color: '#f59e0b' },
        { name: t('risk.red'), value: stats.anomaly_counts['red'] || 0, color: '#ef4444' },
      ].filter((d) => d.value > 0)
    : [];

  // Топ регионов
  const regionData = stats
    ? stats.top_regions.map((r) => ({
        name: String(r.region).replace('область ', '').substring(0, 18),
        avg_score: r.avg_score,
        count: r.count,
      }))
    : [];

  // Цвета распределения баллов (красный → зелёный)
  const distColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

  return (
    <>
      <Header title={t('analytics.title')} />

      <div className="flex-1 p-5 space-y-4 overflow-y-auto">
        {/* Сервер недоступен или данных нет */}
        {!statsLoading && !stats && statsError && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <EmptyState kind={statsError === 'unavailable' ? 'unavailable' : 'no_data'} />
          </div>
        )}

        {/* Загрузка */}
        {statsLoading && !stats && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#333333]" />
            {t('common.loading')}
          </div>
        )}

        {/* Контент */}
        {stats && (
          <>
            {/* 1. Карточки статистики */}
            <StatsCards stats={stats} />

            {/* 2. Симулятор весов — на всю ширину */}
            <WeightSimulator />

            {/* 3. Графики: распределение, риски, регионы */}
            <div className="grid grid-cols-3 gap-5">
              {/* Распределение баллов — горизонтальный бар */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h3 className="text-sm font-extrabold text-[#333333] tracking-tight mb-1">{t('analytics.scoreDistribution')}</h3>
                <p className="text-xs text-gray-400 mb-4">{t('analytics.scoreDistSubtitle')}</p>
                {scoreDistData.length > 0 ? (
                  <ExpandableChart title={t('analytics.scoreDistribution')} minHeight="min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={scoreDistData}
                        layout="vertical"
                        margin={{ left: 10, right: 40, top: 5, bottom: 5 }}
                      >
                        <XAxis
                          type="number"
                          tick={{ fill: '#9ca3af', fontSize: 14 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}к` : String(v)}
                        />
                        <YAxis
                          type="category"
                          dataKey="range"
                          tick={{ fill: '#374151', fontSize: 14 }}
                          axisLine={false}
                          tickLine={false}
                          width={45}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            color: '#080000',
                            fontSize: 14,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          }}
                          labelStyle={{ color: '#080000', fontWeight: 700 }}
                          itemStyle={{ color: '#080000' }}
                          // @ts-expect-error recharts Formatter type mismatch
                          formatter={(value: number) => [value.toLocaleString('ru-RU'), t('analytics.applicationsCount')]}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                          {scoreDistData.map((_, index) => (
                            <Cell
                              key={`dist-${index}`}
                              fill={distColors[index] || '#6366f1'}
                              fillOpacity={0.85}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                ) : (
                  <p className="text-sm text-gray-400 py-8 text-center">{t('table.noData')}</p>
                )}
              </div>

              {/* Уровни риска — пирог */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h3 className="text-sm font-extrabold text-[#333333] tracking-tight mb-4">{t('dashboard.anomalies')}</h3>
                {riskData.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                    <ExpandableChart title={t('dashboard.anomalies')} minHeight="min-h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={riskData}
                            cx="50%"
                            cy="50%"
                            innerRadius="45%"
                            outerRadius="80%"
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {riskData.map((entry, index) => (
                              <Cell key={`risk-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '8px',
                              color: '#f1f5f9',
                              fontSize: 16,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                            }}
                            // @ts-expect-error recharts Formatter type mismatch
                            formatter={(value: number, name: string) => [value.toLocaleString('ru-RU'), name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </ExpandableChart>
                    </div>
                    <div className="space-y-2.5 shrink-0">
                      {riskData.map((item) => (
                        <div key={item.name} className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-gray-600">{item.name}</span>
                          <span className="text-sm font-bold text-[#333333]">{item.value.toLocaleString('ru-RU')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-8 text-center">{t('table.noData')}</p>
                )}
              </div>

              {/* Топ регионов */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h3 className="text-sm font-extrabold text-[#333333] tracking-tight mb-4">{t('analytics.regionStats')}</h3>
                {regionData.length > 0 ? (
                  <ExpandableChart title={t('analytics.regionStats')} minHeight="min-h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={regionData} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 14 }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: '#374151', fontSize: 14 }}
                          axisLine={false}
                          tickLine={false}
                          width={145}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            color: '#080000',
                            fontSize: 14,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          }}
                          // @ts-expect-error recharts Formatter type mismatch
                          formatter={(value: number) => [`${value.toFixed(1)}`, t('analytics.avgScore')]}
                        />
                        <Bar dataKey="avg_score" radius={[0, 4, 4, 0]} fill="#C0F11C" fillOpacity={0.9} barSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                ) : (
                  <p className="text-sm text-gray-400 py-8 text-center">{t('table.noData')}</p>
                )}
              </div>
            </div>
            {/* Кнопка отчёта для СМИ (Task 5) */}
            <div className="flex justify-end">
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#C0F11C] text-[#333333] hover:brightness-95 font-bold text-sm rounded-xl transition-all disabled:opacity-60"
              >
                {reportLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <FileText className="w-4 h-4" />}
                {reportLoading ? t('analytics.transparencyGenerating') : t('analytics.transparencyReportBtn')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Модальное окно с отчётом (Task 5) */}
      {reportText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setReportText(null)}
        >
          <div
            className="bg-white border border-gray-200 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#C0F11C] rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#333333]" />
                </div>
                <h3 className="text-base font-extrabold text-[#333333]">{t('analytics.transparencyReportTitle')}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:text-[#333333] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? t('analytics.transparencyReportCopied') : t('analytics.transparencyReportCopy')}
                </button>
                <button
                  onClick={() => setReportText(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-[#333333] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">{reportText}</pre>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
