import { AlertCircle, ArrowRight, CheckCircle, Send } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import { useTranslation } from '../i18n/useTranslation';

interface SubmitResult {
  application_number: string;
}

const REGIONS = ['Алматинская область', 'Акмолинская область', 'Туркестанская область'];
const DIRECTIONS = ['Мясное скотоводство', 'Молочное скотоводство', 'Овцеводство'];

export default function ApplyPage() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    farmer_name: '',
    region: '',
    land_area: '',
    direction: '',
    amount: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/public/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          land_area: Number(formData.land_area),
          amount: Number(formData.amount),
        }),
      });
      if (!response.ok) throw new Error('Failed to submit application');
      setResult(await response.json() as SubmitResult);
    } catch {
      setError(language === 'kz' ? 'Өтінімді жіберу кезінде қате шықты. Қайталап көріңіз.' : 'Ошибка при отправке заявки. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="public-shell">
        <PublicHeader />
        <main className="page-frame">
          <div className="bento-grid min-h-[calc(100vh-100px)] content-center">
            <section className="bento-panel col-span-7 flex min-h-[380px] flex-col justify-between border-t-4 border-t-[#C0F11C] p-7 sm:p-10">
              <CheckCircle className="h-8 w-8" />
              <div>
                <h1 className="text-3xl font-extrabold tracking-[-.035em]">{t('apply.success_title')}</h1>
                <p className="mt-3 max-w-lg text-gray-600">{t('apply.success_desc')}</p>
              </div>
            </section>
            <section className="bento-panel col-span-5 flex min-h-[380px] flex-col justify-between p-7 sm:p-10">
              <div>
                <p className="data-label">{t('apply.your_number')}</p>
                <p className="data-value mt-3 break-all text-3xl font-extrabold tracking-wider">{result.application_number}</p>
              </div>
              <button onClick={() => navigate(`/status/${result.application_number}`)} className="work-button self-start">
                {t('apply.check_status')} <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const inputClass = 'work-control';
  const labelClass = 'mb-2 block text-xs font-bold text-gray-600';

  return (
    <div className="public-shell">
      <PublicHeader />
      <main className="page-frame py-3 sm:py-5">
        <div className="bento-grid">
          <aside className="bento-panel col-span-4 flex min-h-[310px] flex-col justify-between border-t-4 border-t-[#C0F11C] p-6 sm:sticky sm:top-[78px] sm:self-start sm:p-8">
            <div>
              <h1 className="text-3xl font-extrabold leading-tight tracking-[-.035em]">{t('apply.title')}</h1>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">{t('apply.subtitle')}</p>
            </div>
            <p className="text-xs text-gray-500">
              {language === 'kz' ? 'Дербес деректер қорғалған' : 'Персональные данные защищены'}
            </p>
          </aside>

          <form onSubmit={handleSubmit} className="bento-panel col-span-8 p-5 sm:p-8">
            <div className="mb-7 flex items-center justify-between border-b border-gray-200 pb-4">
              <div>
                <p className="text-sm font-bold text-[#333333]">
                  {language === 'kz' ? 'Өтінім деректері' : 'Сведения о заявке'}
                </p>
                <p className="mt-1 text-xs text-gray-500">* {language === 'kz' ? 'міндетті өрістер' : 'обязательные поля'}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className={labelClass}>{t('apply.farmer_name')} *</span>
                <input required value={formData.farmer_name} onChange={(event) => setFormData({ ...formData, farmer_name: event.target.value })} className={inputClass} />
              </label>
              <label>
                <span className={labelClass}>{t('apply.region')} *</span>
                <select required value={formData.region} onChange={(event) => setFormData({ ...formData, region: event.target.value })} className={inputClass}>
                  <option value="">{language === 'kz' ? 'Өңірді таңдаңыз' : 'Выберите регион'}</option>
                  {REGIONS.map((region) => <option key={region}>{region}</option>)}
                </select>
              </label>
              <label>
                <span className={labelClass}>{t('apply.direction')} *</span>
                <select required value={formData.direction} onChange={(event) => setFormData({ ...formData, direction: event.target.value })} className={inputClass}>
                  <option value="">{language === 'kz' ? 'Бағытты таңдаңыз' : 'Выберите направление'}</option>
                  {DIRECTIONS.map((direction) => <option key={direction}>{direction}</option>)}
                </select>
              </label>
              <label>
                <span className={labelClass}>{t('apply.land_area')} *</span>
                <input required min="0" type="number" step="0.1" value={formData.land_area} onChange={(event) => setFormData({ ...formData, land_area: event.target.value })} className={inputClass} placeholder="0.0" />
              </label>
              <label>
                <span className={labelClass}>{t('apply.amount')} *</span>
                <input required min="0" type="number" value={formData.amount} onChange={(event) => setFormData({ ...formData, amount: event.target.value })} className={inputClass} placeholder="0 ₸" />
              </label>
            </div>

            {error && (
              <div role="alert" className="mt-5 flex items-center gap-3 rounded-[9px] bg-[#DC2626] p-4 text-sm text-white">
                <AlertCircle className="h-5 w-5 shrink-0" /> {error}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-5">
              <Link to="/guide" className="text-xs font-bold text-gray-500 hover:text-[#333333]">
                {language === 'kz' ? 'Қызмет қалай жұмыс істейді?' : 'Как работает сервис?'}
              </Link>
              <button disabled={loading} type="submit" className="work-button min-w-44 disabled:opacity-50">
                {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#333333]/25 border-t-[#333333]" /> : <Send className="h-4 w-4" />}
                {t('apply.submit')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
