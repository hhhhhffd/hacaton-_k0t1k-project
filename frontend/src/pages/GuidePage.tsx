import { ArrowRight, Award, ClipboardCheck, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import { useTranslation } from '../i18n/useTranslation';

export default function GuidePage() {
  const { t } = useTranslation();
  const steps = [
    { icon: FileText, title: t('guide.step1_title'), desc: t('guide.step1_desc') },
    { icon: ClipboardCheck, title: t('guide.step2_title'), desc: t('guide.step2_desc') },
    { icon: Award, title: t('guide.step3_title'), desc: t('guide.step3_desc') },
  ];

  return (
    <div className="public-shell">
      <PublicHeader />
      <main className="page-frame py-3 sm:py-5">
        <div className="bento-grid">
          <section className="bento-panel col-span-7 flex min-h-[310px] flex-col justify-between border-t-4 border-t-[#C0F11C] p-6 sm:p-8">
            <div>
              <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-[-.035em] sm:text-4xl">
                {t('guide.title')}
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">{t('guide.subtitle')}</p>
            </div>
          </section>

          <aside className="bento-panel col-span-5 flex min-h-[310px] flex-col justify-between p-6 sm:p-8">
            <p className="text-sm font-bold text-gray-500">{t('guide.q1_title')}</p>
            <p className="max-w-md text-xl font-bold leading-snug tracking-[-.025em] text-[#333333]">
              {t('guide.q1_desc')}
            </p>
            <Link to="/apply" className="work-button self-start">
              {t('guide.apply_now')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>

          {steps.map(({ icon: Icon, title, desc }) => (
            <article
              key={title}
              className="bento-panel col-span-4 flex min-h-[250px] flex-col p-6"
            >
              <div>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="mt-auto">
                <h2 className="text-xl font-extrabold tracking-[-.025em]">{title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{desc}</p>
              </div>
            </article>
          ))}

          <section className="bento-panel col-span-8 p-6 sm:p-8">
            <p className="section-kicker">{t('guide.faq_title')}</p>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div>
                <h2 className="font-extrabold text-[#333333]">{t('guide.q1_title')}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{t('guide.q1_desc')}</p>
              </div>
              <div>
                <h2 className="font-extrabold text-[#333333]">{t('guide.q2_title')}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{t('guide.q2_desc')}</p>
              </div>
            </div>
          </section>

          <section className="bento-panel-quiet col-span-4 flex flex-col justify-between p-6 sm:p-8">
            <div>
              <h2 className="text-2xl font-extrabold tracking-[-.035em]">{t('guide.ready_title')}</h2>
              <p className="mt-2 text-sm text-gray-600">{t('guide.ready_desc')}</p>
            </div>
            <Link to="/apply" className="work-button mt-8 self-start">{t('guide.apply_now')}</Link>
          </section>
        </div>
      </main>
    </div>
  );
}
