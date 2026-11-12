/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16212E',
        paper: '#EEF1F0',
        surface: '#FFFFFF',
        moss: { DEFAULT: '#2F6F5E', deep: '#1F4F43', pale: '#DCE8E3' },
        mulberry: { DEFAULT: '#7A3A58', pale: '#EFE0E7' },
        signal: { DEFAULT: '#8C2F39', deep: '#5E1C23' },
        muted: '#5A6A72',
        line: '#D7DEDC',
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        reading: '62ch',
      },
    },
  },
  plugins: [],
};
