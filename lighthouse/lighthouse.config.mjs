/**
 * Configuração versionada da auditoria Lighthouse.
 * Execução: `npm run lighthouse` (gera o build, sobe o preview e audita).
 */
export default {
  /** Servidor do build otimizado (vite preview). */
  port: 4174,
  /** Páginas auditadas (cenário padrão dos mocks: latência variável 120–420 ms). */
  pages: [
    { id: 'inicio', path: '/' },
    { id: 'detalhe', path: '/nft/emerald-ape-042' },
  ],
  /** Perfis: mobile (padrão do Lighthouse: Moto G Power, 4G lento, CPU 4×) e desktop. */
  profiles: ['mobile', 'desktop'],
  /** Medições por página/perfil — o relatório usa a mediana. */
  runs: 3,
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  targets: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
  outputDir: 'lighthouse/reports',
}
