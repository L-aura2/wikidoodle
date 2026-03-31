import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'Wikidoodle',
                short_name: 'Wido',
                theme_color: '#ffffff',
                display: 'standalone',
                icons: [
                    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
                ]
            }
        })
    ],
    server: {
        proxy: {
            '/ws': {
                target: 'wss://wikidoodle-server.onrender.com/',
                ws: true
            },
            '/webmention': 'https://wikidoodle-server.onrender.com/',  // covers both POST /webmention
            '/webmentions': 'https://wikidoodle-server.onrender.com/', // and GET /webmentions

        }
    }
})