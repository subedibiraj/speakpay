/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-body)'],
        display: ['var(--font-display)'],
        nepali:  ['var(--font-nepali)'],
      },
      colors: {
        ink:   { DEFAULT: '#09090b', 50: '#27272a', 800: '#18181b', 900: '#121214' },
        teal:  { DEFAULT: '#14b8a6', light: '#2dd4bf', dark: '#0f766e' },
        amber: { DEFAULT: '#f59e0b', light: '#fbbf24' },
        slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
                 400: '#94a3b8', 600: '#475569', 800: '#1e293b' },
        glass: { DEFAULT: 'rgba(255, 255, 255, 0.03)', border: 'rgba(255, 255, 255, 0.08)' }
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
      boxShadow: {
        'card':  '0 8px 32px rgba(0,0,0,0.4)',
        'float': '0 8px 32px rgba(20,184,166,0.18)',
      },
      keyframes: {
        pulse_ring: {
          '0%,100%': { transform: 'scale(1)',   opacity: '0.6' },
          '50%':     { transform: 'scale(1.25)', opacity: '0.2' },
        },
        waveform: {
          '0%,100%': { scaleY: '0.3' },
          '50%':     { scaleY: '1'   },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
      },
      animation: {
        pulse_ring: 'pulse_ring 1.4s ease-in-out infinite',
        waveform:   'waveform 0.6s ease-in-out infinite',
        'fade-up':  'fade-up 0.4s ease-out both',
      },
    },
  },
  plugins: [],
}
