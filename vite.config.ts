import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      
      manifest: {
        name: "TR Genius PWA",
        short_name: "TR Genius",
        description: "Assistente de IA para criar Estudos Técnicos Preliminares e Termos de Referência, alinhado à Lei de Licitações 14.133/21.",
        start_url: ".",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        background_color: "#f8fafc",
        theme_color: "#3b82f6",
        orientation: "portrait-primary",
        categories: ["business", "productivity", "government"],
        icons: [
          { "src": "icons/icon-72x72.png", "sizes": "72x72", "type": "image/png" },
          { "src": "icons/icon-96x96.png", "sizes": "96x96", "type": "image/png" },
          { "src": "icons/icon-128x128.png", "sizes": "128x128", "type": "image/png" },
          { "src": "icons/icon-144x144.png", "sizes": "144x144", "type": "image/png" },
          { "src": "icons/icon-152x152.png", "sizes": "152x152", "type": "image/png" },
          { "src": "icons/icon192.png", "type": "image/png", "sizes": "192x192", "purpose": "any" },
          { "src": "icons/icon-384x384.png", "sizes": "384x384", "type": "image/png" },
          { "src": "icons/icon512.png", "type": "image/png", "sizes": "512x512", "purpose": "any maskable" }
        ],
        screenshots: [
          { "src": "screenshots/screenshot1.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "Geração de Documentos" },
          { "src": "screenshots/screenshot2.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "Gerenciador de Arquivos" }
        ],
        shortcuts: [
          { "name": "Novo ETP", "short_name": "Novo ETP", "description": "Criar um novo Estudo Técnico Preliminar", "url": "/?action=new-etp", "icons": [{ "src": "icons/icon192.png", "sizes": "192x192" }] },
          { "name": "Novo TR", "short_name": "Novo TR", "description": "Criar um novo Termo de Referência", "url": "/?action=new-tr", "icons": [{ "src": "icons/icon192.png", "sizes": "192x192" }] }
        ]
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tailwind-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'cdnjs-cache', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'unpkg-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-static-cache', expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ],
      },
    }),
  ],
  
  build: {
    minify: true,
    outDir: 'dist',
  },
});
