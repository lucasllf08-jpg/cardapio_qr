import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#140f10', surface: '#1b1416', raised: '#251b1e', line: '#3a2d31',
        bone: '#efe7dc', muted: '#a09390', brass: '#c9a15c', wine: '#7a2e3a', sage: '#86a98d',
      },
      fontFamily: { display: ['var(--font-fraunces)', 'Georgia', 'serif'] },
    },
  },
  plugins: [],
};
export default config;
