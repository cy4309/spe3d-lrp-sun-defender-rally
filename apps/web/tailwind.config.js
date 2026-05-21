/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#f47a1f",
          // blue: "#0a4a8c",
          blue: "#003e89",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', "-apple-system", "BlinkMacSystemFont", '"PingFang TC"', '"Microsoft JhengHei"', "sans-serif"],
      },
      maxWidth: {
        mobile: "480px",
      },
    },
  },
  plugins: [],
};
