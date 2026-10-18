// @ts-check
import { defineConfig, envField } from 'astro/config';
import solid from '@astrojs/solid-js';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    srcDir: 'src',
    // SSR cho user page: trang công khai, cần SEO và phải xem được nhanh.
    // Khu vực admin là SPA island, Solid router lo điều hướng sau lần tải đầu.
    output: 'server',
    adapter: node({ mode: 'standalone' }),
    integrations: [solid()],

    vite: {
        plugins: [tailwindcss()],
        resolve: {
            alias: {
                '@': '/src',
                '@core': '/src/core',
                '@layouts': '/src/layouts',
                '@modules': '/src/modules',
            },
        },
    },

    env: {
        schema: {
            // SSR gọi thẳng main-service; trình duyệt không bao giờ thấy biến này.
            BACKEND_URL: envField.string({
                context: 'server',
                access: 'secret',
                default: 'http://127.0.0.1:8080',
            }),
            PUBLIC_APP_NAME: envField.string({
                context: 'client',
                access: 'public',
                default: 'MERIX',
            }),
        },
    },
});
