/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,css}', './src/*.{html,ts,css}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        'sm/6': ['0.875rem', { lineHeight: '1rem' }],
        'base/6': ['1rem', { lineHeight: '1.5rem' }],
        'xl/9': ['1.5rem', { lineHeight: '2rem' }],
        '2xl/9': ['1.75rem', { lineHeight: '2.25rem' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      outlineOffset: {
        '-1': '-1px',
      },
    },
  },
  plugins: [],
};
