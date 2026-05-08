import Header from '../components/Header';
import ProactiveOffers from '../components/ProactiveOffers';
import { useTranslation } from '../i18n/useTranslation';

/** Страница проактивных предложений — перспективные фермеры для субсидий */
export default function ProactiveOffersPage() {
  const { t } = useTranslation();
  return (
    <>
      <Header title={t('offers.title')} />
      <div className="flex-1 p-5 overflow-y-auto">
        <ProactiveOffers />
      </div>
    </>
  );
}
