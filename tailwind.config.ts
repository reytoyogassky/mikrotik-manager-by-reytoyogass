import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        bg: {
          base: "#080c12",
          surface: "#0d1520",
          elevated: "#111d2e",
          border: "#1a2d42",
          hover: "#162236",
        },
        accent: {
          DEFAULT: "#00d4aa",
          dim: "#00a882",
          glow: "rgba(0,212,170,0.15)",
        },
        text: {
          primary: "#e2edf5",
          secondary: "#6b8fa8",
          muted: "#3d5a72",
        },
        danger: "#ff4757",
        warning: "#ffa502",
        success: "#2ed573",
        info: "#3498db",
      },
    },
  },
  plugins: [],
};

export default config;
