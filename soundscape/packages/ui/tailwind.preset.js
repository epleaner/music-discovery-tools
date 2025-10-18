/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Monochrome palette
        bg: {
          DEFAULT: '#ffffff',
          subtle: '#fafafa',
          muted: '#f5f5f5',
        },
        fg: {
          DEFAULT: '#000000',
          muted: '#737373',
          subtle: '#a3a3a3',
        },
        border: {
          DEFAULT: '#e5e5e5',
          hover: '#d4d4d4',
        },
        accent: {
          DEFAULT: '#000000',
          hover: '#262626',
        },
      },
      spacing: {
        18: '4.5rem',
      },
      fontSize: {
        xs: ['0.6875rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.5rem' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
      },
    },
  },
  plugins: [],
};
