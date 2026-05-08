import { create } from 'zustand';
import type {
  Application,
  FilterState,
  SortingState,
  PaginationState,
  StatsResponse,
  Language,
} from '../types';
import { getApplications, getStats } from '../services/api';

/** Опции для выпадающих фильтров (собираются из загруженных данных) */
interface FilterOptions {
  regions: string[];
  directions: string[];
  statuses: string[];
}

/**
 * Тип ошибки:
 * - 'unavailable' — бэкенд недоступен (502/503/504)
 * - 'no_data' — данные не загружены (пустая БД)
 * - 'generic' — прочие ошибки
 */
type ErrorKind = 'unavailable' | 'no_data' | 'generic';

/** Глобальное состояние приложения */
interface AppState {
  // Данные заявок
  applications: Application[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  errorKind: ErrorKind | null;

  // Фильтры, сортировка, пагинация
  filters: FilterState;
  sorting: SortingState;
  pagination: PaginationState;
  filterOptions: FilterOptions;

  // Выбранная заявка (для модального окна объяснения)
  selectedApplicationId: number | null;

  // Статистика
  stats: StatsResponse | null;
  statsLoading: boolean;
  statsError: ErrorKind | null;

  // Язык интерфейса
  language: Language;

  // Действия
  fetchApplications: () => Promise<void>;
  setFilter: (key: keyof FilterState, value: string | number | null) => void;
  resetFilters: () => void;
  setSorting: (field: string, order: 'asc' | 'desc') => void;
  setPage: (skip: number) => void;
  setPageSize: (limit: number) => void;
  setLanguage: (lang: Language) => void;
  setSelectedApplication: (id: number | null) => void;
  fetchStats: () => Promise<void>;
}

/** Определяет тип ошибки по сообщению */
function classifyError(err: unknown): ErrorKind {
  const msg = err instanceof Error ? err.message : '';
  if (msg === 'SERVICE_UNAVAILABLE') return 'unavailable';
  if (msg === 'NO_DATA') return 'no_data';
  return 'generic';
}

/** Начальное состояние фильтров */
const initialFilters: FilterState = {
  region: null,
  direction: null,
  status: null,
  minScore: null,
  maxScore: null,
};

/** AbortController для отмены предыдущего запроса заявок */
let _applicationsAbort: AbortController | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  // Начальные значения
  applications: [],
  totalCount: 0,
  loading: false,
  error: null,
  errorKind: null,

  filters: { ...initialFilters },
  sorting: { field: 'merit_score', order: 'desc' },
  pagination: { skip: 0, limit: 50 },
  filterOptions: { regions: [], directions: [], statuses: [] },

  selectedApplicationId: null,

  stats: null,
  statsLoading: false,
  statsError: null,

  language: (localStorage.getItem('ui_language') as 'ru' | 'kz') || 'kz',

  // Загрузка заявок с текущими фильтрами
  fetchApplications: async () => {
    // Отменяем предыдущий запрос, если он ещё в полёте
    if (_applicationsAbort) _applicationsAbort.abort();
    _applicationsAbort = new AbortController();
    const signal = _applicationsAbort.signal;

    const { filters, pagination, sorting } = get();
    set({ loading: true, error: null, errorKind: null });

    try {
      const result = await getApplications(filters, pagination, sorting);
      set({
        applications: result.items,
        totalCount: result.total,
        loading: false,
        errorKind: null,
      });

      // Собираем уникальные значения для выпадающих фильтров из загруженных данных
      const currentOptions = get().filterOptions;
      if (result.items.length > 0) {
        const newRegions = [...new Set(result.items.map((a) => a.region).filter(Boolean))];
        const newDirections = [...new Set(result.items.map((a) => a.direction).filter(Boolean))];
        const newStatuses = [...new Set(result.items.map((a) => a.status).filter(Boolean))];

        // Мержим с существующими (чтобы не терять значения с других страниц)
        const merged = {
          regions: [...new Set([...currentOptions.regions, ...newRegions])].sort(),
          directions: [...new Set([...currentOptions.directions, ...newDirections])].sort(),
          statuses: [...new Set([...currentOptions.statuses, ...newStatuses])].sort(),
        };
        set({ filterOptions: merged });
      }
    } catch (err) {
      // Игнорируем отменённые запросы
      if (signal.aborted) return;
      const kind = classifyError(err);
      const message = err instanceof Error ? err.message : 'Ошибка загрузки заявок';
      set({ error: message, errorKind: kind, loading: false });
    }
  },

  // Установка фильтра (сбрасывает пагинацию на первую страницу)
  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value !== null && value !== undefined && value !== '' ? value : null },
      pagination: { ...state.pagination, skip: 0 },
    }));
  },

  // Сброс всех фильтров
  resetFilters: () => {
    set({ filters: { ...initialFilters }, pagination: { skip: 0, limit: get().pagination.limit } });
  },

  // Сортировка (сбрасывает пагинацию)
  setSorting: (field, order) => {
    set({ sorting: { field, order }, pagination: { ...get().pagination, skip: 0 } });
  },

  // Пагинация
  setPage: (skip) => {
    set((state) => ({ pagination: { ...state.pagination, skip } }));
  },

  setPageSize: (limit) => {
    set({ pagination: { skip: 0, limit } });
  },

  // Язык интерфейса
  setLanguage: (lang) => {
    localStorage.setItem('ui_language', lang);
    set({ language: lang });
  },

  // Выбранная заявка
  setSelectedApplication: (id) => {
    set({ selectedApplicationId: id });
  },

  // Загрузка статистики
  fetchStats: async () => {
    set({ statsLoading: true, statsError: null });
    try {
      const stats = await getStats();
      set({ stats, statsLoading: false, statsError: null });
    } catch (err) {
      set({ statsLoading: false, statsError: classifyError(err) });
    }
  },
}));
