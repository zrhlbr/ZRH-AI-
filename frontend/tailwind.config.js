/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zrh: {
          bg: 'var(--zrh-bg)',
          surface: 'var(--zrh-surface)',
          'surface-raised': 'var(--zrh-surface-raised)',
          border: 'var(--zrh-border)',
          'border-glow': 'var(--zrh-border-glow)',
          accent: 'var(--zrh-accent)',
          'accent-soft': 'var(--zrh-accent-soft)',
          'tech-blue': 'var(--zrh-tech-blue)',
          text: 'var(--zrh-text)',
          'text-dim': 'var(--zrh-text-dim)',
          ok: 'var(--zrh-ok)',
          warn: 'var(--zrh-warn)',
          err: 'var(--zrh-err)',
          // 兼容别名（黑金主题下与 accent 一致）
          gold: 'var(--zrh-accent)',
          'gold-soft': 'var(--zrh-accent-soft)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'PingFang SC',
          'Microsoft YaHei',
          'Noto Sans Myanmar',
          'sans-serif',
        ],
        myanmar: ['Noto Sans Myanmar', 'Padauk', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
