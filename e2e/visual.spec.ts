import { test, expect } from './fixtures'

/**
 * Regressão visual de Início, Detalhe, Carrinho e Pagamento (desktop e mobile).
 * Dados estáveis: fixtures determinísticas + cenário `instant`. Baselines em e2e/__screenshots__.
 * Atualizar: npm run test:e2e:update -- e2e/visual.spec.ts
 */

async function settle(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

test.describe('Regressão visual', () => {
  test('início', async ({ app, page }) => {
    await app.goto('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe do NFT', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho', async ({ app, page }) => {
    await app.addToCart('emerald-ape-042', 2)
    await app.addToCart('violet-nomad-314', 1)
    await app.goto('/carrinho')
    await expect(page.getByTestId('quote-total')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('emerald-ape-042', 2)
    await app.startCheckout()
    await expect(page.getByText(/2.396 ETH/).locator('visible=true').first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
  })
})
