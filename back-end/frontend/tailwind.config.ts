import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        amadeus: {
          50: '#f5f7fa',
          100: '#e4e9f0',
          200: '#c9d4e1',
          300: '#a1b4cc',
          400: '#738db3',
          500: '#536d99',
          600: '#41557d',
          700: '#364566',
          800: '#2f3b56',
          900: '#2a334a',
          950: '#1c2231',
        },
      },
    },
  },
  plugins: [],
};
export default config;
