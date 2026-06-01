/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        drgrow: {
          teal: '#28C9BA',
          navy: '#0D2B3E',
          orange: '#FF6019',
          ink: '#154359',
          bg: '#F2F5F8',
        },
      },
    },
  },
  plugins: [],
};
