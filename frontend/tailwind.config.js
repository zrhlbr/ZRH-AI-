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
          'on-accent': 'var(--zrh-on-accent)',
          text: 'var(--zrh-text)',
          'text-dim': 'var(--zrh-text-dim)',
          ok: 'var(--zrh-ok)',
          warn: 'var(--zrh-warn)',
          err: 'var(--zrh-err)',
          gold: 'var(--zrh-accent)',
          'gold-soft': 'var(--zrh-accent-soft)',
        },
      },
      fontFamily: {
        sans: [
          'Space Grotesk',
          'Noto Sans SC',
          'Noto Sans Myanmar',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
        display: ['Space Grotesk', 'Noto Sans SC', 'sans-serif'],
        myanmar: ['Noto Sans Myanmar', 'Padauk', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        caption: ['0.6875rem', { lineHeight: '1.35' }],
      },
      letterSpacing: {
        brand: '0.18em',
        hud: '0.08em',
      },
      borderRadius: {
        'zrh-sm': '0.375rem',
        'zrh-md': '0.5rem',
        'zrh-lg': '0.75rem',
        'zrh-xl': '1rem',
        'zrh-2xl': '1.25rem',
      },
      boxShadow: {
        'zrh-card': 'var(--zrh-shadow-card)',
        'zrh-raised': 'var(--zrh-shadow-raised)',
        'zrh-modal': 'var(--zrh-shadow-modal)',
        'zrh-glow': '0 0 0 1px var(--zrh-border-glow), 0 0 28px -8px var(--zrh-border-glow)',
        'zrh-header': 'var(--zrh-shadow-header)',
      },
      transitionTimingFunction: {
        zrh: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
