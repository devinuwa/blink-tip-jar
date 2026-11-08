import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#100e0c",
        panel: "#1a1612",
        line: "#3a3126",
        cream: "#f6efe4",
        mute: "#b5a898",
        coin: "#f0b429",
        usdc: "#2775ca",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        coin: "0 0 40px rgba(240, 180, 41, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
