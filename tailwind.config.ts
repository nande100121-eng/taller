import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        reygas: {
          red: "#D32F2F",
          redBright: "#E53935",
          redDark: "#B71C1C",
          dark: "#141619",
          card: "#1E2022",
          surface: "#2A2D30",
          silver: "#E0E6ED",
          muted: "#9AA5B1"
        }
      }
    },
  },
  plugins: [],
};
export default config;
