/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/renderer/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core theme
        background: '#0a0a0a',
        surface: '#181818',
        'surface-hover': '#242424',
        'surface-active': '#2a2a2a',
        border: '#282828',
        // Text
        'text-primary': '#ffffff',
        'text-secondary': '#b3b3b3',
        'text-muted': '#6a6a6a',
        // Accent
        accent: {
          DEFAULT: '#1db954',
          hover: '#1ed760',
          muted: '#1db95433',
        },
        // Source-specific
        spotify: '#1db954',
        youtube: '#ff0000',
        jellyfin: '#aa5cc3',
        // Weather
        'temp-high': '#ff6b6b',
        'temp-low': '#74b9ff',
        precip: '#4fc3f7',
        // Alerts
        'alert-minor': '#ffd93d',
        'alert-moderate': '#ff9800',
        'alert-severe': '#f44336',
        'alert-extreme': '#d32f2f',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          '"Fira Code"',
          '"Cascadia Code"',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        'sidebar': '240px',
        'dashboard': '380px',
        'playback-bar': '90px',
      },
      borderRadius: {
        'xl': '12px',
      },
      animation: {
        'spin-slow': 'spin 30s linear infinite',
        'pulse-slow': 'pulse 1.5s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in-out',
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
