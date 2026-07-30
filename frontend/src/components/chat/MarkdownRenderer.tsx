import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

/** Mermaid 图：动态 import，渲染失败时回退源码展示 */
function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
        const { svg } = await mermaid.render(`zrh-mmd-${Math.random().toString(36).slice(2)}`, code);
        if (alive && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-zrh-text-dim">
        <code>{code}</code>
      </pre>
    );
  }
  return <div ref={ref} className="zrh-mermaid overflow-x-auto py-2 [&_svg]:mx-auto [&_svg]:max-w-full" />;
}

/** 代码块容器：语言徽标 + 一键复制；children 为 highlight.js 处理后的 code 节点 */
function CodeBlock({ language, code, children }: { language: string; code: string; children?: ReactNode }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默
    }
  };

  return (
    <div className="group/code relative my-2 overflow-hidden rounded-lg border border-zrh-border/60 bg-black/50">
      <div className="flex items-center justify-between border-b border-zrh-border/40 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-zrh-text-dim">{language || 'text'}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-1 text-[10px] text-zrh-text-dim transition-colors hover:text-zrh-accent"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? t('chat.copied') : t('chat.copy')}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">{children ?? <code>{code}</code>}</pre>
    </div>
  );
}

interface PreProps {
  children?: ReactNode;
}

/** 递归提取 React 节点中的纯文本（highlight spans 嵌套时用于复制） */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object' && 'props' in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

/** 接管 <pre>：识别 mermaid / 提取语言与源码 */
function PreRenderer({ children }: PreProps) {
  // react-markdown 结构：<pre><code className="language-x">...</code></pre>
  const child = Array.isArray(children) ? children[0] : children;
  if (child && typeof child === 'object' && 'props' in (child as Record<string, unknown>)) {
    const codeEl = child as { props: { className?: string; children?: ReactNode } };
    const className = codeEl.props.className ?? '';
    const match = /language-(\w+)/.exec(className);
    const language = match?.[1] ?? '';
    const code = textOf(codeEl.props.children).replace(/\n$/, '');
    if (language === 'mermaid') return <MermaidBlock code={code} />;
    // 保留原始 code 节点（含 highlight.js 高亮 spans），raw 文本仅用于复制
    return <CodeBlock language={language} code={code}>{child as ReactNode}</CodeBlock>;
  }
  return <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs">{children}</pre>;
}

export interface MarkdownRendererProps {
  content: string;
  /** 流式输出中：末尾追加呼吸光标 */
  streaming?: boolean;
}

/**
 * Markdown 渲染器：GFM 表格 / 代码高亮 / 复制 / Mermaid / LaTeX(KaTeX)。
 * memo 化保证长聊天中历史消息不重复渲染（按需渲染）。
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({ content, streaming }: MarkdownRendererProps) {
  return (
    <div className="zrh-markdown text-sm leading-relaxed text-zrh-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }], rehypeKatex]}
        components={{
          pre: PreRenderer,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-zrh-border/60">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-zrh-border bg-zrh-surface-raised px-3 py-2 text-left font-semibold text-zrh-accent">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-zrh-border/40 px-3 py-2">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-zrh-accent/60 bg-zrh-accent/5 px-3 py-1.5 text-zrh-text-dim">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-zrh-accent underline-offset-2 hover:underline">
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            // 行内代码（块级已由 PreRenderer 接管）
            if (className) return <code className={className}>{children}</code>;
            return (
              <code className="rounded bg-zrh-accent/10 px-1.5 py-0.5 text-[0.85em] text-zrh-accent">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && <span className="zrh-stream-cursor" aria-hidden />}
    </div>
  );
});
