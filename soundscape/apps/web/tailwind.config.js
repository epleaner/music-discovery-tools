const preset = require('../../packages/ui/tailwind.preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
};
