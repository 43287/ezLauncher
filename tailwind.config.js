/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      transitionTimingFunction: {
        'apple-ease': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      boxShadow: {
        'soft': '0 4px 24px -4px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 8px 32px -4px rgba(0, 0, 0, 0.12)',
      },
      keyframes: {
        'fade-up-scale': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-down-scale': {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(8px) scale(0.95)' },
        },
        'menu-pop': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        }
      },
      animation: {
        'fade-up-scale': 'fade-up-scale 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-down-scale': 'fade-down-scale 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'menu-pop': 'menu-pop 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      }
    },
  },
  plugins: [],
}

