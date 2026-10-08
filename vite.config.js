import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages workflow injects a versioned path such as
  // /react-youflix/v1/. Local development keeps using the site root.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
})
