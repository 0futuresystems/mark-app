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
          brand: { 
            bg: "#fafafa", 
            panel: "#ffffff",
            accent: "#2563eb",
            "accent-hover": "#1d4ed8",
            text: "#1f2937",
            "text-muted": "#6b7280",
            border: "#e5e7eb",
            success: "#059669",
            error: "#dc2626"
          },
        },
        fontSize: {
          base: ["18px", "1.6"],
          lg:   ["20px", "1.7"],
          xl:   ["24px", "1.3"],
          "2xl":["28px", "1.2"],
          "3xl":["32px", "1.15"],
        },
        borderRadius: { "2xl": "1rem" },
        boxShadow: { 
          soft: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          medium: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
        },
      },
    },
    plugins: [
      require("@tailwindcss/forms"),
      require("@tailwindcss/aspect-ratio"),
      require("@tailwindcss/typography"),
    ],
  };
  