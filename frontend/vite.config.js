import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxies API/upload requests to the local backend (port 5000) so the
    // frontend's relative "/api" and "/uploads" fetches work in dev without
    // needing VITE_API_BASE_URL configured.
    proxy: {
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
    },
  },
});
