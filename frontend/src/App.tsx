import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LoginPage from './pages/LoginPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import AdminPage from './pages/AdminPage';
import ProactiveOffersPage from './pages/ProactiveOffersPage';
import ApplyPage from './pages/ApplyPage';
import StatusPage from './pages/StatusPage';
import GuidePage from './pages/GuidePage';
import { useAuthStore } from './store/authStore';

export default function App() {
  const { user, isAuthenticated, loading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    const lang = (localStorage.getItem('ui_language') as 'ru' | 'kz') || 'kz';
    return (
      <div className="min-h-screen bg-[#F4F4F4] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#C0F11C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">
            {lang === 'kz' ? 'Авторизация тексерілуде...' : 'Проверка авторизации...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/status/:id" element={<StatusPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} />
        {isAuthenticated ? (
          user && !user.is_active ? (
            <Route path="*" element={<AccessDeniedPage />} />
          ) : (
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/offers" element={<ProactiveOffersPage />} />
              <Route path="/admin" element={user?.is_admin ? <AdminPage /> : <Navigate to="/" replace />} />
            </Route>
          )
        ) : null}
        {isAuthenticated && user?.is_active !== false
          ? <Route path="*" element={<Navigate to="/" replace />} />
          : !isAuthenticated
            ? <Route path="*" element={<Navigate to="/login" replace />} />
            : null
        }
      </Routes>
    </BrowserRouter>
  );
}
