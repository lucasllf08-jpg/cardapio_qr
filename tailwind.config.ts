import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#f4f5f7', surface: '#ffffff', raised: '#f1f2f4', line: '#e4e6ea',
        bone: '#16181d', muted: '#6b7280', accent: '#f0280f', side: '#101010',
      },
      fontFamily: { display: ['var(--font-urbanist)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
