import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'fonts/*.woff2'],
      manifest: {
        name: 'PANTHÉON',
        short_name: 'Panthéon',
        description: 'Stylized 3D mythological brawler for browser and mobile.',
        theme_color: '#0f1218',
        background_color: '#0f1218',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,ktx2,glb,opus}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
    mode === 'analyze' &&
      (visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }) as PluginOption),
  ].filter(Boolean) as PluginOption[],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three/') || id.includes('node_modules/three-stdlib'))
            return 'three';
          if (id.includes('@react-three/')) return 'r3f';
          if (id.includes('postprocessing') || id.includes('three-custom-shader-material'))
            return 'post';
          if (id.includes('node_modules/howler') || id.includes('node_modules/tone')) return 'audio';
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
  },
}));
