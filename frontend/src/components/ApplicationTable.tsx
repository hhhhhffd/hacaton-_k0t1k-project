import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState as TanStackSortingState,
} from '@tanstack/react-table';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  FileSearch,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertOctagon,
  FileDown,
  FileX,
  Scale,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useTranslation } from '../i18n/useTranslation';
import EmptyState from './EmptyState';
import CompareModal from './CompareModal';
import type { Application } from '../types';
import { fmtAmount } from '../utils/formatters';
import { downloadApplicationPdf, downloadRefusalPdf } from '../services/api';

function getMortalityNorm(subsidyName: string): number {
  const s = String(subsidyName).toLowerCase();
  if (s.includes('свин')) return 12.5;
  if (s.includes('птиц')) return 7.5;
  if (s.includes('верблюд')) return 6.0;
  if (s.includes('овц') || s.includes('коз')) return 5.0;
  if (s.includes('лошад')) return 3.0;
  if (s.includes('крс') || s.includes('скот') || s.includes('бык') || s.includes('коров')) return 2.5;
  return 3.0;
}

/** Бейдж балла — admin style */
function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400">—</span>;

  const cls =
    score >= 70
      ? 'bg-[#C0F11C] text-[#333333] font-bold'
      : score >= 40
        ? 'border border-amber-200 bg-amber-50 text-amber-700 font-bold'
        : 'border border-red-200 bg-red-50 text-red-700 font-bold';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm tabular-nums ${cls}`}>
      {score.toFixed(1)}
    </span>
  );
}

/** Бейдж уровня риска */
function TrafficLightBadge({ level, reason }: { level: string | null; reason?: string | null }) {
  const { t } = useTranslation();
  const l = level || 'green';

  return (
    <>
      {l === 'red' && (
        <span
          className="inline-flex cursor-help items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-bold text-red-700"
          title={reason || t('risk.red')}
        >
          <AlertOctagon className="w-3 h-3" />
          {t('risk.red')}
        </span>
      )}
      {l === 'yellow' && (
        <span
          className="inline-flex cursor-help items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700"
          title={reason || t('risk.yellow')}
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {t('risk.yellow')}
        </span>
      )}
      {l === 'green' && (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#C0F11C] text-[#333333] font-bold rounded-full text-sm">
          <span className="w-2 h-2 rounded-full bg-[#333333]" />
          {t('risk.green')}
        </span>
      )}
    </>
  );
}

interface ApplicationTableProps {
  onExplain: (id: number) => void;
}

/** Таблица заявок — серверная сортировка + пагинация */
export default function ApplicationTable({ onExplain }: ApplicationTableProps) {
  const { t } = useTranslation();
  const {
    applications,
    totalCount,
    loading,
    error,
    errorKind,
    sorting,
    pagination,
    setSorting,
    setPage,
    setPageSize,
    fetchApplications,
  } = useAppStore();

  const filters = useAppStore((s) => s.filters);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectedApps = applications.filter(app => selectedIds.has(app.id));

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchApplications();
    }, 150);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorting.field, sorting.order, pagination.skip, pagination.limit, filters.region, filters.direction, filters.status, filters.minScore, filters.maxScore]);

  const columns = useMemo<ColumnDef<Application>[]>(
    () => [
      {
        id: 'select',
        header: '',
        size: 50,
        enableSorting: false,
        cell: ({ row }) => {
          const isSelected = selectedIds.has(row.original.id);
          return (
            <label className="flex items-center justify-center w-full h-full min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => { e.stopPropagation(); toggleSelect(row.original.id); }}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 rounded border-gray-300 cursor-pointer"
              />
            </label>
          );
        },
      },
      {
        accessorKey: 'sequential_number',
        header: t('table.num'),
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-gray-500 font-mono text-sm">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: 'farm_district',
        header: t('table.district'),
        size: 160,
        cell: ({ getValue }) => (
          <span className="text-gray-900 text-sm" title={String(getValue())}>
            {String(getValue())}
          </span>
        ),
      },
      {
        accessorKey: 'direction',
        header: t('table.direction'),
        size: 180,
        cell: ({ getValue }) => (
          <span className="text-gray-600 text-sm" title={String(getValue())}>
            {String(getValue())}
          </span>
        ),
      },
      {
        accessorKey: 'subsidy_name',
        header: t('table.subsidy'),
        size: 200,
        cell: ({ getValue }) => {
          const raw = String(getValue());
          const short = raw
            .replace(/^Заявка на получение субсидий (за |на )/i, '')
            .replace(/^получение субсидий (за |на )/i, '');
          const display = short.charAt(0).toUpperCase() + short.slice(1);
          return (
            <span className="text-gray-600 text-sm leading-snug line-clamp-2" title={raw}>
              {display}
            </span>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: t('table.amount'),
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-gray-900 text-sm font-bold font-mono tabular-nums whitespace-nowrap">
            {fmtAmount(Number(getValue()))}
          </span>
        ),
      },
      {
        accessorKey: 'pasture_area_ha',
        header: 'Пастбища (га)',
        size: 100,
        cell: ({ getValue }) => {
          const v = getValue() as number | null | undefined;
          if (v == null) return <span className="text-gray-300 text-sm">—</span>;
          if (v === 0) return <span className="text-gray-500 text-sm font-mono tabular-nums">0 га</span>;
          return (
            <span className="text-gray-900 text-sm font-mono tabular-nums">
              {v.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} га
            </span>
          );
        },
      },
      {
        accessorKey: 'historical_mortality_rate',
        header: 'Падёж %',
        size: 90,
        cell: ({ row, getValue }) => {
          const v = getValue() as number | null | undefined;
          if (v == null) return <span className="text-gray-300 text-sm">—</span>;
          const norm = getMortalityNorm(row.original.subsidy_name);
          const isHigh = v > norm;
          return (
            <span
              className={`text-sm font-mono tabular-nums ${isHigh ? 'text-[#333333] font-bold' : 'text-gray-900'}`}
              title={isHigh ? `Превышает норму ${norm.toFixed(1)}%` : `В норме (до ${norm.toFixed(1)}%)`}
            >
              {v.toFixed(1)}%{isHigh ? ' ⚠' : ''}
            </span>
          );
        },
      },
      {
        accessorKey: 'current_head_count',
        header: 'Поголовье',
        size: 95,
        cell: ({ getValue }) => {
          const v = getValue() as number | null | undefined;
          if (v == null || v === 0) return <span className="text-gray-300 text-sm">—</span>;
          return (
            <span className="text-gray-900 text-sm font-mono tabular-nums">
              {Number(v).toLocaleString('ru-RU')} <span className="text-gray-400">гол.</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'merit_score',
        header: t('table.score'),
        size: 75,
        cell: ({ getValue }) => <ScoreBadge score={getValue() as number | null} />,
      },
      {
        accessorKey: 'risk_level',
        header: 'Риск',
        size: 110,
        cell: ({ row }) => (
          <TrafficLightBadge
            level={row.original.risk_level}
            reason={row.original.risk_reason}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 160,
        enableSorting: false,
        cell: ({ row }) => {
          const handleDownloadPdf = async (e: React.MouseEvent) => {
            e.stopPropagation();
            try {
              const blob = await downloadApplicationPdf(row.original.id);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `protocol_${row.original.application_number}.pdf`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (err) {
              console.error('PDF download error:', err);
            }
          };

          const handleDownloadRefusal = async (e: React.MouseEvent) => {
            e.stopPropagation();
            try {
              const blob = await downloadRefusalPdf(row.original.id);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `refusal_${row.original.application_number}.pdf`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (err) {
              console.error('Refusal PDF download error:', err);
            }
          };

          const riskLevel = row.original.risk_level || 'green';
          const score = row.original.merit_score || 0;
          const showRefusal = riskLevel === 'red' || riskLevel === 'yellow' || score < 50;

          return (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onExplain(row.original.id); }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#C0F11C] hover:brightness-95 border border-[#C0F11C] rounded-xl text-sm font-semibold text-[#333333] transition-all"
                title={t('table.explainTooltip')}
              >
                <FileSearch className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#C0F11C] hover:brightness-95 border border-[#C0F11C] rounded-xl text-sm font-semibold text-[#333333] transition-all"
                title={t('table.pdfTooltip')}
              >
                <FileDown className="w-3.5 h-3.5" />
              </button>
              {showRefusal && (
                <button
                  onClick={handleDownloadRefusal}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-red-400 rounded-xl text-sm font-semibold text-[#333333] transition-all"
                  title={t('table.refusalTooltip')}
                >
                  <FileX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [t, onExplain, selectedIds, toggleSelect],
  );

  const tanstackSorting: TanStackSortingState = [{ id: sorting.field, desc: sorting.order === 'desc' }];

  const table = useReactTable({
    data: applications,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pagination.limit),
    state: { sorting: tanstackSorting },
    enableSortingRemoval: false,
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(tanstackSorting) : updater;
      if (newSorting.length > 0) {
        setSorting(newSorting[0].id, newSorting[0].desc ? 'desc' : 'asc');
      }
    },
  });

  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.limit));

  if (loading && applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <div className="w-7 h-7 border-2 border-[#C0F11C] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">{t('table.loading')}</p>
      </div>
    );
  }

  if (error && (errorKind === 'unavailable' || errorKind === 'no_data')) {
    return <EmptyState kind={errorKind === 'unavailable' ? 'unavailable' : 'no_data'} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#333333]">
        <AlertOctagon className="w-8 h-8 mb-2 opacity-60" />
        <p className="text-sm font-semibold">{t('table.error')}</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  if (applications.length === 0 && !loading) {
    return <EmptyState kind="no_data" />;
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#C0F11C] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Таблица */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-200 bg-gray-50">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={`px-4 py-3 text-left text-sm font-extrabold uppercase tracking-wider select-none transition-colors ${
                        canSort
                          ? 'cursor-pointer text-gray-500 hover:text-gray-900'
                          : 'text-gray-400'
                      }`}
                      style={{ width: header.getSize() }}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="ml-0.5">
                            {sorted === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-gray-900" />
                            ) : sorted === 'desc' ? (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-900" />
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 hover:bg-[#C0F11C]/10 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2.5" style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-500 tabular-nums">
            {pagination.skip + 1}–{Math.min(pagination.skip + pagination.limit, totalCount)}{' '}
            {t('pagination.of')} {totalCount.toLocaleString('ru-RU')}
          </span>
          <select
            value={pagination.limit}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-white border border-gray-200 rounded-xl px-2 py-1 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#C0F11C] focus:border-transparent"
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>{size} {t('pagination.perPage')}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(0)}
            disabled={currentPage <= 1}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-20 disabled:cursor-not-allowed rounded-xl text-gray-900 transition-colors border border-gray-200"
            title={t('pagination.firstPage')}
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(Math.max(0, pagination.skip - pagination.limit))}
            disabled={currentPage <= 1}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-20 disabled:cursor-not-allowed rounded-xl text-gray-900 transition-colors border border-gray-200"
            title={t('pagination.prev')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {generatePageNumbers(currentPage, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="px-1.5 text-sm text-gray-400">…</span>
            ) : (
              <button
                key={`page-${p}`}
                onClick={() => setPage((Number(p) - 1) * pagination.limit)}
                className={`min-w-[32px] h-8 rounded-xl text-sm font-bold transition-colors border ${
                  Number(p) === currentPage
                    ? 'bg-[#C0F11C] border-[#C0F11C] text-[#333333]'
                    : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => setPage(pagination.skip + pagination.limit)}
            disabled={currentPage >= totalPages}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-20 disabled:cursor-not-allowed rounded-xl text-gray-900 transition-colors border border-gray-200"
            title={t('pagination.next')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage((totalPages - 1) * pagination.limit)}
            disabled={currentPage >= totalPages}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-20 disabled:cursor-not-allowed rounded-xl text-gray-900 transition-colors border border-gray-200"
            title={t('pagination.lastPage')}
          >
            <ChevronsRight className="w-4 h-4" />
          </button>

          <div className="ml-2 flex items-center gap-1.5">
            <span className="text-sm text-gray-400">→</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              placeholder={String(currentPage)}
              title={t('pagination.goToPage')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = Number((e.target as HTMLInputElement).value);
                  if (val >= 1 && val <= totalPages) {
                    setPage((val - 1) * pagination.limit);
                    (e.target as HTMLInputElement).value = '';
                    (e.target as HTMLInputElement).blur();
                  }
                }
              }}
              className="w-12 bg-white border border-gray-200 rounded-xl px-1.5 py-1 text-sm text-gray-900 font-medium text-center focus:outline-none focus:ring-2 focus:ring-[#C0F11C] focus:border-transparent tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-sm text-gray-400">/ {totalPages}</span>
          </div>
        </div>
      </div>

      {/* Плавающая панель сравнения */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-4 px-5 py-3 bg-white border border-gray-200 rounded-2xl shadow-xl shadow-black/10">
            <span className="text-sm text-gray-600 font-medium">
              {t('compare.selected')}: <span className="font-extrabold text-gray-900">{selectedIds.size}</span>
            </span>
            {selectedIds.size >= 2 ? (
              <button
                onClick={() => setShowCompare(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#C0F11C] hover:brightness-95 text-[#333333] font-bold text-sm rounded-xl transition-all"
              >
                <Scale className="w-4 h-4" />
                {t('compare.button')}
              </button>
            ) : (
              <span className="text-sm text-gray-400">{t('compare.selectTwo')}</span>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-gray-400 hover:text-gray-900 underline underline-offset-2 transition-colors"
            >
              {t('compare.clear')}
            </button>
          </div>
        </div>
      )}

      {/* Модалка сравнения */}
      {showCompare && selectedApps.length >= 2 && (
        <CompareModal
          apps={selectedApps}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | string)[] = [1];
  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
