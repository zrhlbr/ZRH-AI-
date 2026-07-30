import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <div className="flex items-center gap-1" aria-label={t('language.label')}>
      {SUPPORTED_LANGUAGES.map((lng: SupportedLanguage) => {
        const active = i18n.language === lng;
        return (
          <button
            key={lng}
            type="button"
            data-testid={`lang-${lng}`}
            onClick={() => void i18n.changeLanguage(lng)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors sm:text-sm ${
              active
                ? 'bg-zrh-gold text-zrh-bg font-semibold'
                : 'text-zrh-text-dim hover:text-zrh-gold'
            }`}
          >
            {t(`language.${lng}`)}
          </button>
        );
      })}
    </div>
  );
}
