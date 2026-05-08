import { Upload, ServerCrash, FileSpreadsheet, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAppStore } from '../store/appStore';

interface EmptyStateProps {
  kind: 'no_data' | 'unavailable';
}

export default function EmptyState({ kind }: EmptyStateProps) {
  const { t } = useTranslation();
  const fetchApplications = useAppStore((s) => s.fetchApplications);
  const fetchStats = useAppStore((s) => s.fetchStats);

  function handleRetry() {
    fetchApplications();
    fetchStats();
  }

  if (kind === 'unavailable') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8">
        <div className="w-20 h-20 bg-[#DC2626] rounded-2xl flex items-center justify-center mb-6">
          <ServerCrash className="w-10 h-10 text-[#333333]" />
        </div>
        <h3 className="text-xl font-extrabold text-[#333333] tracking-tight mb-2">{t('unavailable.title')}</h3>
        <p className="text-sm text-gray-500 text-center max-w-md mb-6">
          {t('unavailable.subtitle')}
        </p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-sm font-semibold text-[#333333] transition-colors"
        >
          {t('unavailable.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-8">
      <div className="w-20 h-20 bg-[#C0F11C] rounded-2xl flex items-center justify-center mb-6">
        <FileSpreadsheet className="w-10 h-10 text-[#333333]" />
      </div>
      <h3 className="text-xl font-extrabold text-[#333333] tracking-tight mb-2">{t('empty.title')}</h3>
      <p className="text-sm text-gray-500 text-center max-w-md mb-4">
        {t('empty.subtitle')}
      </p>

      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#C0F11C] rounded-xl mb-3">
        <Upload className="w-4 h-4 text-[#333333]" />
        <span className="text-sm text-[#333333] font-semibold">{t('empty.hint')}</span>
        <ArrowUpRight className="w-4 h-4 text-[#333333]/60" />
      </div>

      <p className="text-xs text-gray-400">{t('empty.format')}</p>
    </div>
  );
}
