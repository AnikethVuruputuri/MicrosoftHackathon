/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Segoe UI Variable"',
          '"Segoe UI"',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif'
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          '"JetBrains Mono"',
          'Menlo',
          'Consolas',
          '"Liberation Mono"',
          'monospace'
        ],
      },
      colors: {
        app: '#F6F8FB',
        surface: {
          DEFAULT: '#FFFFFF',
          raised: '#F8FAFC',
          sunken: '#F1F4F9',
        },
        border: {
          DEFAULT: '#E4E9F0',
          subtle: '#EEF2F6',
          strong: '#D5DDE8',
        },
        text: {
          primary: '#111827',
          secondary: '#5B667A',
          muted: '#7A8699',
        },
        brand: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          soft: '#EFF6FF',
        },
        success: {
          DEFAULT: '#16A36A',
          soft: '#ECFDF3',
        },
        warning: {
          DEFAULT: '#D99100',
          soft: '#FFF8E6',
        },
        danger: {
          DEFAULT: '#D92D3A',
          soft: '#FFF1F2',
        },
        critical: {
          DEFAULT: '#C62828',
          soft: '#FFEBEE',
        },
        memory: {
          DEFAULT: '#6D5CE7',
          soft: '#F3F0FF',
        },
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(15, 23, 42, 0.04)',
        'sm': '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.03)',
        'md': '0 4px 12px rgba(15, 23, 42, 0.05)',
        'lg': '0 8px 24px rgba(15, 23, 42, 0.07)',
        'xl': '0 16px 36px rgba(15, 23, 42, 0.10)',
      },
      borderRadius: {
        'card': '12px',
      },
    },
  },
  plugins: [],
}
