import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#ff4d6d',
          dark: '#c9184a',
        },
        // Theme tokens (values live in globals.css; dark by default, light under html[data-theme='light']).
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--c-ink-soft) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        highlight: 'rgb(var(--c-highlight) / <alpha-value>)',
        hud: '#8fd3ff',
        violet: '#b892ff',
        amber: '#ffb070',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Arial Black', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;

