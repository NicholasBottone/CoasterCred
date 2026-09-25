const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter var", ...fontFamily.sans],
      },
      borderRadius: {
        DEFAULT: "8px",
        secondary: "4px",
        container: "12px",
      },
      boxShadow: {
        DEFAULT: "0 1px 4px rgba(0, 0, 0, 0.1)",
        hover: "0 2px 8px rgba(0, 0, 0, 0.12)",
      },
      colors: {
        gray: {
          50: "#f2f4f7",
          100: "#eef2f8",
          200: "#d7dde6",
          400: "#8d9aad",
          500: "#6e7e93",
          600: "#5d6a7c",
          800: "#344051",
          900: "#19212d",
          950: "#111720",
        },
        primary: {
          DEFAULT: "rgb(var(--cc-brand) / <alpha-value>)",
          hover: "rgb(var(--cc-brand) / 0.85)",
        },
        secondary: {
          DEFAULT: "#6B7280",
          hover: "#4B5563",
        },
        accent: {
          DEFAULT: "#8B5CF6",
          hover: "#7C3AED",
        },
      },
      spacing: {
        "form-field": "16px",
        section: "32px",
      },
    },
  },
  variants: {
    extend: {
      boxShadow: ["hover", "active"],
    },
  },
};
