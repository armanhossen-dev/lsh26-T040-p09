/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff', 100: '#dae6ff', 200: '#bdd2ff', 300: '#90b3ff',
          400: '#5b89fc', 500: '#3563f3', 600: '#1f43e0', 700: '#1a35b5',
          800: '#1b2f8f', 900: '#1b2c72'
        },
        steel: {
          50: '#f6f7f9', 100: '#eceef2', 200: '#d5dae2', 300: '#b0b9c8',
          400: '#8593a8', 500: '#66768d', 600: '#515e74', 700: '#434e5f',
          800: '#3a4351', 900: '#343b46', 950: '#22272e'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      keyframes: {
        'slide-in': { '0%': { transform: 'translateX(110%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'pop-in': { '0%': { opacity: '0', transform: 'scale(.96) translateY(6px)' }, '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } }
      },
      animation: {
        'slide-in': 'slide-in .25s ease-out',
        'fade-in': 'fade-in .2s ease-out',
        'pop-in': 'pop-in .18s ease-out'
      }
    }
  },
  plugins: []
}
