import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
 
const __dirname = path.dirname(fileURLToPath(import.meta.url));
 
export default defineConfig({
  plugins: [react()],
  // Usa o .env único na raiz do projeto (um nível acima de /frontend),
  // tanto rodando via Docker (onde as env vars já vêm do docker-compose)
  // quanto rodando "npm run dev" localmente fora do Docker.
  envDir: path.resolve(__dirname, ".."),
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
  },
});