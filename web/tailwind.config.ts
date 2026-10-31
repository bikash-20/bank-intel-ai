import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        mute: 'var(--mute)',
        brand: 'var(--brand)',
        'brand-ink': 'var(--brand-ink)',
        pill: 'var(--pill)',
        'pill-ink': 'var(--pill-ink)',
        ok: 'var(--ok)',
        okbg: 'var(--okbg)',
        bad: 'var(--bad)',
        badbg: 'var(--badbg)',
      },
      fontFamily: {
        sans: ['var(--sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--serif)', 'Georgia', 'serif'],
      },
      borderRadius: {
        pill: '999px',
        stat: '28px',
        panel: '36px',
        card: '44px',
      },
      boxShadow: {
        theme: 'var(--shadow)',
      },
    },
  },
  plugins: [],
};

export default config;
