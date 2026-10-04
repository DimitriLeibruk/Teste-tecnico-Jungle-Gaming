// Auditoria Lighthouse reprodutível: build otimizado + vite preview + 3 medições
// por página e perfil, com mediana por categoria e métricas LCP/CLS/TBT.
// Uso: npm run lighthouse   (CHROME_PATH opcional; padrão: Chromium do Playwright)
import { spawn, execSync } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'
import { chromium } from '@playwright/test'
import config from '../lighthouse/lighthouse.config.mjs'

const skipBuild = process.argv.includes('--skip-build')
const base = `http://localhost:${config.port}`

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function waitFor(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

if (!skipBuild) {
  console.log('› build de produção')
  execSync('npm run build', { stdio: 'inherit' })
}

console.log(`› vite preview na porta ${config.port}`)
const server = spawn('npx', ['vite', 'preview', '--port', String(config.port), '--strictPort'], { shell: true, stdio: 'ignore' })
const stop = () => {
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' })
    else server.kill('SIGTERM')
  } catch {
    /* já encerrado */
  }
}
process.on('exit', stop)

try {
  await waitFor(base)
  await rm(config.outputDir, { recursive: true, force: true })
  await mkdir(config.outputDir, { recursive: true })

  const chromePath = process.env.CHROME_PATH || chromium.executablePath()
  const results = []

  for (const page of config.pages) {
    for (const profile of config.profiles) {
      const runs = []
      for (let i = 1; i <= config.runs; i++) {
        // Navegador novo a cada medição: cache, service worker e storage limpos.
        const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-first-run', '--disable-gpu'] })
        try {
          const flags = { port: chrome.port, output: ['html', 'json'], onlyCategories: config.categories, logLevel: 'error' }
          const runner = await lighthouse(`${base}${page.path}`, flags, profile === 'desktop' ? desktopConfig : undefined)
          const [html, json] = runner.report
          const name = `${page.id}-${profile}-${i}`
          await writeFile(`${config.outputDir}/${name}.html`, html)
          await writeFile(`${config.outputDir}/${name}.json`, json)
          const lhr = runner.lhr
          const run = {
            scores: Object.fromEntries(config.categories.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
            lcp: lhr.audits['largest-contentful-paint'].numericValue,
            cls: lhr.audits['cumulative-layout-shift'].numericValue,
            tbt: lhr.audits['total-blocking-time'].numericValue,
            fcp: lhr.audits['first-contentful-paint'].numericValue,
            lighthouseVersion: lhr.lighthouseVersion,
            userAgent: lhr.environment.hostUserAgent,
          }
          runs.push(run)
          console.log(`  ${name}: ${JSON.stringify(run.scores)} LCP ${Math.round(run.lcp)}ms CLS ${run.cls.toFixed(3)} TBT ${Math.round(run.tbt)}ms`)
        } finally {
          await chrome.kill()
        }
      }
      results.push({
        page: page.id,
        path: page.path,
        profile,
        median: {
          ...Object.fromEntries(config.categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
          lcp: Math.round(median(runs.map((r) => r.lcp))),
          cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
          tbt: Math.round(median(runs.map((r) => r.tbt))),
          fcp: Math.round(median(runs.map((r) => r.fcp))),
        },
        runs,
      })
    }
  }

  const env = {
    date: new Date().toISOString(),
    lighthouse: results[0]?.runs[0]?.lighthouseVersion,
    chrome: results[0]?.runs[0]?.userAgent,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model,
    conditions:
      'Build de produção (vite build) servido por vite preview; mocks MSW ativos no cenário padrão (latência 120–420 ms); ' +
      'mobile = throttling padrão do Lighthouse (4G lento simulado, CPU 4×); desktop = preset desktop do Lighthouse. Navegador limpo a cada medição.',
  }

  await writeFile('lighthouse/summary.json', JSON.stringify({ env, targets: config.targets, results }, null, 2))

  const row = (r) =>
    `| ${r.page} | ${r.profile} | ${config.categories.map((c) => `${r.median[c]}${r.median[c] < config.targets[c] ? ' ⚠' : ''}`).join(' | ')} | ${r.median.lcp} ms | ${r.median.cls} | ${r.median.tbt} ms |`
  const md = [
    '# Lighthouse — resultados (mediana de 3 medições)',
    '',
    `Metas: Performance ≥ ${config.targets.performance}, Accessibility ≥ ${config.targets.accessibility}, Best Practices ≥ ${config.targets['best-practices']}, SEO ≥ ${config.targets.seo}.`,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...results.map(row),
    '',
    '## Ambiente',
    '',
    `- Data: ${env.date}`,
    `- Lighthouse: ${env.lighthouse}`,
    `- Navegador: ${env.chrome}`,
    `- Node: ${env.node}`,
    `- SO: ${env.os}`,
    `- CPU: ${env.cpu}`,
    `- Condições: ${env.conditions}`,
    '',
    'Relatórios completos (HTML/JSON) de cada medição em `lighthouse/reports/`.',
    '',
  ].join('\n')
  await writeFile('lighthouse/summary.md', md)
  console.log('\n' + md)
} finally {
  stop()
}
