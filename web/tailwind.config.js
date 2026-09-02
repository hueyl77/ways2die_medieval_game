/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        vellum: { DEFAULT: '#ECEAE2', 2: '#F7F5EF', 3: '#E2DED2' },
        ink: { DEFAULT: '#262019', 2: '#6C655A' },
        night: { DEFAULT: '#14161C', 2: '#1D2028', 3: '#2A2E39' },
        parchment: '#E9E5DB',
        gold: { DEFAULT: '#D8A84F', deep: '#8F6A1C', soft: '#EDE2C6' },
        blood: { DEFAULT: '#C4502F', deep: '#93392B' },
        heal: { DEFAULT: '#6C9A5B', deep: '#4A6B3F' },
        moon: { DEFAULT: '#8FB3CE', deep: '#41607A' },
      },
      fontFamily: {
        display: ['Eczar', 'Georgia', 'serif'],
        body: ['Alegreya', 'Georgia', 'serif'],
        ui: ['"Alegreya Sans"', '"Gill Sans"', 'Verdana', 'sans-serif'],
      },
      boxShadow: { card: '0 6px 18px rgba(0,0,0,.35)', glow: '0 0 0 3px rgba(216,168,79,.55)' },
    },
  },
  plugins: [],
};
