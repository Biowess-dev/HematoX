/** @type {import('tailwindcss').Config} */
// Tailwind is retained in devDependencies but its directives have been removed
// from index.css. The CSS variable system (tokens.css) is now the sole styling
// source of truth. This config file is kept to avoid breaking postcss-related
// tooling, but it has no effect on the application.
export default {
  content: [],
  theme: { extend: {} },
  plugins: [],
}
