import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        corte: {
          DEFAULT: "#0f3d6b",
          dark: "#0a2c4d"
        }
      }
    }
  },
  plugins: []
};

export default config;
