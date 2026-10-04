import { test, expect } from './fixtures'

/** 2. Acesso direto ao detalhe e tratamento de recurso inexistente (+ edição indisponível e limite). */

test.describe('Detalhe do NFT', () => {
  test('acesso direto exibe o NFT com preço, edições e informações', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '1/50' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('ID do token:').first()).toBeVisible()
    await expect(page).toHaveTitle(/Emerald Ape #042/)
  })

  test('NFT inexistente mostra estado de não encontrado', async ({ app, page }) => {
    await app.goto('/nft/nao-existe-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explorar o mercado' })).toBeVisible()
  })

  test('rota inexistente mostra página 404', async ({ app, page }) => {
    await app.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('edição esgotada fica indisponível e a quantidade respeita o limite por pedido', async ({ app, page }) => {
    // Ivory Baron #088 tem a edição 1/10 esgotada nas fixtures.
    await app.goto('/nft/ivory-baron-088')
    await expect(page.getByRole('radio', { name: /1\/10/ })).toBeDisabled()

    // Força disponibilidade baixa no servidor: 2 unidades na edição 1/50.
    await app.mock((m) => m.updateNft('ivory-baron-088', { editionId: '1-50', available: 2 }))
    await page.reload()
    const plus = page.getByRole('button', { name: /Aumentar quantidade/ })
    const visiblePlus = app.isMobile ? plus.last() : plus.first()
    await visiblePlus.click()
    await expect(visiblePlus).toBeDisabled()
    await expect(page.getByText(/2 disponíveis/)).toBeVisible()
  })
})
