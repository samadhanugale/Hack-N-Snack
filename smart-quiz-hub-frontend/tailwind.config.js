/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        sidebar: '#0B1020',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(16,24,40,0.04), 0 4px 14px rgba(16,24,40,0.06)',
        'card-hover': '0 18px 40px rgba(79,70,229,0.18)',
        lift: '0 22px 48px -12px rgba(79,70,229,0.35)',
        glow: '0 0 0 4px rgba(99,102,241,0.12)',
        dialog: '0 30px 70px rgba(16,24,40,0.28)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        blob: {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px,20px) scale(0.9)' },
          '100%': { transform: 'translate(0,0) scale(1)' },
        },
        gradientShift: {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        spinSlow: { '100%': { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fadeIn 0.5s ease-out both',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in-right': 'slideInRight 0.45s cubic-bezier(0.22,1,0.36,1) both',
        pop: 'pop 0.4s cubic-bezier(0.22,1,0.36,1) both',
        float: 'float 6s ease-in-out infinite',
        blob: 'blob 9s ease-in-out infinite',
        gradient: 'gradientShift 8s ease infinite',
        'spin-slow': 'spinSlow 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
