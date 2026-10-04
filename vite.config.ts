import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * Pré-carrega o chunk da camada de mocks (MSW) em paralelo ao bundle principal.
 * Sem isso, ele só começaria a baixar depois que o main.js executasse o import dinâmico.
 */
function preloadMockChunk(): Plugin {
  return {
    name: 'kurio:preload-mock-chunk',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (process.env.VITE_API_MOCKING === 'disabled') return
        const chunk = Object.values(ctx.bundle ?? {}).find(
          (c) => c.type === 'chunk' && c.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/mocks/browser.ts'),
        )
        if (!chunk) return
        return [{ tag: 'link', attrs: { rel: 'modulepreload', href: `/${chunk.fileName}` }, injectTo: 'head' }]
      },
    },
  }
}

export default defineConfig({
  plugins: [
    // O plugin do router precisa vir antes do plugin do React
    tanstackRouter({ target: 'react', autoCodeSplitting: true, quoteStyle: 'single' }),
    react(),
    tailwindcss(),
    preloadMockChunk(),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // tldts (lista pública de sufixos) só é usado pelo tough-cookie do MSW: troca por um stub leve.
      { find: /^tldts$/, replacement: fileURLToPath(new URL('./src/mocks/stubs/tldts.ts', import.meta.url)) },
    ],
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
