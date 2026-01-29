import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import webfontDownload from 'vite-plugin-webfont-dl'
import path from 'path'

// Standalone build config - creates a single HTML file with all assets inlined
export default defineConfig({
  plugins: [
    react(),
    // Download and embed Google Fonts as base64
    webfontDownload([], {
      injectAsStyleTag: true,
      embedFonts: true, // Embed fonts as base64 in CSS
    }),
    viteSingleFile({
      removeViteModuleLoader: true,
      deleteInlinedFiles: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist-standalone',
    assetsInlineLimit: 100000000, // Inline all assets
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
