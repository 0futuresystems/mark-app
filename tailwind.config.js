/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./app/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/**/*.{js,ts,jsx,tsx,mdx}",
      "./components/**/*.{js,ts,jsx,tsx,mdx}",
      "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
      extend: {
        colors: {
          brand: { bg: "#0b132b", panel: "#0e1117" },
        },
        fontSize: {
          base: ["18px", "1.6"],
          lg:   ["20px", "1.7"],
          xl:   ["24px", "1.3"],
          "2xl":["28px", "1.2"],
          "3xl":["32px", "1.15"],
        },
        borderRadius: { "2xl": "1rem" },
        boxShadow: { soft: "0 10px 30px rgba(0,0,0,0.35)" },
      },
    },
    plugins: [
      require("@tailwindcss/forms"),
      require("@tailwindcss/aspect-ratio"),
      require("@tailwindcss/typography"),
    ],
  };
  