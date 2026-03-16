import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import viteTsConfigPaths from 'vite-tsconfig-paths'


const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
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
      targets: [
        {
          src: [
            'node_modules/cesium/Build/Cesium/Workers',
            'node_modules/cesium/Build/Cesium/Assets',
            'node_modules/cesium/Build/Cesium/ThirdParty',
            'node_modules/cesium/Build/Cesium/Widgets',
          ],
          dest: 'cesium',
        },
      ],
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
})

export default config
