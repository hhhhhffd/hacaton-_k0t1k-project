import { Globe, LogIn, Wheat } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { useAppStore } from '../store/appStore';

export default function PublicHeader() {
  const { language } = useTranslation();
  const setLanguage = useAppStore((state) => state.setLanguage);

  const linkClass = ({ isActive }: { isActive: boolean }) => [
    'shrink-0 rounded-[8px] border px-3 py-2 text-xs font-bold transition-colors',
    isActive
      ? 'border-[#a8d400] bg-[#C0F11C] text-[#333333]'
      : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-white',
  ].join(' ');

  return (
    <header className="public-topbar">
      <Link to="/guide" className="flex shrink-0 items-center gap-2.5 text-[#333333]">
        <span className="brand-mark">
          <Wheat className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="hidden text-base font-extrabold leading-none sm:block">_k0t1k</span>
      </Link>

      <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto" aria-label="Публичные сервисы">
        <NavLink to="/apply" className={linkClass}>
          {language === 'kz' ? 'Өтінім беру' : 'Подать заявку'}
        </NavLink>
        <NavLink to="/status" className={linkClass}>
          {language === 'kz' ? 'Мәртебе' : 'Статус'}
        </NavLink>
        <NavLink to="/guide" className={linkClass}>
          {language === 'kz' ? 'Нұсқаулық' : 'Инструкция'}
        </NavLink>
      </nav>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setLanguage(language === 'ru' ? 'kz' : 'ru')}
          className="grid h-9 w-9 place-items-center rounded-[8px] border border-transparent text-gray-600 hover:border-gray-300 hover:bg-white"
          aria-label={language === 'ru' ? 'Қазақша' : 'Русский'}
          title={language === 'ru' ? 'Қазақша' : 'Русский'}
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
        </button>
        <Link
          to="/login"
          className="hidden h-9 items-center gap-2 rounded-[8px] border border-gray-300 bg-white px-3 text-xs font-bold text-[#333333] sm:flex"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
          {language === 'kz' ? 'Кабинет' : 'Кабинет'}
        </Link>
      </div>
    </header>
  );
}
