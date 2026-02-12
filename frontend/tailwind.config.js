/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#fdf8f3',
          100: '#f9ede0',
          200: '#f2d9bd',
          300: '#e8be8f',
          400: '#dc9d5c',
          500: '#d4833d',
          600: '#c66b32',
          700: '#a4532b',
          800: '#844329',
          900: '#6b3824',
        },
        ocean: {
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
