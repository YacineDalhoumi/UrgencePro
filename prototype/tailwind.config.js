/** @type {import('tailwindcss').Config} */
// Toutes les couleurs passent par des variables CSS (thèmes clair/sombre définis dans index.css).
const tok = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: tok('bg'),
        surface: tok('surface'),
        sunken: tok('sunken'),
        border: tok('border'),
        fg: tok('fg'),
        muted: tok('muted'),
        accent: { DEFAULT: tok('accent'), fg: tok('accent-fg'), soft: tok('accent-soft') },
        ink: { DEFAULT: tok('ink'), fg: tok('ink-fg') },
        ok: { DEFAULT: tok('ok'), soft: tok('ok-soft') },
        warn: { DEFAULT: tok('warn'), soft: tok('warn-soft') },
        bad: { DEFAULT: tok('bad'), soft: tok('bad-soft') },
        info: { DEFAULT: tok('info'), soft: tok('info-soft') },
        ai: { DEFAULT: tok('ai'), soft: tok('ai-soft') },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible Next"', '"Atkinson Hyperlegible"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { DEFAULT: '6px', md: '8px', lg: '10px' },
    },
  },
  plugins: [],
}
