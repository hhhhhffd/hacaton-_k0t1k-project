import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Wheat, Users, LogOut,
  Globe, UserPlus, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

export default function Sidebar() {
  const { t, language } = useTranslation();
  const { user, logout } = useAuthStore();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const [collapsed, setCollapsed] = useState(false);

  function toggleLanguage() {
    setLanguage(language === 'ru' ? 'kz' : 'ru');
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
      collapsed ? 'justify-center' : ''
    } ${
      isActive
        ? 'bg-[#C0F11C] text-[#333333]'
        : 'text-gray-600 hover:bg-[#C0F11C]/20 hover:text-[#333333]'
    }`;

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-64'} h-full bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden transition-all duration-300`}
    >
      {/* Логотип */}
      <div className={`flex items-center border-b border-gray-100 py-5 ${collapsed ? 'justify-center px-3' : 'px-5'}`}>
        {!collapsed && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[#C0F11C] rounded-xl flex items-center justify-center shrink-0">
              <Wheat className="w-4 h-4 text-[#333333]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-gray-900 leading-tight tracking-tight">_k0t1k</h1>
              <p className="text-xs text-gray-400">AI Scoring</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-9 h-9 bg-[#C0F11C] rounded-xl flex items-center justify-center">
            <Wheat className="w-4 h-4 text-[#333333]" />
          </div>
        )}
      </div>

      {/* Навигация */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-hidden">
        <NavLink to="/" className={linkClass} end title={collapsed ? t('nav.dashboard') : undefined}>
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">{t('nav.dashboard')}</span>}
        </NavLink>
        <NavLink to="/analytics" className={linkClass} title={collapsed ? t('nav.analytics') : undefined}>
          <BarChart3 className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">{t('nav.analytics')}</span>}
        </NavLink>
        <NavLink to="/offers" className={linkClass} title={collapsed ? t('nav.offers') : undefined}>
          <UserPlus className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate">{t('nav.offers')}</span>}
        </NavLink>
        {user?.is_admin && (
          <NavLink to="/admin" className={linkClass} title={collapsed ? t('nav.users') : undefined}>
            <Users className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="truncate">{t('nav.users')}</span>}
          </NavLink>
        )}
      </nav>

      {/* Пользователь, язык, выход */}
      <div className={`px-3 py-4 border-t border-gray-100 space-y-1`}>
        {user && !collapsed && (
          <div className="flex items-center gap-3 mb-2 px-1">
            <div className="w-8 h-8 bg-[#C0F11C] rounded-full flex items-center justify-center shrink-0">
              <span className="text-xs font-extrabold text-[#333333]">
                {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900 font-semibold truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div className="flex justify-center mb-2">
            <div className="w-8 h-8 bg-[#C0F11C] rounded-full flex items-center justify-center">
              <span className="text-xs font-extrabold text-[#333333]">
                {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={toggleLanguage}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-[#C0F11C]/20 hover:text-[#333333] transition-all ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? (language === 'ru' ? 'Русский' : 'Қазақша') : undefined}
        >
          <Globe className="w-4 h-4 shrink-0" />
          {!collapsed && (language === 'ru' ? 'Русский (RU)' : 'Қазақша (KZ)')}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-[#C0F11C]/20 hover:text-[#333333] transition-all ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
        >
          {collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
          {!collapsed && <span>{t('nav.collapse')}</span>}
        </button>

        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-white hover:text-[#333333] transition-all ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? t('logout') : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && t('logout')}
        </button>
      </div>

      {/* Подвал */}
      {!collapsed && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">Decentrathon 5.0</p>
          <p className="text-xs text-gray-500 mt-0.5">DataNomads Team</p>
        </div>
      )}
    </aside>
  );
}
