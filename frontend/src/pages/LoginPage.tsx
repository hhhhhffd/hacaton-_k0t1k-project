import { useState, useEffect, useCallback, useRef } from 'react';
import { Wheat, LogIn, UserPlus, Mail, Lock, User, AlertCircle, Globe } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n/useTranslation';
import { useAppStore } from '../store/appStore';

/** Google Sign-In типизация (GSI SDK) */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            ux_mode?: string;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: string;
              size?: string;
              width?: number;
              text?: string;
              shape?: string;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

/** ID клиента Google OAuth — из переменных окружения */
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/** Иконка Google для fallback кнопки */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** Страница входа и регистрации — по центру на весь экран */
export default function LoginPage() {
  const { t, language } = useTranslation();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, register, googleLogin, error: storeError, clearError } = useAuthStore();

  const error = localError || storeError;
  const googleBtnRef = useRef<HTMLDivElement>(null);

  /** Callback от Google Sign-In — получаем id_token */
  const handleGoogleCallback = useCallback(
    async (response: { credential: string }) => {
      setLocalError(null);
      clearError();
      setSubmitting(true);
      try {
        await googleLogin(response.credential);
      } catch {
        // Ошибка уже в сторе
      } finally {
        setSubmitting(false);
      }
    },
    [googleLogin, clearError],
  );

  /** Инициализируем Google Sign-In SDK и рендерим кнопку */
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;

    const initGoogle = () => {
      if (!window.google || !googleBtnRef.current) return;
      
      // Очищаем контейнер перед перерендером
      googleBtnRef.current.innerHTML = '';
      
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
        ux_mode: 'popup',
      });
      
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: mode === 'login' ? 'signin_with' : 'signup_with',
        shape: 'rectangular',
        locale: language === 'kz' ? 'kk' : 'ru',
      });
    };

    // SDK может быть ещё не загружен — ждём
    if (window.google) {
      initGoogle();
    } else {
      const timer = setInterval(() => {
        if (window.google) {
          clearInterval(timer);
          initGoogle();
        }
      }, 200);
      return () => clearInterval(timer);
    }
  }, [handleGoogleCallback, language, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !password) {
      setLocalError(t('auth.fillAllFields'));
      return;
    }

    if (mode === 'register' && !fullName.trim()) {
      setLocalError(t('auth.enterName'));
      return;
    }

    if (password.length < 6) {
      setLocalError(t('auth.passwordMin'));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, fullName.trim());
      }
    } catch {
      // Ошибка уже в сторе
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setLocalError(null);
    clearError();
  };

  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
      {/* Карточка входа — строго по центру */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#C0F11C] rounded-2xl mb-4">
            <Wheat className="w-8 h-8 text-[#333333]" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">_k0t1k Project</h1>
          <p className="text-gray-500 mt-2">{t('auth.subtitle')}</p>
        </div>

        {/* Форма */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">
            {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
          </h2>

          {/* Google Sign-In кнопка */}
          {GOOGLE_CLIENT_ID ? (
            <>
              <div ref={googleBtnRef} className="flex justify-center w-full min-h-[44px]" />
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-sm text-gray-400">{t('auth.or')}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => alert(t('auth.googleUnavailable'))}
                className="w-full flex items-center justify-center gap-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl py-3 px-4 text-gray-500 transition-colors"
              >
                <GoogleIcon className="w-5 h-5 grayscale opacity-60" />
                <span>{mode === 'login' ? t('auth.googleLogin') : t('auth.googleRegister')}</span>
              </button>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-sm text-gray-400">{t('auth.or')}</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">{t('auth.fullName')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('auth.fullNamePlaceholder')}
                    className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[#333333] bg-[#DC2626] rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-[#C0F11C] hover:brightness-95 disabled:opacity-50 text-[#333333] font-medium py-2.5 rounded-lg transition-colors"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-[#080000]/30 border-t-[#080000] rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  {t('auth.loginButton')}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  {t('auth.registerButton')}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={switchMode}
              className="text-sm text-gray-500 hover:text-[#333333] transition-colors"
            >
              {mode === 'login'
                ? t('auth.noAccount')
                : t('auth.hasAccount')}
            </button>
          </div>

          {/* Переключатель языка */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-center">
            <button
              onClick={() => setLanguage(language === 'ru' ? 'kz' : 'ru')}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <Globe className="w-4 h-4" />
              {language === 'ru' ? 'Қазақша' : 'Русский'}
            </button>
          </div>
        </div>

        {/* Подвал */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Decentrathon 5.0 &middot; DataNomads Team
        </p>
      </div>
    </div>
  );
}
