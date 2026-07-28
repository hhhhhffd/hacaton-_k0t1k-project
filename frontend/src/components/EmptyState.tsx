import { Upload, ServerCrash, FileSpreadsheet } from 'lucide-react';
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
      <div className="bento-panel flex min-h-[360px] flex-col justify-between border-red-200 p-7">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-700">
          <ServerCrash className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-2xl font-extrabold tracking-[-.025em]">{t('unavailable.title')}</h3>
          <p className="mt-3 max-w-md text-sm text-gray-600">{t('unavailable.subtitle')}</p>
          <button onClick={handleRetry} className="work-button-secondary mt-6">{t('unavailable.retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-panel flex min-h-[360px] flex-col justify-between border-t-4 border-t-[#C0F11C] p-7">
      <div className="brand-mark">
        <FileSpreadsheet className="h-5 w-5" />
      </div>
      <div>
        <h3 className="max-w-xl text-2xl font-extrabold tracking-[-0.025em]">{t('empty.title')}</h3>
        <p className="mt-3 max-w-md text-sm text-gray-600">{t('empty.subtitle')}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#333333]">
            <Upload className="h-4 w-4" />
            <span>{t('empty.hint')}</span>
          </div>
          <span className="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-500">XLSX / XLS</span>
        </div>
        <p className="mt-2 text-xs text-gray-500">{t('empty.format')}</p>
      </div>
    </div>
  );
}
