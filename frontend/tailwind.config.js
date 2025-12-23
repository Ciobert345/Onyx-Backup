/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        surface: {
          1: '#0b0b0b',
          2: '#111111',
          3: '#1a1a1a',
        },
        border: '#2a2a2a',
        text: {
          primary: '#e6e6e6',
          secondary: '#bdbdbd',
        },
        accent: 'rgba(255,255,255,0.16)',
        primary: '#ffffff'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 20px rgba(255,255,255,0.06)'
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
}
