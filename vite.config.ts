import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/rpg-platform/',
  plugins: [react()],
})
