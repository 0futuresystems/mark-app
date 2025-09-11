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
        borderRadius: { "2xl": "1rem" },
        boxShadow: { 
          soft: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          medium: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
        },
        animation: {
          'bounce-gentle': 'bounce 1.5s ease-in-out infinite',
          'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'scale-press': 'scalePress 0.15s ease-out',
        },
        keyframes: {
          scalePress: {
            '0%': { transform: 'scale(1)' },
            '50%': { transform: 'scale(0.95)' },
            '100%': { transform: 'scale(1)' }
          }
        },
        // Enhanced text sizes that work well with iOS text scaling
        fontSize: {
          'xs': ['14px', '1.5'],
          'sm': ['16px', '1.5'],
          'base': ['18px', '1.6'],
          'lg': ['20px', '1.7'],
          'xl': ['24px', '1.4'],
          '2xl': ['28px', '1.3'],
          '3xl': ['32px', '1.2'],
          '4xl': ['36px', '1.1'],
        },
      },
    },
    plugins: [
      require("@tailwindcss/forms"),
      require("@tailwindcss/aspect-ratio"),
      require("@tailwindcss/typography"),
    ],
  };
  