/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // All colors reference CSS variables so the theme can switch at runtime.
      // Variables are space-separated RGB channels (no rgb() wrapper) so
      // Tailwind opacity modifiers like bg-gold/10 work correctly.
      colors: {
        gold: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          light:   'rgb(var(--accent-light) / <alpha-value>)',
          dark:    'rgb(var(--accent-dark) / <alpha-value>)',
          muted:   'rgb(var(--accent-muted) / <alpha-value>)',
        },
        surface: {
          DEFAULT:  'rgb(var(--surface) / <alpha-value>)',
          elevated: 'rgb(var(--surface-el) / <alpha-value>)',
          hover:    'rgb(var(--surface-hv) / <alpha-value>)',
        },
        verdant: 'rgb(var(--verdant) / <alpha-value>)',
        brand: {
          bg:     'rgb(var(--bg) / <alpha-value>)',
          border: 'rgb(var(--border) / <alpha-value>)',
          text:   'rgb(var(--text) / <alpha-value>)',
          muted:  'rgb(var(--text-muted) / <alpha-value>)',
          subtle: 'rgb(var(--text-subtle) / <alpha-value>)',
        },
      },
      fontFamily: {
        heading: ['Fraunces', 'Georgia', 'serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        body:    ['Archivo', 'system-ui', 'sans-serif'],
        mono:    ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        gold:    'var(--shadow-accent)',
        'gold-sm': 'var(--shadow-accent-sm)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'pulse-gold': 'pulseGold 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--accent) / 0.4)' },
          '50%':      { boxShadow: '0 0 0 8px rgb(var(--accent) / 0)' },
        },
      },
    },
  },
  plugins: [],
}
