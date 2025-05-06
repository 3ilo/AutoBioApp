/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        primary: {
          50: '#f5f7ff',  // Lightest - for backgrounds
          100: '#eef1fe', // Very light - for hover states
          200: '#d9e0fd', // Light - for borders
          300: '#b3c4fb', // Medium light - for secondary elements
          400: '#8a9ff9', // Medium - for accents
          500: '#6179f7', // Base - for primary actions
          600: '#4d61e5', // Dark - for hover states
          700: '#3c4bd4', // Darker - for active states
          800: '#2b35c3', // Very dark - for text
          900: '#1a1fb2', // Darkest - for emphasis
        },
        // Warm neutrals for text and backgrounds
        warm: {
          50: '#faf9f7',   // Lightest - for main background
          100: '#f5f3f0',  // Very light - for cards
          200: '#e9e6e1',  // Light - for borders
          300: '#d9d4cc',  // Medium light - for dividers
          400: '#c9c2b7',  // Medium - for disabled states
          500: '#b9b0a2',  // Base - for secondary text
          600: '#a99e8d',  // Dark - for borders
          700: '#998c78',  // Darker - for icons
          800: '#897a63',  // Very dark - for text
          900: '#79684e',  // Darkest - for emphasis
        },
        // Accent colors for success, warning, error states
        accent: {
          success: {
            light: '#e6f4ea',
            DEFAULT: '#34a853',
            dark: '#1e7e34',
          },
          warning: {
            light: '#fff3e0',
            DEFAULT: '#fbbc04',
            dark: '#f29900',
          },
          error: {
            light: '#fce8e6',
            DEFAULT: '#ea4335',
            dark: '#d93025',
          },
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: [
          'Merriweather',
          'Georgia',
          'Cambria',
          'Times New Roman',
          'Times',
          'serif',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 0 0 1px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [
    '@tailwindcss/typography',
  ],
} 