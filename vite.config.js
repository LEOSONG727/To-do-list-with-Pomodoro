import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    base: '/To-do-list-with-Pomodoro/',
    build: {
        sourcemap: false,
        minify: 'esbuild',
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'Focus Do - 집중 투두',
                short_name: 'Focus Do',
                description: '뽀모도로 타이머와 함께하는 집중 투두 앱',
                theme_color: '#0071E3',
                background_color: '#F5F5F7',
                display: 'standalone',
                lang: 'ko',
                start_url: '/To-do-list-with-Pomodoro/',
                icons: [
                    {
                        src: '/To-do-list-with-Pomodoro/icons/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/To-do-list-with-Pomodoro/icons/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/To-do-list-with-Pomodoro/icons/icon-maskable.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                        },
                    },
                ],
            },
        }),
    ],
});
