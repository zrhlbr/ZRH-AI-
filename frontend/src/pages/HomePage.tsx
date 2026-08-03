import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { zrhIcons } from '../design-system/icons';
import { brand } from '../design-system/theme';
import { BrandMark } from '../design-system/BrandMark';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { useChatStore } from '../store/chatStore';

const QUICK_PROMPT_KEYS = ['home.quickPrompt1', 'home.quickPrompt2', 'home.quickPrompt3', 'home.quickPrompt4'];

/**
 * UX V4.0 用户首页 —— 彻底去企业化：
 * 仅 LOGO / 欢迎语 / 一句介绍 / AI 输入框 / 发送按钮 / 快捷问题 / 历史聊天入口。
 * 纯净背景（Cosmos 背景仅 Landing/Login/Register/Forgot 使用），
 * 无任何 CPU/GPU/Docker/Runtime/统计/在线状态/监控模块。
 */
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setPendingHomeMessage = useChatStore((s) => s.setPendingHomeMessage);
  const [input, setInput] = useState('');

  const startChat = (value: string) => {
    const message = value.trim();
    if (!message) return;
    setPendingHomeMessage(message);
    navigate('/chat');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startChat(input);
  };

  const SendIcon = zrhIcons.send;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-full flex-col items-center justify-center overflow-x-hidden bg-zrh-bg px-0 py-8 sm:py-12">
      <motion.section
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        transition={baseTransition}
        className="flex w-full flex-col items-center"
      >
        <div className="flex w-[92%] max-w-xl flex-col items-center text-center">
          <BrandMark size={88} className="zrh-logo-glow mb-4 h-16 w-16 rounded-2xl sm:mb-5 sm:h-20 sm:w-20" />
          <h1 className="text-2xl font-semibold leading-snug tracking-brand text-zrh-accent sm:text-3xl">
            {brand.name}
          </h1>
          <p className="mt-3 max-w-md text-sm font-normal leading-normal text-zrh-text-dim sm:text-base">
            {t('home.welcomeGreeting')}
          </p>
          <p className="mt-1.5 max-w-md text-xs font-normal leading-normal text-zrh-text-dim/75 sm:text-sm">
            {t('home.intro')}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="zrh-glass-card mt-8 flex w-[92%] max-w-xl items-center gap-2 rounded-[16px] p-2.5 sm:mt-10 sm:p-3"
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

        {/* 快捷问题 */}
        <div className="mt-4 flex w-[92%] max-w-xl flex-wrap items-center justify-center gap-2">
          {QUICK_PROMPT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => startChat(t(key))}
              className="rounded-full border border-zrh-border/70 bg-zrh-surface/60 px-3.5 py-1.5 text-xs text-zrh-text-dim transition-colors hover:border-zrh-accent/50 hover:text-zrh-text"
            >
              {t(key)}
            </button>
          ))}
        </div>

        {/* 历史聊天入口 */}
        <Link
          to="/conversations"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-zrh-text-dim transition-colors hover:text-zrh-accent"
        >
          <History className="h-3.5 w-3.5" aria-hidden />
          {t('home.historyEntry')}
        </Link>
      </motion.section>
    </div>
  );
}
