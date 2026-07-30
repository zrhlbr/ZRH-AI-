import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import './i18n';
import './index.css';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { StatusPage } from './pages/StatusPage';
import { useAuthStore } from './store/authStore';

/** 路由守卫：未登录跳转登录页 */
function RequireAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/** 已登录（含资料）访问登录页 → 回首页 */
function RedirectIfAuthed() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const profile = useAuthStore((s) => s.profile);
  // 必须等待 profile 就绪，否则首页权限判断会在资料到达前执行
  if (accessToken && profile) {
    return <Navigate to="/" replace />;
  }
  return <LoginPage />;
}

const router = createBrowserRouter([
  { path: '/login', element: <RedirectIfAuthed /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/status', element: <StatusPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
