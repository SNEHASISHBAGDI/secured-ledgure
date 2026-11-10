/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0B1020',
          app: '#0B1020',
          sidebar: '#0B1020',
          card: '#151D32',
          elevated: '#1C2740',
        },
        surface: {
          card: '#151D32',
          elevated: '#1C2740',
          hover: '#222F4C',
        },
        border: {
          DEFAULT: '#29364C',
          subtle: '#1F2B3E',
          focus: '#5145F5',
        },
        primary: {
          DEFAULT: '#5145F5',
          hover: '#4237E4',
          active: '#372DC9',
          light: '#7167FF',
        },
        secondary: {
          DEFAULT: '#7167FF',
          hover: '#6054F7',
        },
        txt: {
          primary: '#F3F6FC',
          secondary: '#9AA8C2',
          muted: '#687794',
        },
        status: {
          success: '#35D49A',
          error: '#FF737D',
          warning: '#F5A623',
          info: '#4EA8DE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        'elevated': '0 8px 30px -4px rgba(0, 0, 0, 0.55)',
        'glow-primary': '0 0 20px -3px rgba(81, 69, 245, 0.35)',
      },
      borderRadius: {
        'card': '14px',
        'input': '10px',
      },
    },
  },
  plugins: [],
}
