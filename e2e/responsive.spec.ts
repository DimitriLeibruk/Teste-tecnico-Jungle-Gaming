import { test, expect } from './fixtures'

/** Responsividade: nenhuma tela tem overflow horizontal em 390, 768 e 1440 px. */

const PUBLIC = ['/', '/mercado', '/nft/emerald-ape-042', '/carrinho', '/entrar', '/cadastro', '/em-breve', '/rota-inexistente']
const PRIVATE = ['/pagamento', '/conta/perfil', '/conta/carteiras', '/conta/favoritos', '/conta/atividade']

test.describe('Sem overflow horizontal', () => {
  test.skip(({ isMobile }) => isMobile, 'larguras controladas manualmente no projeto desktop')

  for (const width of [390, 768, 1440]) {
    test(`telas em ${width}px`, async ({ app, page }) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width, height: 900 })
      await app.addToCart('emerald-ape-042', 1)
      const check = async (path: string) => {
        await app.goto(path)
        await page.waitForLoadState('networkidle')
        const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
        expect(scroll, `${path} em ${width}px`).toBeLessThanOrEqual(client)
      }
      for (const path of PUBLIC) await check(path)
      await app.login('ana')
      for (const path of PRIVATE) await check(path)
    })
  }
})
