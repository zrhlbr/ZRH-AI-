import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TechBackground } from '../components/background/TechBackground';
import { AiCore } from '../components/background/AiCore';
import { zrhIcons } from '../design-system/icons';
import { brand } from '../design-system/theme';
import { BrandMark } from '../design-system/BrandMark';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

/**
 * 用户首页 — ChatGPT 式简洁欢迎页
 * Logo / 欢迎语 / 输入框；无服务器监控、无 CPU/GPU/Docker 等企业状态。
 */
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const setPendingHomeMessage = useChatStore((s) => s.setPendingHomeMessage);
  const [input, setInput] = useState('');
  const canKnowledge = hasPermission('menu:knowledge');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setPendingHomeMessage(value);
    navigate('/chat');
  };

  const SendIcon = zrhIcons.send;

  return (
    <TechBackground variant="home" globe={false}>
      <div className="mx-auto flex min-h-[calc(100dvh-3.25rem)] w-full max-w-3xl flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
        <motion.section
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={baseTransition}
          className="relative flex w-full flex-col items-center"
        >
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 sm:-top-24">
            <div className="zrh-ai-halo" aria-hidden />
            <div className="zrh-ai-halo zrh-ai-halo--slow" aria-hidden />
          </div>
          <AiCore className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 opacity-55 sm:-top-24 sm:h-64 sm:w-64 sm:opacity-65" />

          <div className="relative z-10 mt-20 flex flex-col items-center text-center sm:mt-24">
            <BrandMark size={96} className="zrh-logo-glow mb-5 h-[4.5rem] w-[4.5rem] rounded-zrh-2xl sm:mb-6 sm:h-24 sm:w-24" />
            <h1 className="zrh-landing-display text-3xl sm:text-4xl">{brand.name}</h1>
            <p className="zrh-landing-lead mt-3 max-w-md text-sm sm:text-base">{t('home.welcomeGreeting')}</p>
          </div>

          <form
            onSubmit={submit}
            className="zrh-glass-card relative z-10 mt-8 flex w-full max-w-xl items-center gap-2 rounded-zrh-2xl p-2.5 sm:mt-10 sm:p-3.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('home.aiInputPlaceholder')}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-zrh-text outline-none placeholder:text-zrh-text-dim/60"
              autoComplete="off"
            />
            <button
              type="submit"
              aria-label={t('home.send')}
              className="shrink-0 rounded-zrh-lg bg-zrh-accent p-2.5 text-zrh-on-accent transition-colors hover:bg-zrh-accent-soft"
            >
              <SendIcon className="h-4 w-4" aria-hidden />
            </button>
          </form>

          <p className="relative z-10 mt-4 max-w-md text-center text-caption text-zrh-text-dim/75">
            {t('home.aiInputStageHint')}
          </p>

          <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-zrh-text backdrop-blur transition hover:bg-white/16"
            >
              {t('nav.chat')}
            </button>
            {canKnowledge && (
              <button
                type="button"
                onClick={() => navigate('/knowledge')}
                className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs text-zrh-text backdrop-blur transition hover:bg-white/16"
              >
                {t('nav.knowledge')}
              </button>
            )}
          </div>
        </motion.section>
      </div>
    </TechBackground>
  );
}
