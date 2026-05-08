import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { FileText, ClipboardCheck, Award, HelpCircle } from 'lucide-react';

export default function GuidePage() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: <FileText className="w-8 h-8 text-[#333333]" />,
      title: t('guide.step1_title'),
      desc: t('guide.step1_desc'),
    },
    {
      icon: <ClipboardCheck className="w-8 h-8 text-[#333333]" />,
      title: t('guide.step2_title'),
      desc: t('guide.step2_desc'),
    },
    {
      icon: <Award className="w-8 h-8 text-[#333333]" />,
      title: t('guide.step3_title'),
      desc: t('guide.step3_desc'),
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            {t('guide.title')}
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            {t('guide.subtitle')}
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {steps.map((step, i) => (
            <div key={i} className="bg-white border border-gray-200 p-8 rounded-3xl relative overflow-hidden group hover:border-[#C0F11C] hover:shadow-lg transition-all">
              <div className="bg-[#C0F11C] w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {step.icon}
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">{step.title}</h3>
              <p className="text-gray-500 leading-relaxed">{step.desc}</p>
              <div className="absolute top-4 right-4 text-6xl font-black text-gray-100 select-none">
                {i + 1}
              </div>
            </div>
          ))}
        </div>

        <section className="bg-white border border-gray-200 rounded-3xl p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <HelpCircle className="w-8 h-8 text-[#333333]" />
            <h2 className="text-2xl font-bold text-gray-900">{t('guide.faq_title')}</h2>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="font-bold text-lg mb-2 text-gray-900">{t('guide.q1_title')}</h4>
              <p className="text-gray-500 leading-relaxed">{t('guide.q1_desc')}</p>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-2 text-gray-900">{t('guide.q2_title')}</h4>
              <p className="text-gray-500 leading-relaxed">{t('guide.q2_desc')}</p>
            </div>
          </div>

          <div className="mt-12 p-6 bg-[#C0F11C]/20 rounded-2xl border border-[#C0F11C]/30 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="font-bold text-lg text-gray-900">{t('guide.ready_title')}</h4>
              <p className="text-gray-500">{t('guide.ready_desc')}</p>
            </div>
            <button
              onClick={() => window.location.href = '/apply'}
              className="px-8 py-4 bg-[#C0F11C] hover:brightness-95 text-[#333333] rounded-xl font-bold transition-all"
            >
              {t('guide.apply_now')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
