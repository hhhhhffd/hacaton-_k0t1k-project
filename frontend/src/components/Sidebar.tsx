import { NavLink } from 'react-router-dom';
import { BarChart3, Globe, LayoutDashboard, LogOut, UserPlus, Users, Wheat } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

interface NavigationItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

export default function Sidebar() {
  const { t, language } = useTranslation();
  const { user, logout } = useAuthStore();
  const setLanguage = useAppStore((state) => state.setLanguage);

  const navigation: NavigationItem[] = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/analytics', label: t('nav.analytics'), icon: BarChart3 },
    { to: '/offers', label: t('nav.offers'), icon: UserPlus },
  ];

  if (user?.is_admin) {
    navigation.push({ to: '/admin', label: t('nav.users'), icon: Users });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#d8d8d8] bg-[#F4F4F4]/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[62px] w-full max-w-[1600px] items-center gap-3 px-[18px]">
        <div className="flex min-w-0 shrink-0 items-center gap-2.5 pr-2">
          <span className="brand-mark">
            <Wheat className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="hidden text-base font-extrabold leading-none tracking-[-0.02em] text-[#333333] sm:block">_k0t1k</p>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Основная навигация">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => [
                'flex min-h-10 shrink-0 items-center gap-2 rounded-[9px] border px-3 text-[13px] font-semibold transition-colors duration-150',
                isActive
                  ? 'border-[#a8d400] bg-[#C0F11C] text-[#333333]'
                  : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-white hover:text-[#333333]',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <div className="hidden max-w-44 border-r border-gray-300 pr-3 text-right lg:block">
            <p className="truncate text-xs font-bold text-[#333333]">{user?.full_name}</p>
            <p className="truncate font-mono text-[10px] text-gray-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(language === 'ru' ? 'kz' : 'ru')}
            className="grid h-10 min-w-10 place-items-center rounded-[9px] border border-transparent text-gray-600 hover:border-gray-300 hover:bg-white"
            title={language === 'ru' ? 'Қазақша' : 'Русский'}
            aria-label={language === 'ru' ? 'Қазақша' : 'Русский'}
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={logout}
            className="grid h-10 min-w-10 place-items-center rounded-[9px] border border-transparent text-gray-600 hover:border-gray-300 hover:bg-white hover:text-[#333333]"
            title={t('logout')}
            aria-label={t('logout')}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
