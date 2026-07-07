import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import webfontDownload from 'vite-plugin-webfont-dl'
import { rmSync } from 'node:fs'
import path from 'path'

// Strip every trace of the edit-mode authoring tool from the published deck:
//  (1) remove the edit-mode <link> from index.html, and
//  (2) delete the copied public/edit-mode/ dir from the build output.
// (The edit-mode init in App.jsx is already dead-code-eliminated by VITE_EDIT=off.)
function stripEditMode() {
  let outDir = 'dist-standalone'
  return {
    name: 'mti-strip-edit-mode',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir },
    transformIndexHtml(html) {
      return html
        .replace(/<!--[^]*?edit-mode[^]*?-->/gi, '')
        .replace(/<link[^>]*edit-mode[^>]*>\s*/gi, '')
    },
    closeBundle() {
      try { rmSync(path.resolve(outDir, 'edit-mode'), { recursive: true, force: true }) } catch (_) {}
    },
  }
}

// Standalone build → ONE self-contained deck.html with all JS/CSS/fonts inlined.
// Built with VITE_EDIT=off (set by the export script) so the edit-mode overlay is
// never bundled into a published deck.
export default defineConfig({
  plugins: [
    react(),
    stripEditMode(),
    webfontDownload([], { injectAsStyleTag: true, embedFonts: true }),
    viteSingleFile({ removeViteModuleLoader: true, deleteInlinedFiles: true }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    outDir: 'dist-standalone',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
