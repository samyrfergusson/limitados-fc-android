import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// No GitHub Pages o site fica em /limitados-fc-android/ (subcaminho).
// No APK (Capacitor) e no dev local, a base é a raiz "/".
// A variavel PAGES=1 e definida SO no workflow de deploy web — assim o
// build do APK continua com base "/" e nao quebra.
const base = process.env.PAGES ? '/limitados-fc-android/' : '/'

export default defineConfig({
  base,
  server: { host: '127.0.0.1', port: 5173 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Limitados F.C',
        short_name: 'Limitados',
        description: 'Gestao da pelada de quinta do Limitados F.C',
        lang: 'pt-BR',
        theme_color: '#080B1C',
        background_color: '#080B1C',
        display: 'standalone',
        orientation: 'portrait',
        id: base,
        scope: base,
        start_url: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
