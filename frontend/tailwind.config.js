/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zrh: {
          bg: 'var(--zrh-bg)',
          surface: 'var(--zrh-surface)',
          border: 'var(--zrh-border)',
          gold: 'var(--zrh-gold)',
          'gold-soft': 'var(--zrh-gold-soft)',
          text: 'var(--zrh-text)',
          'text-dim': 'var(--zrh-text-dim)',
          ok: 'var(--zrh-ok)',
          err: 'var(--zrh-err)',
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
