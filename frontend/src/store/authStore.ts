import { create } from 'zustand';
import type { UserInfo } from '../types';
import { login as apiLogin, register as apiRegister, googleAuth as apiGoogleAuth, getMe } from '../services/api';

/** Состояние авторизации */
interface AuthState {
  // Данные пользователя (null = не авторизован)
  user: UserInfo | null;
  // Токен хранится в localStorage, тут только флаг
  isAuthenticated: boolean;
  // Загрузка (проверка токена при старте)
  loading: boolean;
  // Ошибка последней операции
  error: string | null;

  // Действия
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  checkAuth: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true, // true по умолчанию — проверяем токен при старте
  error: null,

  login: async (email, password) => {
    set({ error: null, loading: true });
    try {
      const result = await apiLogin(email, password);
      localStorage.setItem('access_token', result.access_token);

      // Загружаем полную информацию о пользователе
      const user = await getMe();
      set({ user, isAuthenticated: true, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка входа';
      set({ error: message, loading: false });
      throw err;
    }
  },

  register: async (email, password, fullName) => {
    set({ error: null, loading: true });
    try {
      const result = await apiRegister(email, password, fullName);
      localStorage.setItem('access_token', result.access_token);

      // Загружаем полную информацию (is_active будет false)
      const user = await getMe();
      set({ user, isAuthenticated: true, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка регистрации';
      set({ error: message, loading: false });
      throw err;
    }
  },

  googleLogin: async (idToken) => {
    set({ error: null, loading: true });
    try {
      const result = await apiGoogleAuth(idToken);
      localStorage.setItem('access_token', result.access_token);
      const user = await getMe();
      set({ user, isAuthenticated: true, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка Google авторизации';
      set({ error: message, loading: false });
      throw err;
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ user: null, isAuthenticated: false, loading: false });
      return;
    }

    try {
      const user = await getMe();
      set({ user, isAuthenticated: true, loading: false });
    } catch {
      // Токен невалидный — удаляем
      localStorage.removeItem('access_token');
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, isAuthenticated: false, error: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
