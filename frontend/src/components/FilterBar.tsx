import { Filter, X, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useTranslation } from '../i18n/useTranslation';

function FilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  placeholder: string;
  onChange: (val: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="section-kicker">{label}</label>
      <div className="relative">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="work-control appearance-none pr-8 text-sm font-medium cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

function ScoreInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  placeholder: string;
  onChange: (val: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="section-kicker">{label}</label>
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : Number(v));
        }}
        className="work-control text-sm font-medium tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}

export default function FilterBar() {
  const { t } = useTranslation();
  const { filters, filterOptions, setFilter, resetFilters } = useAppStore();

  const activeCount = [
    filters.region,
    filters.direction,
    filters.status,
    filters.minScore,
    filters.maxScore,
  ].filter((v) => v !== null && v !== undefined).length;

  return (
    <div className="bento-panel px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">{t('filter.title')}</span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 bg-[#C0F11C] text-[#333333] text-sm font-bold rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-500 hover:text-[#333333] bg-gray-100 hover:bg-white border border-gray-200 hover:border-red-400 rounded-xl transition-all"
          >
            <X className="w-3 h-3" />
            {t('filter.reset')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FilterSelect
          label={t('filter.region')}
          value={filters.region}
          options={filterOptions.regions}
          placeholder={t('filter.all')}
          onChange={(v) => setFilter('region', v)}
        />
        <FilterSelect
          label={t('filter.direction')}
          value={filters.direction}
          options={filterOptions.directions}
          placeholder={t('filter.all')}
          onChange={(v) => setFilter('direction', v)}
        />
        <FilterSelect
          label={t('filter.status')}
          value={filters.status}
          options={filterOptions.statuses}
          placeholder={t('filter.all')}
          onChange={(v) => setFilter('status', v)}
        />
        <ScoreInput
          label={t('filter.minScore')}
          value={filters.minScore}
          placeholder="0"
          onChange={(v) => setFilter('minScore', v)}
        />
        <ScoreInput
          label={t('filter.maxScore')}
          value={filters.maxScore}
          placeholder="100"
          onChange={(v) => setFilter('maxScore', v)}
        />
      </div>
    </div>
  );
}
