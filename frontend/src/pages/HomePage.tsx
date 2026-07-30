import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Cpu } from 'lucide-react';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-6 py-10 text-center sm:py-16"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-zrh-gold/40 bg-zrh-surface">
        <Cpu className="h-10 w-10 text-zrh-gold" aria-hidden />
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-widest text-zrh-gold sm:text-5xl">
          {t('app.name')}
        </h1>
        <p className="mt-3 text-sm text-zrh-text-dim sm:text-base">{t('app.tagline')}</p>
      </div>
      <span className="rounded-full border border-zrh-gold/40 px-4 py-1 text-xs text-zrh-gold sm:text-sm">
        {t('home.stage')}
      </span>
      <p className="max-w-md text-sm leading-relaxed text-zrh-text-dim">{t('home.notice')}</p>
    </motion.section>
  );
}
