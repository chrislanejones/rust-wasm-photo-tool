import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// No Tailwind here on purpose: the site is plain CSS driven by the tokens in
// src/tokens.css. Adding the plugin back would ship a preflight reset that
// fights styles.css for no gain.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
