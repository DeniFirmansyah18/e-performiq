/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        stitch: {
          header: '#0d131f',
          headerSubtle: '#161f30',
          emerald: '#007a5a',
          emeraldHover: '#00684a',
          emeraldLight: '#e6f4ea',
          canvas: '#f8fafc',
          border: '#e2e8f0',
          borderDark: '#1e293b',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
