import React, { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { CheckCircle, AlertCircle, Send, ArrowRight } from 'lucide-react';

interface SubmitResult {
  application_number: string;
}

export default function ApplyPage() {
  const { t } = useTranslation();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/public/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          land_area: parseFloat(formData.land_area),
          amount: parseFloat(formData.amount),
        }),
      });

      if (!response.ok) throw new Error('Failed to submit');
      const data = response.ok ? await response.json() : null;
      setResult(data);
    } catch {
      setError('Ошибка при отправке заявки. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-[#C0F11C]/30 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-[#C0F11C] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-[#333333]" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gray-900">{t('apply.success_title')}</h1>
          <p className="text-gray-500 mb-6">{t('apply.success_desc')}</p>
          
          <div className="bg-gray-50 rounded-xl p-4 mb-8 border border-gray-200">
            <p className="text-sm text-gray-400 mb-1">{t('apply.your_number')}</p>
            <p className="text-3xl font-mono font-bold tracking-wider text-[#333333]">
              {result.application_number}
            </p>
          </div>

          <button
            onClick={() => window.location.href = `/status/${result.application_number}`}
            className="w-full py-4 bg-[#C0F11C] hover:brightness-95 text-[#333333] rounded-xl font-semibold transition-all flex items-center justify-center gap-2 group"
          >
            {t('apply.check_status')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">
            {t('apply.title')}
          </h1>
          <p className="text-gray-500 text-lg">
            {t('apply.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 p-8 rounded-3xl shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 mb-2">{t('apply.farmer_name')}</label>
              <input
                required
                type="text"
                value={formData.farmer_name}
                onChange={e => setFormData({ ...formData, farmer_name: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] outline-none transition-all text-gray-900 placeholder-gray-400"
                placeholder="ИП 'Агро-Мир' или Иванов И.И."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">{t('apply.region')}</label>
              <select
                required
                value={formData.region}
                onChange={e => setFormData({ ...formData, region: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] outline-none transition-all appearance-none text-gray-900"
              >
                <option value="">Выберите регион</option>
                <option value="Алматинская область">Алматинская область</option>
                <option value="Акмолинская область">Акмолинская область</option>
                <option value="Туркестанская область">Туркестанская область</option>
                {/* Add more */}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">{t('apply.direction')}</label>
              <select
                required
                value={formData.direction}
                onChange={e => setFormData({ ...formData, direction: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] outline-none transition-all appearance-none text-gray-900"
              >
                <option value="">Выберите направление</option>
                <option value="Мясное скотоводство">Мясное скотоводство</option>
                <option value="Молочное скотоводство">Молочное скотоводство</option>
                <option value="Овцеводство">Овцеводство</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">{t('apply.land_area')}</label>
              <input
                required
                type="number"
                step="0.1"
                value={formData.land_area}
                onChange={e => setFormData({ ...formData, land_area: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] outline-none transition-all text-gray-900 placeholder-gray-400"
                placeholder="0.0 га"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">{t('apply.amount')}</label>
              <input
                required
                type="number"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] outline-none transition-all text-gray-900 placeholder-gray-400"
                placeholder="0 ₸"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-[#DC2626] rounded-xl flex items-center gap-3 text-[#333333]">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full py-4 bg-[#C0F11C] hover:brightness-95 disabled:opacity-50 text-[#333333] rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#080000]/30 border-t-[#080000] rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                {t('apply.submit')}
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-gray-400 text-sm">
          Нажимая кнопку, вы соглашаетесь на обработку персональных данных.
          <br />
          <a href="/guide" className="text-[#333333] font-medium hover:underline mt-2 inline-block">Как это работает?</a>
        </p>
      </div>
    </div>
  );
}
