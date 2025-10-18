const preset = require('../../packages/ui/tailwind.preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './entrypoints/**/*.{html,tsx,ts,jsx,js}',
    './components/**/*.{tsx,ts,jsx,js}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
};
