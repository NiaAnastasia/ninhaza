import { defineConfig } from "vite";
import { resolve } from "path";

// Мультистраничная сборка: index.html + playroom.html
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        playroom: resolve(__dirname, "playroom.html"),
        about: resolve(__dirname, "about.html"),
      },
    },
  },
});