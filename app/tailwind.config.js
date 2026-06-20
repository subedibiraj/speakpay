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
        ink:   { DEFAULT: '#0D0D0D', 50: '#F5F5F0' },
        teal:  { DEFAULT: '#0F7173', light: '#12969A', dark: '#094E50' },
        amber: { DEFAULT: '#E8A838', light: '#F2C46D' },
        slate: { 50: '#F8F9FA', 100: '#EEF0F2', 200: '#D8DDE3',
                 400: '#8D99A6', 600: '#4A5568', 800: '#1A202C' },
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
      boxShadow: {
        'card':  '0 2px 16px rgba(0,0,0,0.06)',
        'float': '0 8px 32px rgba(15,113,115,0.18)',
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
