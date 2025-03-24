import { defineConfig } from "vite";
// Good for Vercel
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
});
