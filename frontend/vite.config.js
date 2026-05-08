import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'   // <-- new line

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),   // <-- add this
  ],
})