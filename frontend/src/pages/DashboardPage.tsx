import { useEffect } from 'react';
import Header from '../components/Header';
import StatsCards from '../components/StatsCards';
import FilterBar from '../components/FilterBar';
import ApplicationTable from '../components/ApplicationTable';
import BudgetSimulator from '../components/BudgetSimulator';
import ExplainabilityModal from '../components/ExplainabilityModal';
import EmptyState from '../components/EmptyState';
import { useAppStore } from '../store/appStore';
import { useTranslation } from '../i18n/useTranslation';

/** Главная страница — дашборд со статистикой, фильтрами, таблицей и бюджетом */
export default function DashboardPage() {
  const { t } = useTranslation();
  const {
    stats,
    fetchStats,
    fetchApplications,
    totalCount,
    loading,
    errorKind,
    statsError,
    applications,
    selectedApplicationId,
    setSelectedApplication,
  } = useAppStore();

  useEffect(() => {
    fetchStats();
    fetchApplications();
  }, [fetchStats, fetchApplications]);

  const isUnavailable = errorKind === 'unavailable' || statsError === 'unavailable';
  const hasNoData = !loading && !stats && applications.length === 0 && totalCount === 0;
  const showEmptyState = isUnavailable || (hasNoData && !loading);

  return (
    <>
      <Header title={t('dashboard.title')} />

      <div className="page-frame flex-1 space-y-2.5">
        {showEmptyState ? (
          <div className="bento-panel overflow-hidden">
            <EmptyState kind={isUnavailable ? 'unavailable' : 'no_data'} />
          </div>
        ) : (
          <>
            {/* ===== Карточки статистики ===== */}
            {stats && <StatsCards stats={stats} />}

            {/* ===== Симуляция бюджета (горизонтальная) ===== */}
            <BudgetSimulator />

            {/* ===== Фильтры ===== */}
            <FilterBar />

            {/* ===== Таблица заявок (полная ширина) ===== */}
            <div className="bento-panel overflow-hidden">
              <ApplicationTable onExplain={(id) => setSelectedApplication(id)} />
            </div>
          </>
        )}
      </div>

      {/* ===== Модальное окно SHAP + LLM объяснения ===== */}
      <ExplainabilityModal
        applicationId={selectedApplicationId}
        onClose={() => setSelectedApplication(null)}
      />
    </>
  );
}
