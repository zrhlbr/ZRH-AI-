import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();

  return (
    <div
      className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}
      aria-label={t('language.label')}
    >
      {SUPPORTED_LANGUAGES.map((lng: SupportedLanguage) => {
        const active = i18n.language === lng;
        return (
          <button
            key={lng}
            type="button"
            data-testid={`lang-${lng}`}
            onClick={() => void i18n.changeLanguage(lng)}
            className={`rounded-md font-medium transition-colors ${
              compact ? 'min-h-8 px-2 py-1 text-[11px] sm:text-xs' : 'min-h-9 px-2.5 py-1.5 text-xs sm:text-sm'
            } ${
              active
                ? 'bg-zrh-accent text-zrh-on-accent font-semibold'
                : 'text-zrh-text-dim hover:text-zrh-accent'
            }`}
          >
            {t(`language.${lng}`)}
          </button>
        );
      })}
    </div>
  );
}
