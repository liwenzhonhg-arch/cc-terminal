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
        // Operator Console tokens
        surface: "rgb(var(--cc-surface) / <alpha-value>)",
        "surface-chat": "rgb(var(--cc-surface-chat) / <alpha-value>)",
        "surface-raised": "rgb(var(--cc-surface-raised) / <alpha-value>)",
        "cc-bg": "rgb(var(--cc-bg) / <alpha-value>)",
        ink: "rgb(var(--cc-ink) / <alpha-value>)",
        muted: "rgb(var(--cc-muted) / <alpha-value>)",
        faint: "rgb(var(--cc-faint) / <alpha-value>)",
        border: "rgb(var(--cc-border) / <alpha-value>)",
        "border-strong": "rgb(var(--cc-border-strong) / <alpha-value>)",
        hover: "rgb(var(--cc-hover) / <alpha-value>)",
        active: "rgb(var(--cc-active) / <alpha-value>)",
        vermilion: "rgb(var(--cc-vermilion) / <alpha-value>)",
        amber: "rgb(var(--cc-amber) / <alpha-value>)",
        moss: "rgb(var(--cc-moss) / <alpha-value>)",
        cyan: "rgb(var(--cc-cyan) / <alpha-value>)",

        // shadcn/ui semantic colors
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        sidebar: {
          DEFAULT: "rgb(var(--sidebar-background) / <alpha-value>)",
          foreground: "rgb(var(--sidebar-foreground) / <alpha-value>)",
          border: "rgb(var(--sidebar-border) / <alpha-value>)",
          accent: "rgb(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "rgb(var(--sidebar-accent-foreground) / <alpha-value>)",
        },
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.125rem" }],
      },
      letterSpacing: {
        operator: "0.06em",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
