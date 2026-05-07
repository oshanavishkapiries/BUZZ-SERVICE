import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Jupyter Notebook inspired palette
        jupyter: {
          // Orange accent
          orange: '#F37726',
          'orange-light': '#F5A84A',
          'orange-dark': '#D46B1F',

          // Light mode grays
          'light-bg': '#FFFFFF',
          'light-surface': '#F8F9FA',
          'light-border': '#E1E4E8',
          'light-text': '#24292E',
          'light-text-secondary': '#6A737D',

          // Dark mode grays
          'dark-bg': '#1E1E1E',
          'dark-surface': '#2D2D2D',
          'dark-border': '#404040',
          'dark-text': '#E8E8E8',
          'dark-text-secondary': '#989898',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"Fira Code"', '"Source Code Pro"', 'Menlo', 'Monaco', 'monospace'],
      },
      boxShadow: {
        'jupyter-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
        'jupyter': '0 1px 8px rgba(0, 0, 0, 0.12)',
        'jupyter-lg': '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
