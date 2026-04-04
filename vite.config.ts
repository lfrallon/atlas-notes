import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import viteTsConfigPaths from 'vite-tsconfig-paths'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

const config = defineConfig({
  build: {
    chunkSizeWarningLimit: 11_500,
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/'),
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    viteStaticCopy({
      // Needed for development, since the public directory is not used in development mode
      targets: [
        {
          src: 'node_modules/cesium/Build/Cesium/Workers/**/*',
          dest: 'cesium/Workers',
        },
        {
          src: 'node_modules/cesium/Build/Cesium/Assets/**/*',
          dest: 'cesium/Assets',
        },
        {
          src: 'node_modules/cesium/Build/Cesium/ThirdParty/**/*',
          dest: 'cesium/ThirdParty',
        },
        {
          src: 'node_modules/cesium/Build/Cesium/Widgets/**/*',
          dest: 'cesium/Widgets',
        },
      ],
    }),
    viteStaticCopy({
      // Needed for production, since the public directory is used in production mode
      targets: [
        {
          src: 'node_modules/cesium/Build/Cesium/Workers/**/*',
          dest: path.resolve(_dirname, 'public/cesium/Workers'),
        },
        {
          src: 'node_modules/cesium/Build/Cesium/Assets/**/*',
          dest: path.resolve(_dirname, 'public/cesium/Assets'),
        },
        {
          src: 'node_modules/cesium/Build/Cesium/ThirdParty/**/*',
          dest: path.resolve(_dirname, 'public/cesium/ThirdParty'),
        },
        {
          src: 'node_modules/cesium/Build/Cesium/Widgets/**/*',
          dest: path.resolve(_dirname, 'public/cesium/Widgets'),
        },
      ],
    }),
  ],
})

export default config
