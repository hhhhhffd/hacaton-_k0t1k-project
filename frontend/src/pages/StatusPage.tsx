import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { Search, Info, TrendingUp, Lightbulb, CheckCircle, Clock } from 'lucide-react';

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
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/applications/${appId}/status?lang=${locale}`);
      if (!response.ok) throw new Error('Заявка не найдена');
      const json = await response.json();
      setData(json);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Неизвестная ошибка');
      }
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (id) {
      fetchStatus(id);
    }
  }, [id, fetchStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#C0F11C]/30 border-t-[#C0F11C] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Search Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">{t('status.title')}</h1>
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              placeholder={t('status.search_placeholder')}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] transition-all text-gray-900 placeholder-gray-400"
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  window.location.href = `/status/${e.currentTarget.value}`;
                }
              }}
              defaultValue={id}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          </div>
        </div>

        {error ? (
          <div className="bg-white border border-red-400 p-8 rounded-3xl text-center">
            <Info className="w-12 h-12 text-[#333333] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#333333] mb-2">Заявка не найдена</h2>
            <p className="text-gray-500">Проверьте номер заявки и попробуйте снова.</p>
          </div>
        ) : data && (
          <div className="space-y-6">
            {/* Status Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-white border border-gray-200 p-8 rounded-3xl relative overflow-hidden shadow-sm">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      data.status === 'Исполнена' ? 'bg-[#C0F11C] text-[#333333]' : 'bg-[#D97706] text-[#333333]'
                    }`}>
                      {data.status}
                    </span>
                    <span className="text-gray-400 text-sm">#{data.application_number}</span>
                  </div>
                  <h2 className="text-4xl font-bold mb-2 text-gray-900">
                    {data.merit_score?.toFixed(1) || '0.0'} <span className="text-lg text-gray-400 font-normal">/ 100 баллов</span>
                  </h2>
                  <p className="text-gray-500 leading-relaxed text-lg italic">
                    «{data.explanation}»
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#C0F11C]/10 blur-3xl rounded-full -mr-20 -mt-20" />
              </div>

              <div className="bg-white border border-gray-200 p-8 rounded-3xl flex flex-col justify-center items-center text-center shadow-sm">
                <TrendingUp className="w-10 h-10 text-[#333333] mb-4" />
                <p className="text-gray-400 text-sm mb-1">{t('status.rank')}</p>
                <p className="text-5xl font-bold text-gray-900 mb-2">{data.rank}</p>
                <p className="text-gray-400 text-sm">из {data.total_applications} заявок</p>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-[#C0F11C]/10 border border-[#C0F11C]/30 p-8 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <Lightbulb className="w-6 h-6 text-[#333333]" />
                <h3 className="text-xl font-bold text-gray-900">{t('status.recommendations')}</h3>
              </div>
              <ul className="space-y-4">
                {data.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="flex gap-4 items-start">
                    <div className="w-6 h-6 bg-[#C0F11C] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-[#080000] rounded-full" />
                    </div>
                    <p className="text-gray-600 text-lg">{rec}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Timeline Simulation */}
            <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm">
              <h3 className="text-xl font-bold mb-8 text-gray-900">{t('status.process')}</h3>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-10 relative">
                  <div className="flex items-center gap-8 pl-1">
                    <div className="w-6 h-6 bg-[#C0F11C] rounded-full ring-4 ring-[#C0F11C]/20 relative z-10 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-[#333333]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{t('status.step1_title')}</h4>
                      <p className="text-gray-400 text-sm">{t('status.step1_desc')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8 pl-1 opacity-50">
                    <div className="w-6 h-6 bg-gray-200 rounded-full relative z-10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-700">{t('status.step2_title')}</h4>
                      <p className="text-gray-400 text-sm">{t('status.step2_desc')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
