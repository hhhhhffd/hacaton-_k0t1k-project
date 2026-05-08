import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Brain, Loader2 } from 'lucide-react';
import { getGlobalShap } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';
import type { GlobalShapResponse } from '../types';
import ExpandableChart from './ExpandableChart';

/** Градиент важности: топ баров получают более насыщенный оттенок лайма */
function getBarColor(index: number): string {
  const opacity = Math.max(0.3, 1 - index * 0.055);
  return `rgba(192, 241, 28, ${opacity})`;
}

export default function GlobalShapChart() {
  const { t } = useTranslation();
  const [data, setData] = useState<GlobalShapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function getFeatureName(key: string): string {
    const translationKey = `feature_${key}`;
    const translated = t(translationKey);
    return translated !== translationKey ? translated : key;
  }

  useEffect(() => {
    getGlobalShap()
      .then(setData)
      .catch(() => setError(t('shap.error')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = data
    ? Object.entries(data.feature_importances)
        .map(([key, value]) => ({
          name: getFeatureName(key),
          importance: Number((value * 100).toFixed(2)),
          raw: value,
        }))
        .filter((d) => d.raw > 0)
        .slice(0, 15)
    : [];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-[#C0F11C] rounded-xl">
          <Brain className="w-5 h-5 text-[#333333]" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-[#333333] tracking-tight">
            {t('shap.title')}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('shap.subtitle')}
            {data && ` (${data.total_samples.toLocaleString('ru-RU')} ${t('shap.applications')})`}
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#333333]" />
          {t('shap.loading')}
        </div>
      )}

      {!loading && chartData.length > 0 && (
        <ExpandableChart title={t('shap.title')} minHeight="min-h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 10, right: 50, top: 10, bottom: 10 }}
            >
              <XAxis
                type="number"
                tick={{ fill: '#9ca3af', fontSize: 14 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#374151', fontSize: 14 }}
                axisLine={false}
                tickLine={false}
                width={260}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: 14,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                labelStyle={{ color: '#080000', fontWeight: 700, marginBottom: 4 }}
                itemStyle={{ color: '#080000' }}
                // @ts-expect-error recharts Formatter type mismatch
                formatter={(value: number) => [`${value.toFixed(2)}%`, t('shap.importance')]}
              />
              <Bar dataKey="importance" radius={[0, 6, 6, 0]} barSize={26}>
                {chartData.map((_, index) => (
                  <Cell
                    key={`shap-${index}`}
                    fill={getBarColor(index)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ExpandableChart>
      )}

      {!loading && error && (
        <div className="text-[#333333] text-sm text-center py-8">{error}</div>
      )}

      {!loading && !error && chartData.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">
          {t('shap.noData')}
        </p>
      )}
    </div>
  );
}
