/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'], // This line is key
  theme: {
    extend: {},
  },
  plugins: [
      require('@tailwindcss/typography'), // If selected
      require('@tailwindcss/forms')        // If selected
  ],
}