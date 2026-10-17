/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
      },
      colors: {
        // Warm neutral surface tokens + a calm blue accent.
        ink: {
          DEFAULT: "#1c1c1a",
          soft: "#3a3a36",
          muted: "#6b6b64",
        },
        brand: {
          50: "#eff5ff",
          100: "#dbe8fe",
          200: "#bfd6fe",
          300: "#93bbfd",
          400: "#609afa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(17,17,17,0.04), 0 8px 24px -12px rgba(17,17,17,0.12)",
        composer: "0 2px 6px rgba(17,17,17,0.05), 0 12px 32px -16px rgba(17,17,17,0.18)",
      },
    },
  },
  plugins: [],
};
