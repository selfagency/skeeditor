/** @type {import('tailwindcss').Config} */
// Tailwind v4 uses CSS-based configuration via @theme in global.css.
// This file is kept for backward compatibility with any tooling that detects it,
// but theme values have been migrated to src/global.css.
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts,css}'],
};
