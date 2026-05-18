/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#0a4a8c",
          orange: "#f47a1f",
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans TC"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"PingFang TC"',
          '"Microsoft JhengHei"',
          "sans-serif",
        ],
      },
      maxWidth: {
        mobile: "480px",
      },
    },
  },
  plugins: [],
};
