import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        playroom: resolve(__dirname, "playroom.html"),
        about: resolve(__dirname, "about.html"),
        keyhunt: resolve(__dirname, "keyhunt.html"),
        atelier: resolve(__dirname, "atelier.html"),
      },
    },
  },
});