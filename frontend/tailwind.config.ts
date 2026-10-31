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
      },
    },
  },
  plugins: [],
};

export default config;

