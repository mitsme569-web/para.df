import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:        '#1a1a1a',
          teal:        '#0d4f46',
          'teal-mid':  '#0f6357',
          'teal-light':'#13796a',
          cream:       '#ffffeb',
          lavender:    '#f0d7ff',
        },
        surface: {
          DEFAULT: '#1a1a1a',
          raised:  '#222222',
          card:    '#242424',
          border:  'rgba(255,255,255,0.08)',
          glass:   'rgba(13,79,70,0.12)',
        },
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        segoe:   ['"Segoe UI"', '"Segoe UI Light"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(13, 79, 70, 0.45), transparent 70%), linear-gradient(180deg, #111817 0%, #0d221f 55%, #0a1f1c 100%)',
      },
      animation: {
        'fade-up':    'fadeUp 0.6s ease-out both',
        'fade-in':    'fadeIn 0.4s ease-out both',
        'shimmer':    'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake':      'shake 0.4s ease-in-out',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
