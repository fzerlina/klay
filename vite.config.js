import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Site is hosted on GitHub Pages at https://fzerlina.github.io/klay/, so the
// production build needs all asset URLs prefixed with /klay/. The dev server
// (npm run dev) ignores `base` and serves from /.
export default defineConfig({
  base: "/klay/",
  plugins: [react()],
});
