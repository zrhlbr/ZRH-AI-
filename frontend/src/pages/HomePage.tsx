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

/**
 * V1.2.2 Mobile UI — 用户首页去状态化：
 * Logo + 欢迎语 + 输入框（居中，宽 92%，圆角 16px）。
 * 无实时状态 / CPU / GPU / Docker / 统计计数。
 */
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setPendingHomeMessage = useChatStore((s) => s.setPendingHomeMessage);
  const [input, setInput] = useState('');

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
      <div className="mx-auto flex min-h-full w-full max-w-full flex-col items-center justify-center px-0 py-8 sm:py-12">
        <motion.section
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={baseTransition}
          className="relative flex w-full flex-col items-center"
        >
          <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 sm:-top-20">
            <div className="zrh-ai-halo" aria-hidden />
            <div className="zrh-ai-halo zrh-ai-halo--slow" aria-hidden />
          </div>
          <AiCore className="pointer-events-none absolute -top-16 left-1/2 h-44 w-44 -translate-x-1/2 opacity-50 sm:-top-20 sm:h-60 sm:w-60 sm:opacity-60" />

          <div className="relative z-10 mt-16 flex w-[92%] max-w-xl flex-col items-center text-center sm:mt-20">
            <BrandMark size={88} className="zrh-logo-glow mb-4 h-16 w-16 rounded-2xl sm:mb-5 sm:h-20 sm:w-20" />
            <h1 className="text-2xl font-semibold leading-snug tracking-brand text-zrh-accent sm:text-3xl">
              {brand.name}
            </h1>
            <p className="mt-3 max-w-md text-sm font-normal leading-normal text-zrh-text-dim sm:text-base">
              {t('home.welcomeGreeting')}
            </p>
          </div>

          <form
            onSubmit={submit}
            className="zrh-glass-card relative z-10 mt-8 flex w-[92%] max-w-xl items-center gap-2 rounded-[16px] p-2.5 sm:mt-10 sm:p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('home.aiInputPlaceholder')}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-normal leading-normal text-zrh-text outline-none placeholder:text-zrh-text-dim/60"
              autoComplete="off"
            />
            <button
              type="submit"
              aria-label={t('home.send')}
              className="shrink-0 rounded-[12px] bg-zrh-accent p-2.5 text-zrh-on-accent transition-colors hover:bg-zrh-accent-soft"
            >
              <SendIcon className="h-4 w-4" aria-hidden />
            </button>
          </form>

          <p className="relative z-10 mt-3 w-[92%] max-w-xl text-center text-xs font-normal leading-normal text-zrh-text-dim/75">
            {t('home.aiInputStageHint')}
          </p>
        </motion.section>
      </div>
    </TechBackground>
  );
}
