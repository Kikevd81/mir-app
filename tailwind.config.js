/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                medical: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                },
                premium: {
                    gold: '#D4AF37',
                    dark: '#1A1A1A',
                    card: '#FFFFFF',
                    bg: '#F8FAFC',
                }
            },
            borderRadius: {
                'xl': '1rem',
                '2xl': '1.5rem',
            },
            boxShadow: {
                'premium': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 10px -2px rgba(0, 0, 0, 0.05)',
            }
        },
    },
    plugins: [],
}
