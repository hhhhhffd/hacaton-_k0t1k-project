import { useEffect, useState, useCallback, useRef } from 'react';
import {
  X,
  Loader2,
  Brain,
  AlertTriangle,
  TrendingUp,
  Shield,
  FileX,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { streamExplanation, getApplication, downloadRefusalPdf } from '../services/api';
import { useTranslation } from '../i18n/useTranslation';
import type { Application } from '../types';
import { fmtAmount } from '../utils/formatters';
import ExpandableChart from './ExpandableChart';

interface ExplainabilityModalProps {
  applicationId: number | null;
  onClose: () => void;
}

/** Модальное окно с SHAP-графиком и стриминговым LLM-объяснением */
export default function ExplainabilityModal({ applicationId, onClose }: ExplainabilityModalProps) {
  const { t, language } = useTranslation();
  const [appData, setAppData] = useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [shapValues, setShapValues] = useState<Record<string, number>>({});
  const [meritScore, setMeritScore] = useState<number>(0);
  const [riskLevel, setRiskLevel] = useState<string>('green');
  const [shapReady, setShapReady] = useState(false);

  const [hardRules, setHardRules] = useState<Array<{
    rule: string;
    law: string;
    passed: boolean | null;
    value: string;
    required: string;
  }>>([]);

  const [llmText, setLlmText] = useState('');
  const [llmDone, setLlmDone] = useState(false);
  const [llmStreaming, setLlmStreaming] = useState(false);

  const llmCacheRef = useRef<Record<string, string>>({});
  const cancelRef = useRef<(() => void) | null>(null);

  function getFeatureName(key: string): string {
    const translated = t(`feature_${key}`);
    return translated !== `feature_${key}` ? translated : key;
  }

  useEffect(() => {
    if (applicationId === null) {
      setAppData(null);
      setError(null);
      setShapValues({});
      setMeritScore(0);
      setRiskLevel('green');
      setHardRules([]);
      setShapReady(false);
      setLlmText('');
      setLlmDone(false);
      setLlmStreaming(false);
      llmCacheRef.current = {};
      return;
    }

    setError(null);
    setShapValues({});
    setHardRules([]);
    setShapReady(false);
    setLlmText('');
    setLlmDone(false);
    setLlmStreaming(true);
    llmCacheRef.current = {};

    getApplication(applicationId).then(setAppData).catch(() => setAppData(null));

    const initialLang = language;

    const cancel = streamExplanation(
      applicationId,
      language,
      (data) => {
        setShapValues(data.shap_values);
        setMeritScore(data.merit_score);
        setRiskLevel(data.risk_level);
        setHardRules(data.hard_rules_checklist || []);
        setShapReady(true);
      },
      (token) => { setLlmText((prev) => prev + token); },
      () => {
        setLlmDone(true);
        setLlmStreaming(false);
        setLlmText((curr) => { llmCacheRef.current[initialLang] = curr; return curr; });
      },
      (err) => { setError(err); setLlmStreaming(false); },
    );

    cancelRef.current = cancel;
    return () => { cancel(); cancelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  useEffect(() => {
    if (applicationId === null || !shapReady) return;

    if (llmCacheRef.current[language]) {
      setLlmText(llmCacheRef.current[language]);
      setLlmDone(true);
      setLlmStreaming(false);
      return;
    }

    if (cancelRef.current) { cancelRef.current(); }
    setLlmText('');
    setLlmDone(false);
    setLlmStreaming(true);

    const langForCache = language;

    const cancel = streamExplanation(
      applicationId,
      language,
      () => {},
      (token) => setLlmText((prev) => prev + token),
      () => {
        setLlmDone(true);
        setLlmStreaming(false);
        setLlmText((curr) => { llmCacheRef.current[langForCache] = curr; return curr; });
      },
      (err) => { setError(err); setLlmStreaming(false); },
    );

    cancelRef.current = cancel;
    return () => { cancel(); cancelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );

  useEffect(() => {
    if (applicationId !== null) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [applicationId, handleKeyDown]);

  if (applicationId === null) return null;

  const totalAbs = shapReady
    ? Object.values(shapValues).reduce((acc, val) => acc + Math.abs(val), 0) || 1
    : 1;

  const shapChartData = shapReady
    ? Object.entries(shapValues)
        .map(([key, value]) => ({
          name: getFeatureName(key),
          rawName: key,
          value: Number(((value / totalAbs) * 100).toFixed(2)),
        }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 12)
    : [];

  const score = meritScore;
  const scoreColor =
    score >= 70 ? 'text-[#333333]' : score >= 40 ? 'text-amber-700' : 'text-red-700';
  const scoreBg =
    score >= 70
      ? 'border-[#a8d400] bg-[#C0F11C]/20'
      : score >= 40
        ? 'border-amber-200 bg-amber-50'
        : 'border-red-200 bg-red-50';

  const isLoading = !shapReady && !error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bento-panel max-h-[90vh] w-[75vw] min-w-[700px] max-w-[1400px] overflow-y-auto max-lg:w-[95vw] max-lg:min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-200 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#C0F11C] rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-[#333333]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#333333] tracking-tight">{t('explain.title')}</h3>
              {appData && (
                <p className="text-xs text-gray-500">
                  {t('explain.appNumber')}: {appData.application_number}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-[#333333]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Контент */}
        <div className="px-6 py-5 space-y-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#333333]" />
              <p className="text-sm">{t('explain.loading')}</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {shapReady && !isLoading && (
            <>
              {/* LLM объяснение + балл */}
              <div className={`border rounded-2xl p-6 ${scoreBg}`}>
                <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
                  {/* Балл */}
                  <div className={`text-center shrink-0 border-r pr-6 ${score >= 70 ? 'border-[#C0F11C]/40' : score >= 40 ? 'border-yellow-200' : 'border-red-200'}`}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">{t('explain.score')}</p>
                    <p className={`text-4xl font-black tabular-nums ${scoreColor}`}>
                      {score.toFixed(1)}
                    </p>
                  </div>

                  {/* LLM текст */}
                  <div className="flex-1 min-w-0">
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#333333]">
                      <Brain className="w-4 h-4" />
                      {t('explain.llm')}
                      {llmStreaming && <Loader2 className="w-3 h-3 animate-spin" />}
                    </h4>
                    <p className="text-sm font-normal leading-relaxed text-[#333333] sm:text-base">
                      {(llmText || t('explain.loading')).split(/(№\d+|Приказ[а-яА-Я\s]*№\d+|бұйрығы|бұйрық)/g).map((part, i) => {
                        if (/№\d+|Приказ|бұйрық/i.test(part)) {
                          return <span key={i} className="font-semibold text-blue-600">{part}</span>;
                        }
                        return part;
                      })}
                      {llmStreaming && (
                        <span className="ml-1 inline-block h-5 w-1.5 animate-pulse bg-[#333333] align-middle" />
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Правовое обоснование */}
              {llmDone && (llmText.includes('№11064') || llmText.includes('№12488') || llmText.includes('№108') || llmText.includes('бұйрығы')) && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <h4 className="text-xs font-extrabold text-[#333333] mb-3 flex items-center gap-2 uppercase tracking-widest">
                    <Shield className="w-4 h-4" />
                    {t('explain.legalBasis')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    {llmText.includes('№11064') && (
                      <div className="flex items-start gap-2 bg-white rounded-xl p-3 border border-gray-200">
                        <span className="text-[#333333] font-mono font-extrabold text-xs shrink-0">№11064</span>
                        <span className="text-gray-500 text-xs">{t('explain.law11064')}</span>
                      </div>
                    )}
                    {llmText.includes('№12488') && (
                      <div className="flex items-start gap-2 bg-white rounded-xl p-3 border border-gray-200">
                        <span className="text-[#333333] font-mono font-extrabold text-xs shrink-0">№12488</span>
                        <span className="text-gray-500 text-xs">{t('explain.law12488')}</span>
                      </div>
                    )}
                    {llmText.includes('№108') && (
                      <div className="flex items-start gap-2 bg-white rounded-xl p-3 border border-gray-200">
                        <span className="text-[#333333] font-mono font-extrabold text-xs shrink-0">№108</span>
                        <span className="text-gray-500 text-xs">{t('explain.law108')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Чеклист жёстких правил (Task 4) */}
              {hardRules.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <h4 className="text-xs font-extrabold text-[#333333] mb-3 flex items-center gap-2 uppercase tracking-widest">
                    <span className="text-base">📜</span>
                    {t('explain.hardRules')}
                  </h4>
                  <div className="space-y-2">
                    {hardRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${
                          rule.passed === true
                            ? 'bg-white border-[#C0F11C]'
                            : rule.passed === false
                            ? 'bg-white border-red-400'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <span className="text-base shrink-0 mt-0.5">
                          {rule.passed === true ? '✅' : rule.passed === false ? '❌' : '—'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#333333]">{rule.rule}</div>
                          {rule.law && (
                            <div className="text-xs text-blue-600 font-mono mt-0.5">{rule.law}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-1 flex gap-4 flex-wrap">
                            {rule.value && (
                              <span>{t('explain.hardRulesValue')}: <span className="font-semibold text-[#333333]">{rule.value}</span></span>
                            )}
                            {rule.required && (
                              <span>{t('explain.hardRulesRequired')}: <span className="font-semibold text-[#333333]">{rule.required}</span></span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Кнопка отказа */}
              {appData && (riskLevel === 'red' || riskLevel === 'yellow' || score < 50) && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                        <FileX className="h-5 w-5 text-red-700" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-red-800">{t('explain.refusalTitle')}</p>
                        <p className="text-xs text-red-700/75">{t('explain.refusalDesc')}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!appData) return;
                        try {
                          const blob = await downloadRefusalPdf(appData.id);
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `refusal_${appData.application_number}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                        } catch (err) {
                          console.error('Refusal PDF error:', err);
                        }
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#C0F11C] hover:brightness-95 text-[#333333] font-bold text-sm rounded-xl transition-all"
                    >
                      <FileX className="w-4 h-4" />
                      {t('explain.generateRefusal')}
                    </button>
                  </div>
                </div>
              )}

              {/* Детали заявки */}
              {appData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t('explain.region')}</span>
                    <span className="text-sm text-[#333333] font-semibold truncate">{appData.region}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t('explain.direction')}</span>
                    <span className="text-sm text-[#333333] font-semibold truncate">{appData.direction}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t('explain.amount')}</span>
                    <span className="text-sm text-[#333333] font-extrabold">{fmtAmount(appData.amount)} ₸</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t('explain.district')}</span>
                    <span className="text-sm text-[#333333] font-semibold truncate">{appData.farm_district}</span>
                  </div>
                </div>
              )}

              {/* SHAP-график */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white p-6">
                <h3 className="text-sm font-extrabold text-[#333333] mb-4 flex items-center gap-2 tracking-tight">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  {t('explain.technical_details')}
                </h3>
                {shapChartData.length > 0 ? (
                  <ExpandableChart title={t('explain.technical_details')} minHeight="min-h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={shapChartData}
                        layout="vertical"
                        margin={{ left: 20, right: 40, top: 8, bottom: 8 }}
                      >
                        <XAxis
                          type="number"
                          tick={{ fill: '#9ca3af', fontSize: 14 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}%`}
                          domain={(() => {
                            const maxAbs = Math.max(...shapChartData.map(d => Math.abs(d.value)), 0.01);
                            const pad = maxAbs * 0.1;
                            return [-(maxAbs + pad), maxAbs + pad];
                          })()}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: '#374151', fontSize: 14 }}
                          axisLine={false}
                          tickLine={false}
                          width={220}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: 14,
                            color: '#080000',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                          }}
                          labelStyle={{ color: '#080000', fontWeight: 700 }}
                          itemStyle={{ color: '#080000' }}
                          // @ts-expect-error formatter
                          formatter={(v: number) => [`${v > 0 ? '+' : ''}${v.toFixed(2)}%`, t('shap.importance')]}
                        />
                        <Bar dataKey="value" barSize={24} radius={[0, 4, 4, 0]}>
                          {shapChartData.map((entry, index) => (
                            <Cell
                              key={`shap-${index}`}
                              fill={entry.value >= 0 ? '#C0F11C' : '#ef4444'}
                              fillOpacity={0.85}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ExpandableChart>
                ) : (
                  <p className="text-center text-gray-400 py-8 italic text-sm">{t('explain.no_shap')}</p>
                )}
              </div>

              {appData && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[11px] text-gray-400">
                    <span className="text-gray-500">{t('explain.subsidy')}:</span>{' '}
                    {appData.subsidy_name}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
