import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf5",
          100: "#d6f9e4",
          200: "#b0f1cd",
          300: "#7ce4b0",
          400: "#43cf8d",
          500: "#1fb473",
          600: "#14915d",
          700: "#13744c",
          800: "#135c3f",
          900: "#124b35",
        },
      },
    },
  },
  plugins: [],
};

export default config;
