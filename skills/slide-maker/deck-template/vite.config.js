import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // Only scan the real entry — never crawl built artifacts in export/ or
  // dist-standalone/. Their inlined bundles reference deps we don't install
  // (e.g. @emotion/is-prop-valid), which crashes the dev server's optimizer if it
  // tries to pre-bundle them. (Happens after clearing node_modules/.vite mid-session.)
  optimizeDeps: { entries: ['index.html'] },
  server: { fs: { strict: false }, watch: { ignored: ['**/export/**', '**/dist-standalone/**', '**/review/**'] } },
})
