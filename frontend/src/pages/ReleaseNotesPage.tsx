import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TechBackground } from '../components/background/TechBackground';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { BrandMark } from '../design-system/BrandMark';
import { brand } from '../design-system/theme';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { useAuthStore } from '../store/authStore';

type NoteKey = 'v120' | 'v110';

const NOTES: Array<{
  key: NoteKey;
  version: string;
  date: string;
}> = [
  { key: 'v120', version: 'V1.2.0', date: '2026-08-02' },
  { key: 'v110', version: 'V1.1.0', date: '2026-08-01' },
];

/**
 * 版本更新记录 — 纯前端文案页，Design System V2.0
 */
export function ReleaseNotesPage() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);

  return (
    <TechBackground>
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Link to={accessToken ? '/home' : '/'} className="flex items-center gap-2.5">
            <BrandMark size={36} className="h-9 w-9 rounded-zrh-md shadow-zrh-glow" />
            <span className="text-sm font-bold tracking-brand text-zrh-accent">{brand.name}</span>
          </Link>
          <LanguageSwitcher />
        </header>

        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={baseTransition}>
          <h1 className="text-2xl font-semibold text-zrh-text sm:text-3xl">{t('releaseNotes.title')}</h1>
          <p className="mt-2 text-sm text-zrh-text-dim">{t('releaseNotes.subtitle')}</p>
          <p className="mt-3 inline-flex rounded-full border border-zrh-accent/30 bg-zrh-accent/10 px-3 py-1 text-caption font-medium text-zrh-accent">
            {t('releaseNotes.currentVersion', { version: brand.appVersion })}
          </p>

          <div className="mt-8 flex flex-col gap-6">
            {NOTES.map((note) => {
              const highlights = t(`releaseNotes.${note.key}.highlights`, {
                returnObjects: true,
              }) as string[];
              const fixes = t(`releaseNotes.${note.key}.fixes`, { returnObjects: true }) as string[];
              const known = t(`releaseNotes.${note.key}.known`, { returnObjects: true }) as string[];
              return (
                <article
                  key={note.version}
                  className="zrh-glass zrh-glow-border rounded-zrh-2xl p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold text-zrh-accent">{note.version}</h2>
                    <time className="text-caption text-zrh-text-dim">{note.date}</time>
                  </div>
                  <p className="mt-2 text-sm text-zrh-text">{t(`releaseNotes.${note.key}.summary`)}</p>

                  <Section title={t('releaseNotes.updates')} items={highlights} />
                  <Section title={t('releaseNotes.fixes')} items={fixes} />
                  {Array.isArray(known) && known.length > 0 && (
                    <Section title={t('releaseNotes.knownIssues')} items={known} />
                  )}
                </article>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap gap-4 text-sm">
            <Link to={accessToken ? '/home' : '/'} className="text-zrh-accent hover:underline">
              {t('releaseNotes.backHome')}
            </Link>
            {!accessToken && (
              <>
                <Link to="/register" className="text-zrh-accent hover:underline">
                  {t('landing.registerNow')}
                </Link>
                <Link to="/login" className="text-zrh-text-dim hover:text-zrh-accent">
                  {t('landing.login')}
                </Link>
              </>
            )}
          </div>
          <p className="mt-8 text-center text-caption text-zrh-text-dim">{brand.copyright}</p>
        </motion.div>
      </div>
    </TechBackground>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-hud text-zrh-text-dim">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zrh-text">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
