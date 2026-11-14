import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the built app works on GitHub Pages under any repo subpath
export default defineConfig({
  plugins: [react()],
  base: './',
})
