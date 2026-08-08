import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// GENSPACE PLC — Vite config
// Path alias '@' -> 'src' keeps imports stable as the feature/module tree grows.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        host: true, // exposes on LAN, useful for testing on a real phone during dev
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'supabase': ['@supabase/supabase-js'],
                    'konva': ['konva', 'react-konva'],
                    'pdf': ['jspdf', 'jspdf-autotable'],
                    'excel': ['xlsx'],
                    'animation': ['framer-motion'],
                    'ui': ['lucide-react', '@radix-ui/react-slot', 'class-variance-authority', 'clsx', 'tailwind-merge'],
                },
            },
        },
    },
});
