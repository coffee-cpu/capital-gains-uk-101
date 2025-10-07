/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cgt-same-day': '#4A90E2',
        'cgt-30-day': '#F5A623',
        'cgt-section-104': '#7ED321',
        'cgt-none': '#CCCCCC',
      },
    },
  },
  plugins: [],
}
