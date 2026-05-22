import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        serif: ['"IBM Plex Serif"', "ui-serif", "serif"],
      },
      colors: {
        // Driven by CSS variables in src/styles/tokens.css
        surface: "rgb(var(--cc-surface) / <alpha-value>)",
        "surface-chat": "rgb(var(--cc-surface-chat) / <alpha-value>)",
        "surface-raised": "rgb(var(--cc-surface-raised) / <alpha-value>)",
        ink: "rgb(var(--cc-ink) / <alpha-value>)",
        muted: "rgb(var(--cc-muted) / <alpha-value>)",
        faint: "rgb(var(--cc-faint) / <alpha-value>)",
        border: "rgb(var(--cc-border) / <alpha-value>)",
        vermilion: "rgb(var(--cc-vermilion) / <alpha-value>)",
        amber: "rgb(var(--cc-amber) / <alpha-value>)",
        moss: "rgb(var(--cc-moss) / <alpha-value>)",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.125rem" }],
      },
      letterSpacing: {
        operator: "0.04em",
      },
    },
  },
  plugins: [],
};

export default config;
