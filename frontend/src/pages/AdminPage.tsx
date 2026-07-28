import { useEffect, useState, useCallback, useRef } from 'react';
import { Users, ShieldCheck, ShieldX, Crown, CrownIcon, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AdminUser } from '../types';
import { getAdminUsers, toggleUserAccess, toggleUserAdmin } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n/useTranslation';

/** Админ-панель: управление пользователями */
export default function AdminPage() {
  const { t, language } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const PAGE_SIZE = 50;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getAdminUsers(debouncedSearch, PAGE_SIZE, page * PAGE_SIZE);
        if (!cancelled) {
          setUsers(result.items);
          setTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [debouncedSearch, page, refreshKey]);

  const forceRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(value); }, 300);
  };

  const handleToggleAccess = async (userId: number) => {
    setTogglingId(userId);
    try {
      const result = await toggleUserAccess(userId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: result.is_active } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleAdmin = async (userId: number) => {
    setTogglingId(userId);
    try {
      await toggleUserAdmin(userId);
      forceRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setTogglingId(null);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(language === 'kz' ? 'kk-KZ' : 'ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  function getUsersCountText(count: number): string {
    if (count === 1) return t('admin.usersCountOne');
    return t('admin.usersCount', { count });
  }

  return (
    <div className="page-frame flex-1">
      <div>
        {/* Шапка */}
        <div className="bento-panel mb-2.5 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="brand-mark">
              <Users className="w-5 h-5 text-[#333333]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#333333] tracking-tight">{t('admin.title')}</h1>
              <p className="text-sm text-gray-500">{getUsersCountText(total)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('admin.searchPlaceholder')}
                className="work-control w-64 pl-9"
              />
            </div>

            <button
              onClick={forceRefresh}
              disabled={loading}
              className="work-button-secondary disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {t('admin.refresh')}
            </button>
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div role="alert" className="mb-2.5 rounded-xl bg-[#DC2626] px-4 py-3 text-sm text-white">
            {error}
          </div>
        )}

        {/* Таблица */}
        <div className="bento-panel overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-[11px] font-extrabold text-gray-400 uppercase tracking-wider px-6 py-4">
                  {t('admin.colUser')}
                </th>
                <th className="text-left text-[11px] font-extrabold text-gray-400 uppercase tracking-wider px-6 py-4">
                  {t('admin.colProvider')}
                </th>
                <th className="text-left text-[11px] font-extrabold text-gray-400 uppercase tracking-wider px-6 py-4">
                  {t('admin.colDate')}
                </th>
                <th className="text-center text-[11px] font-extrabold text-gray-400 uppercase tracking-wider px-6 py-4">
                  {t('admin.colStatus')}
                </th>
                <th className="text-center text-[11px] font-extrabold text-gray-400 uppercase tracking-wider px-6 py-4">
                  {t('admin.colRole')}
                </th>
                <th className="text-center text-[11px] font-extrabold text-gray-400 uppercase tracking-wider px-6 py-4">
                  {t('admin.colActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#333333]" />
                    {t('admin.loading')}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    {search ? t('admin.noResults') : t('admin.noUsers')}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  const isToggling = togglingId === u.id;

                  return (
                    <tr
                      key={u.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      {/* Пользователь */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-[#333333] font-semibold text-sm">
                            {u.full_name || '—'}
                            {isSelf && (
                              <span className="ml-2 text-xs text-[#333333] bg-[#C0F11C] px-2 py-0.5 rounded-full font-bold">
                                {t('admin.you')}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                        </div>
                      </td>

                      {/* Провайдер */}
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          u.auth_provider === 'google'
                            ? 'bg-white border border-blue-400 text-blue-600'
                            : 'bg-white border border-gray-300 text-gray-600'
                        }`}>
                          {u.auth_provider === 'google' ? t('admin.providerGoogle') : t('admin.providerEmail')}
                        </span>
                      </td>

                      {/* Дата */}
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(u.created_at)}
                      </td>

                      {/* Статус */}
                      <td className="px-6 py-4 text-center">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#333333] bg-[#C0F11C] px-2.5 py-1 rounded-full">
                            <ShieldCheck className="w-3 h-3" />
                            {t('admin.statusActive')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                            <ShieldX className="w-3 h-3" />
                            {t('admin.statusPending')}
                          </span>
                        )}
                      </td>

                      {/* Роль */}
                      <td className="px-6 py-4 text-center">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                            <Crown className="w-3 h-3" />
                            {t('admin.roleAdmin')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">{t('admin.roleUser')}</span>
                        )}
                      </td>

                      {/* Действия */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleToggleAccess(u.id)}
                            disabled={isSelf || isToggling}
                            title={u.is_active ? t('admin.actionBlock') : t('admin.actionApprove')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                              u.is_active
                                ? 'bg-[#DC2626] text-white hover:brightness-95'
                                : 'bg-[#C0F11C] text-[#333333] hover:brightness-95'
                            }`}
                          >
                            {isToggling ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : u.is_active ? (
                              t('admin.actionBlock')
                            ) : (
                              t('admin.actionApprove')
                            )}
                          </button>

                          <button
                            onClick={() => handleToggleAdmin(u.id)}
                            disabled={isSelf || isToggling}
                            title={u.is_admin ? t('admin.actionRemoveAdmin') : t('admin.actionMakeAdmin')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                              u.is_admin
                                ? 'border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              <CrownIcon className="w-3 h-3" />
                              {u.is_admin ? t('admin.actionRemoveAdmin') : t('admin.actionMakeAdmin')}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-sm text-gray-500">
              {t('admin.page', { page: page + 1, total: Math.ceil(total / PAGE_SIZE) })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0 || loading}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total || loading}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Подсказка */}
        <div className="bento-panel-quiet mt-2.5 p-4 text-sm text-gray-500">
          <p className="font-bold text-[#333333] mb-2">{t('admin.howItWorks')}</p>
          <ul className="list-disc list-inside space-y-1">
            <li>{t('admin.hint1')}</li>
            <li>{t('admin.hint2')}</li>
            <li>{t('admin.hint3')}</li>
            <li>{t('admin.hint4')}</li>
            <li>{t('admin.hint5')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
