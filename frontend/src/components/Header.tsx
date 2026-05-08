import { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { uploadDataset, getUploadStatus } from '../services/api';

interface HeaderProps {
  title: string;
}

const TRAINING_STAGES: Record<number, string> = {
  10: 'training.stage_validated',
  30: 'training.stage_features',
  60: 'training.stage_trained',
  75: 'training.stage_scored',
  90: 'training.stage_saved',
  100: 'training.stage_done',
};

function getStageKey(progress: number): string {
  const stages = [10, 30, 60, 75, 90, 100];
  for (const threshold of stages) {
    if (progress <= threshold) return TRAINING_STAGES[threshold];
  }
  return TRAINING_STAGES[100];
}

/** Шапка страницы: заголовок + кнопка загрузки */
export default function Header({ title }: HeaderProps) {
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'training' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const status = await getUploadStatus(id);
      setProgress(status.progress);

      if (status.status === 'done') {
        setUploadState('success');
        setUploadMessage(t('header.uploadSuccess', { count: '✓' }));
        setTimeout(() => { window.location.reload(); }, 1500);
        return true;
      }

      if (status.status === 'failed') {
        setUploadState('error');
        setUploadMessage(status.error || t('header.uploadErrorDetail'));
        setTimeout(() => { setUploadState('idle'); setUploadMessage(''); setProgress(0); }, 5000);
        return true;
      }

      setUploadMessage(`${Math.round(status.progress)}% — ${t(getStageKey(status.progress))}`);
      return false;
    } catch {
      setUploadState('error');
      setUploadMessage(t('header.uploadErrorDetail'));
      setTimeout(() => { setUploadState('idle'); setUploadMessage(''); setProgress(0); }, 5000);
      return true;
    }
  }, [t]);

  useEffect(() => {
    if (!taskId || uploadState !== 'training') return;
    const interval = setInterval(async () => {
      const shouldStop = await pollStatus(taskId);
      if (shouldStop) { clearInterval(interval); setTaskId(null); }
    }, 1500);
    return () => clearInterval(interval);
  }, [taskId, uploadState, pollStatus]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadState('uploading');
    setUploadMessage(t('header.uploading'));
    setProgress(0);

    try {
      const result = await uploadDataset(file);
      if (result.task_id) {
        setTaskId(result.task_id);
        setUploadState('training');
        setUploadMessage(`0% — ${t('training.stage_validated')}`);
      } else {
        setUploadState('success');
        setUploadMessage(t('header.uploadSuccess', { count: result.rows_to_process || '✓' }));
        setTimeout(() => { window.location.reload(); }, 1500);
      }
    } catch (err) {
      setUploadState('error');
      const msg = err instanceof Error ? err.message : '';
      setUploadMessage(msg === 'SERVICE_UNAVAILABLE' ? t('header.uploadUnavailable') : t('header.uploadErrorDetail'));
      setTimeout(() => { setUploadState('idle'); setUploadMessage(''); setProgress(0); }, 5000);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const isProcessing = uploadState === 'uploading' || uploadState === 'training';

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{title}</h2>

        <div className="flex items-center gap-3">
          {/* Прогресс-бар */}
          {uploadState === 'training' && (
            <div className="w-48 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <div
                className="h-full bg-[#C0F11C] transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Сообщение */}
          {uploadMessage && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium ${
              isProcessing
                ? 'bg-gray-100 text-gray-600'
                : uploadState === 'success'
                  ? 'bg-[#C0F11C] text-[#333333]'
                  : 'bg-[#DC2626] text-[#333333]'
            }`}>
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploadState === 'success' && <Check className="w-4 h-4" />}
              {uploadState === 'error' && <AlertCircle className="w-4 h-4" />}
              {uploadMessage}
            </div>
          )}

          {/* Кнопка загрузки */}
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleUpload}
              disabled={isProcessing}
            />
            <span className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              isProcessing
                ? 'bg-gray-100 text-gray-400 cursor-wait border border-gray-200'
                : 'bg-[#C0F11C] text-[#333333] cursor-pointer hover:brightness-95'
            }`}>
              {!isProcessing && <Upload className="w-4 h-4" />}
              {t('header.upload')}
            </span>
          </label>
        </div>
      </div>
    </header>
  );
}
