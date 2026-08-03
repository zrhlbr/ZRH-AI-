import { StrictMode, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import './i18n';
import './index.css';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { ConversationsPage } from './pages/ConversationsPage';
import { LandingPage } from './pages/LandingPage';
import { ReleaseNotesPage } from './pages/ReleaseNotesPage';
import { StatusPage } from './pages/StatusPage';
import { ModelsPage } from './pages/ModelsPage';
import { AccountPage } from './pages/AccountPage';
import { MePage } from './pages/MePage';
import { SettingsPage } from './pages/SettingsPage';
import { useAuthStore } from './store/authStore';
import { ensureSession } from './api/client';
import { ZSkeletonLines } from './components/ui';
import { DEFAULT_THEME, applyThemeToDom } from './design-system/theme';
import { registerServiceWorker } from './pwa/install';

/** V2.0：首屏即蓝白默认，避免 FOUC；persist 再水合用户选择 */
applyThemeToDom(DEFAULT_THEME);
registerServiceWorker();

function PageFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-10">
      <ZSkeletonLines lines={5} />
    </div>
  );
}

// 聊天页（含 Markdown/Mermaid/KaTeX 渲染链）按需加载，保持首页轻量
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage').then((m) => ({ default: m.KnowledgePage })));
const RagPage = lazy(() => import('./pages/RagPage').then((m) => ({ default: m.RagPage })));
const AgentsPage = lazy(() => import('./pages/AgentsPage').then((m) => ({ default: m.AgentsPage })));
const ToolsPage = lazy(() => import('./pages/ToolsPage').then((m) => ({ default: m.ToolsPage })));
const McpPage = lazy(() => import('./pages/McpPage').then((m) => ({ default: m.McpPage })));
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })));
const BusinessPage = lazy(() => import('./pages/BusinessPage').then((m) => ({ default: m.BusinessPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const SuperAdminPage = lazy(() =>
  import('./pages/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage })),
);
const DeveloperPage = lazy(() =>
  import('./pages/DeveloperPage').then((m) => ({ default: m.DeveloperPage })),
);

/** 路由守卫：冷启动用 refresh 恢复 access token */
function RequireAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [booting, setBooting] = useState(Boolean(refreshToken && !accessToken));

  useEffect(() => {
    if (accessToken || !refreshToken) {
      setBooting(false);
      return;
    }
    let alive = true;
    void ensureSession().finally(() => {
      if (alive) setBooting(false);
    });
    return () => {
      alive = false;
    };
  }, [accessToken, refreshToken]);

  if (booting) return <PageFallback />;
  if (!useAuthStore.getState().accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/** 已登录（含资料）访问登录页 → 回首页；冷启动先尝试 refresh */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const profile = useAuthStore((s) => s.profile);
  const [booting, setBooting] = useState(Boolean(refreshToken && !accessToken));

  useEffect(() => {
    if (accessToken || !refreshToken) {
      setBooting(false);
      return;
    }
    let alive = true;
    void ensureSession().finally(() => {
      if (alive) setBooting(false);
    });
    return () => {
      alive = false;
    };
  }, [accessToken, refreshToken]);

  if (booting) return <PageFallback />;
  // 必须等待 profile 就绪，否则首页权限判断会在资料到达前执行
  if (useAuthStore.getState().accessToken && profile) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/release-notes', element: <ReleaseNotesPage /> },
  { path: '/login', element: <RedirectIfAuthed><LoginPage /></RedirectIfAuthed> },
  { path: '/register', element: <RedirectIfAuthed><RegisterPage /></RedirectIfAuthed> },
  {
    path: '/forgot-password',
    element: (
      <RedirectIfAuthed>
        <ForgotPasswordPage />
      </RedirectIfAuthed>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/home', element: <HomePage /> },
          { path: '/conversations', element: <ConversationsPage /> },
          { path: '/favorites', element: <ConversationsPage favoriteOnly /> },
          { path: '/chat', element: <Suspense fallback={<PageFallback />}><ChatPage /></Suspense> },
          { path: '/chat/:id', element: <Suspense fallback={<PageFallback />}><ChatPage /></Suspense> },
          { path: '/ai/models', element: <ModelsPage /> },
          { path: '/knowledge/*', element: <Suspense fallback={<PageFallback />}><KnowledgePage /></Suspense> },
          { path: '/rag/*', element: <Suspense fallback={<PageFallback />}><RagPage /></Suspense> },
          { path: '/agents/*', element: <Suspense fallback={<PageFallback />}><AgentsPage /></Suspense> },
          { path: '/tools/*', element: <Suspense fallback={<PageFallback />}><ToolsPage /></Suspense> },
          { path: '/mcp/*', element: <Suspense fallback={<PageFallback />}><McpPage /></Suspense> },
          { path: '/workflows/*', element: <Suspense fallback={<PageFallback />}><WorkflowsPage /></Suspense> },
          { path: '/business/*', element: <Suspense fallback={<PageFallback />}><BusinessPage /></Suspense> },
          { path: '/me', element: <MePage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/account', element: <AccountPage /> },
          { path: '/admin/*', element: <Suspense fallback={<PageFallback />}><AdminPage /></Suspense> },
          { path: '/superadmin/*', element: <Suspense fallback={<PageFallback />}><SuperAdminPage /></Suspense> },
          { path: '/developer/*', element: <Suspense fallback={<PageFallback />}><DeveloperPage /></Suspense> },
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
