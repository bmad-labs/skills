import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// `@ds` = the design system. A deck scaffolded into the user's project carries its own
// copy at ./design-system (with the deck's theme); the pristine template inside the skill
// uses the skill's sibling ../design-system. Same import works in both places.
export const designSystemDir = fs.existsSync(path.resolve(__dirname, 'design-system'))
  ? path.resolve(__dirname, 'design-system')
  : path.resolve(__dirname, '../design-system')

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src'), '@ds': designSystemDir } },
  // Only scan the real entry — never crawl built artifacts in export/ or
  // dist-standalone/. Their inlined bundles reference deps we don't install
  // (e.g. @emotion/is-prop-valid), which crashes the dev server's optimizer if it
  // tries to pre-bundle them. (Happens after clearing node_modules/.vite mid-session.)
  optimizeDeps: { entries: ['index.html'] },
  server: { fs: { strict: false }, watch: { ignored: ['**/export/**', '**/dist-standalone/**', '**/review/**'] } },
})
