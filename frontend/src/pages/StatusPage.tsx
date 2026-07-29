import { Check, Clock, Info, Search, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import { useTranslation } from '../i18n/useTranslation';

interface StatusData {
  application_number: string;
  status: string;
  merit_score: number;
  explanation: string;
  rank: number;
  total_applications: number;
  recommendations: string[];
}

export default function StatusPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, locale, language } = useTranslation();
  const [searchValue, setSearchValue] = useState(id ?? '');
  const [loading, setLoading] = useState(Boolean(id));
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (applicationId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/applications/${encodeURIComponent(applicationId)}/status?lang=${locale}`);
      if (!response.ok) throw new Error('NOT_FOUND');
      setData(await response.json() as StatusData);
    } catch {
      setData(null);
      setError('NOT_FOUND');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    setSearchValue(id ?? '');
    if (id) {
      fetchStatus(id);
      return;
    }
    setLoading(false);
    setData(null);
    setError(null);
  }, [id, fetchStatus]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedValue = searchValue.trim();
    if (normalizedValue) navigate(`/status/${encodeURIComponent(normalizedValue)}`);
  }

  return (
    <div className="public-shell">
      <PublicHeader />
      <main className="page-frame py-3 sm:py-5">
        <div className="bento-grid">
          <section className="bento-panel col-span-5 flex min-h-[250px] flex-col justify-between border-t-4 border-t-[#C0F11C] p-6 sm:p-8">
            <div>
              <h1 className="text-3xl font-extrabold leading-tight tracking-[-.035em]">{t('status.title')}</h1>
              <p className="mt-4 max-w-sm text-sm text-gray-600">
                {language === 'kz' ? 'Тіркеу кезінде берілген өтінім нөмірін енгізіңіз.' : 'Введите номер, полученный при регистрации заявки.'}
              </p>
            </div>
          </section>

          <section className="bento-panel col-span-7 flex min-h-[250px] items-center p-6 sm:p-8">
            <form onSubmit={handleSearch} className="w-full">
              <label htmlFor="application-number" className="section-kicker">{t('status.search_placeholder')}</label>
              <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="application-number"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    className="work-control pl-10 font-mono"
                    placeholder="KZ-2026-000000"
                    autoComplete="off"
                  />
                </div>
                <button className="work-button" type="submit">{language === 'kz' ? 'Тексеру' : 'Проверить'}</button>
              </div>
            </form>
          </section>

          {loading && (
            <section className="bento-panel col-span-12 grid min-h-[300px] place-items-center" aria-live="polite">
              <div className="text-center">
                <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#C0F11C] border-t-[#333333]" />
                <p className="mt-3 text-xs text-gray-500">{language === 'kz' ? 'Өтінім ізделуде…' : 'Поиск заявки…'}</p>
              </div>
            </section>
          )}

          {!loading && error && (
            <section className="bento-panel col-span-12 flex min-h-[260px] flex-col justify-between border-[#DC2626] p-7">
              <Info className="h-7 w-7 text-[#DC2626]" />
              <div>
                <h2 className="text-2xl font-extrabold">{language === 'kz' ? 'Өтінім табылмады' : 'Заявка не найдена'}</h2>
                <p className="mt-2 text-sm text-gray-600">{language === 'kz' ? 'Нөмірді тексеріп, қайталап көріңіз.' : 'Проверьте номер заявки и попробуйте снова.'}</p>
              </div>
            </section>
          )}

          {!loading && data && (
            <>
              <section className="bento-panel col-span-7 flex min-h-[280px] flex-col justify-between p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-[#a8d400] bg-[#C0F11C] px-3 py-1 font-mono text-[10px] font-bold uppercase">{data.status}</span>
                  <span className="font-mono text-xs text-gray-500">#{data.application_number}</span>
                </div>
                <div>
                  <p className="data-value text-6xl font-extrabold tracking-[-.06em]">
                    {data.merit_score?.toFixed(1) ?? '0.0'}<span className="ml-2 text-base font-normal text-gray-400">/ 100</span>
                  </p>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-600">{data.explanation}</p>
                </div>
              </section>

              <section className="bento-panel-accent col-span-5 flex min-h-[280px] flex-col justify-between p-6 sm:p-8">
                <TrendingUp className="h-6 w-6" />
                <div>
                  <p className="data-label !text-[#333333]/60">{t('status.rank')}</p>
                  <p className="data-value mt-2 text-6xl font-extrabold">{data.rank}</p>
                  <p className="mt-2 text-sm text-[#333333]/65">/ {data.total_applications}</p>
                </div>
              </section>

              <section className="bento-panel col-span-8 p-6 sm:p-8">
                <p className="section-kicker">{t('status.recommendations')}</p>
                <ol className="mt-5 divide-y divide-gray-200">
                  {data.recommendations.map((recommendation, index) => (
                    <li key={recommendation} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <span className="data-value text-xs text-gray-400">0{index + 1}</span>
                      <p className="text-sm leading-relaxed text-gray-700">{recommendation}</p>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="bento-panel-quiet col-span-4 p-6 sm:p-8">
                <p className="section-kicker">{t('status.process')}</p>
                <div className="mt-6 space-y-6">
                  <div className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#C0F11C]"><Check className="h-4 w-4" /></span>
                    <div><p className="text-sm font-bold">{t('status.step1_title')}</p><p className="mt-1 text-xs text-gray-500">{t('status.step1_desc')}</p></div>
                  </div>
                  <div className="flex gap-3 opacity-55">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-200"><Clock className="h-4 w-4" /></span>
                    <div><p className="text-sm font-bold">{t('status.step2_title')}</p><p className="mt-1 text-xs text-gray-500">{t('status.step2_desc')}</p></div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
