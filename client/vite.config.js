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
                target: 'ws://localhost:3000',
                ws: true
            },
            '/webmention': 'http://localhost:3000',  // covers both POST /webmention
            '/webmentions': 'http://localhost:3000', // and GET /webmentions

        }
    }
})