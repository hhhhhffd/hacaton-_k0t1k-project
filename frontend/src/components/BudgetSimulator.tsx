import { useState, useEffect, useRef, useCallback } from 'react';
import { Wallet, Users, Banknote, PiggyBank, TrendingUp, Loader2, Download, FileText } from 'lucide-react';
import { simulateBudget, downloadBudgetPdf } from '../services/api';
import axios from 'axios';
import type { Application } from '../types';
import { useTranslation } from '../i18n/useTranslation';
import { useAppStore } from '../store/appStore';
import type { BudgetSimResponse } from '../types';
import { fmtTenge } from '../utils/formatters';

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

/** Симулятор бюджета — горизонтальный: ввод слева, результаты справа */
export default function BudgetSimulator() {
  const { t } = useTranslation();
  const filters = useAppStore((s) => s.filters);

  /** Быстрые пресеты бюджета */
  const PRESETS = [
    { label: `500 ${t('budget.mln')}`, value: 500_000_000 },
    { label: `1 ${t('budget.mlrd')}`, value: 1_000_000_000 },
    { label: `5 ${t('budget.mlrd')}`, value: 5_000_000_000 },
    { label: `10 ${t('budget.mlrd')}`, value: 10_000_000_000 },
    { label: `50 ${t('budget.mlrd')}`, value: 50_000_000_000 },
    { label: `100 ${t('budget.mlrd')}`, value: 100_000_000_000 },
  ] as const;

  const [budget, setBudget] = useState(1_000_000_000);
  const [inputValue, setInputValue] = useState('1 000 000 000');
  const [result, setResult] = useState<BudgetSimResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Debounced вызов API */
  const debouncedSimulate = useCallback(
    (value: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await simulateBudget({
            budget: value,
            region: filters.region || undefined,
            direction: filters.direction || undefined,
          });
          setResult(data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (msg === 'SERVICE_UNAVAILABLE') {
            setError(t('unavailable.title'));
          } else {
            setError(t('empty.title'));
          }
        } finally {
          setLoading(false);
        }
      }, 500);
    },
    [filters.region, filters.direction, t],
  );

  useEffect(() => {
    debouncedSimulate(budget);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [budget, debouncedSimulate]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
  }

  function commitInput() {
    const parsed = parseBudgetInput(inputValue);
    if (parsed && parsed >= 1_000_000 && parsed <= 200_000_000_000_000) {
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

  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  /** Скачать PDF-протокол бюджетной симуляции */
  async function exportPdf() {
    if (!result || result.funded_count === 0) return;
    setExportingPdf(true);
    try {
      await downloadBudgetPdf({
        budget,
        region: filters.region || undefined,
        direction: filters.direction || undefined,
      });
    } finally {
      setExportingPdf(false);
    }
  }

  /** Экспорт всех профинансированных заявок в CSV через /applications (пагинация по 1000) */
  async function exportCSV() {
    if (!result || result.funded_count === 0) return;
    setExporting(true);
    try {
      const PAGE = 1000;
      const total = result.funded_count;
      const token = localStorage.getItem('access_token');
      const baseURL = import.meta.env.VITE_API_URL || '/api';
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const params: Record<string, string | number> = {
        skip: 0,
        limit: PAGE,
        sort_by: 'merit_score',
        sort_order: 'desc',
      };
      if (filters.region) params.region = filters.region;
      if (filters.direction) params.direction = filters.direction;

      // Загружаем страницами пока не наберём нужное количество
      const allApps: Application[] = [];
      let skip = 0;
      while (allApps.length < total) {
        const resp = await axios.get(`${baseURL}/applications`, {
          params: { ...params, skip },
          headers,
        });
        const batch: Application[] = resp.data.items ?? [];
        if (batch.length === 0) break;
        allApps.push(...batch);
        skip += PAGE;
        if (batch.length < PAGE) break;
      }

      const funded = allApps.slice(0, total);
      const csvHeaders = [
        '№', 'Область', 'Район', 'Направление', 'Тип субсидии', 
        'Сумма (тг)', 'Пастбища (ГА)', 'Падеж (%)', 'Поголовье (гол.)', 'Балл'
      ];
      const rows = funded.map((a) => [
        a.sequential_number,
        a.region,
        a.farm_district,
        a.direction,
        a.subsidy_name,
        a.amount,
        a.pasture_area_ha ?? '',
        a.historical_mortality_rate ?? '',
        a.current_head_count ?? '',
        a.merit_score?.toFixed(1) ?? '',
      ]);

      const csvContent = [csvHeaders, ...rows]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budget_${Math.round(budget / 1_000_000)}mln_all${funded.length}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const coveragePct = result
    ? ((result.funded_count / Math.max(result.total_applications, 1)) * 100).toFixed(1)
    : '0';

  const avgFundedScore = result && result.avg_funded_score > 0
    ? result.avg_funded_score.toFixed(1)
    : '—';

  return (
    <div className="bento-panel overflow-hidden">
      {/* Заголовок */}
      <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
        <div className="w-7 h-7 bg-[#C0F11C] rounded-xl flex items-center justify-center">
          <Wallet className="w-3.5 h-3.5 text-[#333333]" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">{t('budget.title')}</h3>
          <p className="text-sm text-gray-500">{t('budget.input')}</p>
        </div>
        {loading && !result && <Loader2 className="w-4 h-4 text-[#333333] animate-spin ml-2" />}
      </div>

      {/* Контент — горизонтальный */}
      <div className="flex flex-col items-start gap-4 px-4 py-4 lg:flex-row lg:gap-5 lg:px-5">
        {/* ЛЕВАЯ ЧАСТЬ: ввод + пресеты */}
        <div className="w-full flex-shrink-0 space-y-2.5 lg:w-64">
          {/* Поле ввода */}
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
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-extrabold text-gray-900 tabular-nums text-center placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C0F11C] focus:border-transparent transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{t('budget.tenge')}</span>
          </div>

          {/* Пресеты */}
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => selectPreset(p.value)}
                className={`text-sm py-1.5 rounded-xl font-bold transition-all ${
                  budget === p.value
                    ? 'bg-[#C0F11C] text-[#333333] border border-[#C0F11C]'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <p className="text-sm text-gray-400 text-center">
            {t('budget.inputHint')}
          </p>
        </div>

        {/* ПРАВАЯ ЧАСТЬ: результаты */}
        <div className="flex-1 min-w-0">
          {/* Ошибка */}
          {error && (
            <div className="rounded-xl bg-[#DC2626] py-3 text-center text-sm text-white">
              {error}
            </div>
          )}

          {/* Загрузка (первичная) */}
          {loading && !result && !error && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#C0F11C] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Результаты в горизонтальном grid */}
          {result && !error && (
            <div className="space-y-3">
            <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4 sm:gap-3">
              {/* 1. Профинансировано */}
              <div className="bg-[#C0F11C]/10 border border-[#C0F11C]/30 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3.5 h-3.5 text-[#333333]" />
                  <span className="text-sm text-gray-500">{t('budget.funded')}</span>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 tabular-nums">
                  {result.funded_count.toLocaleString('ru-RU')}
                </p>
                <span className="text-sm text-gray-400">
                  {t('pagination.of')} {result.total_applications.toLocaleString('ru-RU')}
                </span>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#C0F11C] transition-all duration-500"
                    style={{ width: `${Math.min(parseFloat(coveragePct), 100)}%` }}
                  />
                </div>
                <span className="text-sm text-[#333333] font-bold mt-0.5">{coveragePct}%</span>
              </div>

              {/* 2. К выплате */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 mb-1">
                  <Banknote className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-sm text-gray-500">{t('budget.spent')}</span>
                </div>
                <p className="text-lg font-extrabold text-gray-900 tabular-nums">{fmtTenge(result.total_amount)}</p>
              </div>

              {/* 3. Остаток */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 mb-1">
                  <PiggyBank className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-sm text-gray-500">{t('budget.remaining')}</span>
                </div>
                <p className="text-lg font-extrabold text-gray-900 tabular-nums">{fmtTenge(result.remaining_budget)}</p>
              </div>

              {/* 4. Средний балл */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-sm text-gray-500">{t('budget.avgScore')}</span>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{avgFundedScore}</p>
              </div>
            </div>

              {/* Кнопка экспорта */}
              {result.funded_count > 0 && (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={exportPdf}
                    disabled={exportingPdf}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-wait"
                  >
                    {exportingPdf
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <FileText className="w-3.5 h-3.5" />}
                    {exportingPdf ? t('budget.preparing') : t('budget.downloadPdf')}
                  </button>
                  <button
                    onClick={exportCSV}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#333333] bg-[#C0F11C] hover:brightness-95 rounded-xl transition-all disabled:opacity-50 disabled:cursor-wait"
                  >
                    {exporting
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    {exporting
                      ? t('budget.preparing')
                      : t('budget.downloadAll', { count: result.funded_count.toLocaleString('ru-RU') })}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
