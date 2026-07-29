import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { Scale, TrendingUp, TrendingDown, AlertTriangle, Users, Loader2, Zap } from 'lucide-react';
import { getFifoVsMerit } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';
import type { FifoVsMeritResponse } from '../types';
import ExpandableChart from './ExpandableChart';

/** Парсер ввода: юзер пишет "1.5 млрд" / "500 млн" / "1500000000" */
function parseBudgetInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const trlnMatch = s.match(/^([\d.,]+)\s*трлн/);
  if (trlnMatch) {
    const n = parseFloat(trlnMatch[1].replace(',', '.'));
    return isNaN(n) ? null : Math.round(n * 1_000_000_000_000);
  }
  const mlrdMatch = s.match(/^([\d.,]+)\s*млрд/);
  if (mlrdMatch) {
    const n = parseFloat(mlrdMatch[1].replace(',', '.'));
    return isNaN(n) ? null : Math.round(n * 1_000_000_000);
  }
  const mlnMatch = s.match(/^([\d.,]+)\s*млн/);
  if (mlnMatch) {
    const n = parseFloat(mlnMatch[1].replace(',', '.'));
    return isNaN(n) ? null : Math.round(n * 1_000_000);
  }
  const cleaned = s.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
}

/** Бюджетные пресеты (тенге) */
const BUDGET_PRESETS = [
  { label: '500 млн', value: 500_000_000 },
  { label: '1 млрд', value: 1_000_000_000 },
  { label: '5 млрд', value: 5_000_000_000 },
  { label: '100 млрд', value: 100_000_000_000 },
  { label: '1 трлн', value: 1_000_000_000_000 },
];

/** Метрика-сравнение: название, FIFO-значение, Merit-значение, формат */
interface MetricRow {
  label: string;
  fifo: string;
  merit: string;
  meritWins: boolean;
  icon: typeof TrendingUp;
  delta: string;
}

export default function FifoVsMerit() {
  const { t } = useTranslation();
  const [budget, setBudget] = useState(1_000_000_000);
  const [inputValue, setInputValue] = useState('1 000 000 000');
  const [data, setData] = useState<FifoVsMeritResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
  }

  function commitInput() {
    const parsed = parseBudgetInput(inputValue);
    if (parsed && parsed >= 100_000_000 && parsed <= 200_000_000_000_000) {
      setBudget(parsed);
      setInputValue(parsed.toLocaleString('ru-RU'));
    } else {
      setInputValue(budget.toLocaleString('ru-RU'));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commitInput();
      inputRef.current?.blur();
    }
  }

  function selectPreset(value: number) {
    setBudget(value);
    setInputValue(value.toLocaleString('ru-RU'));
  }

  // Загружаем данные с дебаунсом при изменении бюджета
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError(null);
      getFifoVsMerit(budget)
        .then(setData)
        .catch(() => setError(t('fifo.error')))
        .finally(() => setLoading(false));
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget]);

  // Метрики для таблицы сравнения
  const metrics: MetricRow[] = data
    ? [
        {
          label: t('fifo.metricFunded'),
          fifo: data.fifo.funded_count.toLocaleString('ru-RU'),
          merit: data.merit.funded_count.toLocaleString('ru-RU'),
          meritWins: data.merit.funded_count >= data.fifo.funded_count,
          icon: Users,
          delta: data.merit.funded_count >= data.fifo.funded_count
            ? `+${data.merit.funded_count - data.fifo.funded_count}`
            : `${data.merit.funded_count - data.fifo.funded_count}`,
        },
        {
          label: t('fifo.metricAvgScore'),
          fifo: data.fifo.avg_score.toFixed(1),
          merit: data.merit.avg_score.toFixed(1),
          meritWins: data.merit.avg_score > data.fifo.avg_score,
          icon: TrendingUp,
          delta: `+${data.score_improvement.toFixed(1)}`,
        },
        {
          label: t('fifo.metricMedian'),
          fifo: data.fifo.median_score.toFixed(1),
          merit: data.merit.median_score.toFixed(1),
          meritWins: data.merit.median_score > data.fifo.median_score,
          icon: TrendingUp,
          delta: `+${(data.merit.median_score - data.fifo.median_score).toFixed(1)}`,
        },
        {
          label: t('fifo.metricAnomalies'),
          fifo: data.fifo.anomaly_count.toLocaleString('ru-RU'),
          merit: data.merit.anomaly_count.toLocaleString('ru-RU'),
          meritWins: data.merit.anomaly_count < data.fifo.anomaly_count,
          icon: AlertTriangle,
          delta: data.anomaly_reduction > 0 ? `−${data.anomaly_reduction}` : '0',
        },
        {
          label: t('fifo.metricCoops'),
          fifo: `${data.fifo.coop_pct}%`,
          merit: `${data.merit.coop_pct}%`,
          meritWins: data.merit.coop_pct > data.fifo.coop_pct,
          icon: Users,
          delta: data.coop_improvement > 0 ? `+${data.coop_improvement} п.п.` : `${data.coop_improvement} п.п.`,
        },
        {
          label: t('fifo.metricScale'),
          fifo: data.fifo.avg_head_count.toFixed(0),
          merit: data.merit.avg_head_count.toFixed(0),
          meritWins: data.merit.avg_head_count > data.fifo.avg_head_count,
          icon: TrendingUp,
          delta: `+${(data.merit.avg_head_count - data.fifo.avg_head_count).toFixed(0)}`,
        },
      ]
    : [];

  // Данные для радарного графика (нормализованные 0-100)
  const radarData = data
    ? [
        {
          metric: t('fifo.radarQuality'),
          fifo: data.fifo.avg_score,
          merit: data.merit.avg_score,
        },
        {
          metric: t('fifo.radarQuantity'),
          fifo: Math.min(100, (data.fifo.funded_count / Math.max(data.merit.funded_count, 1)) * 100),
          merit: 100,
        },
        {
          metric: t('fifo.radarSafety'),
          fifo: Math.max(0, 100 - data.fifo.anomaly_count * 2),
          merit: Math.max(0, 100 - data.merit.anomaly_count * 2),
        },
        {
          metric: t('fifo.radarCoops'),
          fifo: data.fifo.coop_pct * 5,
          merit: data.merit.coop_pct * 5,
        },
        {
          metric: t('fifo.radarScale'),
          fifo: Math.min(100, data.fifo.avg_head_count / 5),
          merit: Math.min(100, data.merit.avg_head_count / 5),
        },
      ]
    : [];

  // Гистограммы баллов для обоих подходов
  const histogramData = data
    ? data.fifo.score_histogram.map((bin, i) => ({
        range: bin.range,
        fifo: bin.count,
        merit: data.merit.score_histogram[i]?.count || 0,
      }))
    : [];

  return (
    <div className="bento-panel overflow-hidden">
      {/* Хедер с заголовком и бюджетом */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 rounded-2xl border border-gray-200">
              <Scale className="w-6 h-6 text-[#333333]" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#333333] flex items-center gap-2">
                {t('fifo.title')}
                <span className="text-xs px-2 py-0.5 bg-[#C0F11C] text-[#333333] rounded-full font-medium">
                  {t('fifo.badge')}
                </span>
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {t('fifo.subtitle')}
              </p>
            </div>
          </div>

          {/* Бюджетные пресеты */}
          <div className="flex flex-wrap items-center gap-2">
            {BUDGET_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => selectPreset(p.value)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  budget === p.value
                    ? 'bg-[#C0F11C] text-[#333333] shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ввод бюджета */}
        <div className="mt-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-gray-500">{t('fifo.budget')}:</span>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={commitInput}
                onKeyDown={handleKeyDown}
                onFocus={() => inputRef.current?.select()}
                placeholder="1 000 000 000"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-2xl font-bold text-[#333333] tabular-nums placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C0F11C] focus:border-transparent transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">тг</span>
            </div>
            <p className="text-xs text-gray-400">
              {t('budget.inputHint')}
            </p>
          </div>
        </div>
      </div>

      {/* Основное содержимое */}
      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {t('fifo.loading')}
          </div>
        )}

        {error && (
          <div className="text-[#333333] text-sm text-center py-8">{error}</div>
        )}

        {!loading && !error && data && (
          <>
            {/* Хедлайн: прирост среднего балла */}
            <div className="flex items-center justify-center gap-6 mb-6 py-4 bg-white border border-gray-200 rounded-2xl">
              <Zap className="w-8 h-8 text-[#333333]" />
              <div className="text-center">
                <div className="text-3xl font-black text-[#333333]">
                  +{data.score_improvement.toFixed(1)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {t('fifo.scoreImprovement')}
                </div>
              </div>
              <div className="text-center border-l border-gray-200 pl-6">
                <div className="text-3xl font-black text-[#333333]">
                  −{data.anomaly_reduction}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {t('fifo.anomalyReduction')}
                </div>
              </div>
            </div>

            {/* Двухколоночная таблица сравнения */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-0 mb-6">
              {/* Заголовки */}
              <div className="text-center pb-3 border-b border-gray-200">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#DC2626] rounded-xl">
                  <TrendingDown className="w-4 h-4 text-[#333333]" />
                  <span className="text-sm font-bold text-[#333333]">{t('fifo.headerFifo')}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1.5">{t('fifo.descFifo')}</div>
              </div>
              <div className="pb-3 border-b border-gray-200 flex items-center px-4">
                <span className="text-xs text-gray-400 font-medium">VS</span>
              </div>
              <div className="text-center pb-3 border-b border-gray-200">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#C0F11C] border border-[#C0F11C] rounded-xl">
                  <TrendingUp className="w-4 h-4 text-[#333333]" />
                  <span className="text-sm font-bold text-[#333333]">{t('fifo.headerMerit')}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1.5">{t('fifo.descMerit')}</div>
              </div>

              {/* Ряды метрик */}
              {metrics.map((m, i) => (
                <MetricComparisonRow key={m.label} metric={m} index={i} />
              ))}
            </div>

            {/* Нижний блок: Радар + Гистограмма */}
            <div className="grid grid-cols-2 gap-6">
              {/* Радарный график */}
              <div className="bg-gray-100 rounded-2xl p-4">
                <h4 className="text-sm font-extrabold text-[#333333] mb-3">{t('fifo.qualityProfile')}</h4>
                <ExpandableChart title={t('fifo.qualityProfile')} minHeight="min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fill: '#9ca3af', fontSize: 16 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                      />
                      <Radar
                        name="FIFO"
                        dataKey="fifo"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                      <Radar
                        name="Merit"
                        dataKey="merit"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: '#080000',
                          fontSize: 16,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        }}
                        labelStyle={{ color: '#080000', fontWeight: 700 }}
                        itemStyle={{ color: '#080000' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </ExpandableChart>
                <div className="flex items-center justify-center gap-6 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-3 h-1 bg-red-500 rounded" /> FIFO
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-3 h-1 bg-[#C0F11C] rounded" /> Merit
                  </span>
                </div>
              </div>

              {/* Гистограмма баллов */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <h4 className="text-sm font-extrabold text-[#333333] mb-3">{t('fifo.scoreDistribution')}</h4>
                <ExpandableChart title={t('fifo.scoreDistribution')} minHeight="min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                      <XAxis
                        dataKey="range"
                        tick={{ fill: '#9ca3af', fontSize: 16 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 16 }}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: '#080000',
                          fontSize: 16,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        }}
                        labelStyle={{ color: '#080000', fontWeight: 700 }}
                        itemStyle={{ color: '#080000' }}
                      />
                      <Bar dataKey="fifo" name="FIFO" fill="#ef4444" fillOpacity={0.6} radius={[4, 4, 0, 0]} barSize={30} />
                      <Bar dataKey="merit" name="Merit" fill="#C0F11C" fillOpacity={0.8} radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </ExpandableChart>
                <div className="flex items-center justify-center gap-6 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-3 h-0.5 bg-red-500 rounded" /> FIFO
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-3 h-0.5 bg-[#C0F11C] rounded" /> Merit
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Один ряд сравнительной таблицы — FIFO | label | Merit */
function MetricComparisonRow({ metric, index }: { metric: MetricRow; index: number }) {
  const Icon = metric.icon;
  const isEven = index % 2 === 0;

  return (
    <>
      {/* FIFO значение */}
      <div className={`text-center py-3 ${isEven ? 'bg-gray-50' : ''}`}>
        <span className={`text-lg font-bold ${metric.meritWins ? 'text-gray-500' : 'text-emerald-400'}`}>
          {metric.fifo}
        </span>
      </div>

      {/* Метка + дельта */}
      <div className={`flex flex-col items-center justify-center px-4 py-3 ${isEven ? 'bg-gray-50' : ''}`}>
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500 whitespace-nowrap">{metric.label}</span>
        </div>
        {metric.meritWins && (
          <span className="text-[10px] font-bold text-emerald-400 mt-0.5">{metric.delta}</span>
        )}
      </div>

      {/* Merit значение */}
      <div className={`text-center py-3 ${isEven ? 'bg-gray-50' : ''}`}>
        <span className={`text-lg font-bold ${metric.meritWins ? 'text-emerald-400' : 'text-gray-500'}`}>
          {metric.merit}
        </span>
        {metric.meritWins && (
          <span className="ml-2 text-[10px] text-emerald-500 align-super">WIN</span>
        )}
      </div>
    </>
  );
}
