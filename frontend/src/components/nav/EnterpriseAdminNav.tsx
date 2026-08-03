import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { zrhIcons } from '../../design-system/icons';
import { useAuthStore } from '../../store/authStore';

/**
 * 企业管理入口 — 仅 ADMIN / SUPER_ADMIN。
 * 与普通用户导航隔离，普通用户永远不渲染本组件。
 */
export function EnterpriseAdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const role = profile?.role ?? '';
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return null;

  const items = [
    { to: '/rag', key: 'menu:rag', label: t('nav.rag'), icon: zrhIcons.rag },
    { to: '/agents', key: 'menu:agents', label: t('nav.agents'), icon: zrhIcons.agents },
    { to: '/tools', key: 'menu:tools', label: t('nav.tools'), icon: zrhIcons.tools },
    { to: '/mcp', key: 'menu:mcp', label: t('nav.mcp'), icon: zrhIcons.mcp },
    { to: '/workflows', key: 'menu:workflows', label: t('nav.workflows'), icon: zrhIcons.workflows },
    { to: '/business', key: 'menu:business', label: t('nav.business'), icon: zrhIcons.business },
    { to: '/ai/models', key: 'menu:ai-models', label: t('nav.models'), icon: zrhIcons.cpu },
    { to: '/developer', key: 'menu:developer', label: t('nav.developer'), icon: zrhIcons.tools },
    { to: '/status', key: 'menu:status', label: t('nav.status'), icon: zrhIcons.dashboard },
    { to: '/admin', key: 'menu:admin', label: t('nav.admin'), icon: zrhIcons.shield },
    { to: '/superadmin', key: 'menu:superadmin', label: t('nav.superadmin'), icon: zrhIcons.database },
  ].filter((item) => profile?.permissions.includes(item.key));

  if (items.length === 0) return null;

  return (
    <>
      <p className="mb-1 mt-4 px-3.5 text-[10px] font-semibold uppercase tracking-widest text-zrh-text-dim/70">
        {t('nav.enterprise')}
      </p>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
              isActive
                ? 'bg-zrh-accent/10 font-semibold text-zrh-accent'
                : 'text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text'
            }`
          }
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </>
  );
}
