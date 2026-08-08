import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// GENSPACE design tokens — pulled directly from the brand brief.
// Keep this file the single source of truth for color/radius/type decisions;
// components should reference these tokens, not raw hex values.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F26B3A',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#FFF6EE',
          foreground: '#1B1B1B',
        },
        dark: '#1B1B1B',
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#1B1B1B',
        },
        muted: {
          DEFAULT: '#E5E5E5',
          foreground: '#6B6B6B',
        },
        border: {
          DEFAULT: 'rgba(27, 27, 27, 0.08)',
          dark: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(27, 27, 27, 0.08)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
