/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
          500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a',
        },
        ink: {
          950: '#0b1120', 900: '#0f172a', 850: '#131c31', 800: '#1e293b', 700: '#334155',
        },
      },
      boxShadow: { soft: '0 1px 2px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)' },
    },
  },
  plugins: [],
};
