import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { copyFileSync } from 'node:fs'

export default defineConfig({
  base: '/rpg-platform/',

  plugins: [
    react(),

    {
      name: 'copy-index-to-404',
      closeBundle() {
        copyFileSync('dist/index.html', 'dist/404.html')
      },
    },
  ],
})
