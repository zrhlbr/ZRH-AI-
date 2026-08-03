import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { zrhIcons } from '../../design-system/icons';

export function ZEmpty({
  title,
  description,
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const { t } = useTranslation();
  const Icon = zrhIcons.dashboard;
  return (
    <div className="zrh-empty flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zrh-accent/30 bg-zrh-accent/5 text-zrh-accent">
        {icon ?? <Icon className="h-5 w-5" aria-hidden />}
      </div>
      <p className="text-sm font-semibold tracking-wide text-zrh-text">{title ?? t('common.empty')}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed text-zrh-text-dim">{description}</p>}
      {action}
    </div>
  );
}
