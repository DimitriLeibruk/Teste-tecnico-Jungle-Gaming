import { test, expect, type AppType as App } from './fixtures'

/** 4. Favoritos, incluindo falha de mutation e recuperação do estado (atualização otimista + rollback). */

// No detalhe, cada viewport exibe um único botão de favorito (desktop: texto; mobile: ícone).
const favButton = (app: App) => app.page.getByRole('button', { name: 'Favoritar', exact: true })
const favoritedButton = (app: App) => app.page.getByRole('button', { name: /^(Favoritado|Remover dos favoritos)$/ })

test.describe('Favoritos', () => {
  test('favoritar persiste para o usuário autenticado após refresh', async ({ app, page }) => {
    await app.login('bruno')
    await app.goto('/nft/golden-signal-160')
    await favButton(app).click()
    await expect(favoritedButton(app)).toHaveAttribute('aria-pressed', 'true')

    await page.reload()
    await expect(favoritedButton(app)).toHaveAttribute('aria-pressed', 'true')
    await app.goto('/conta/favoritos')
    await expect(page.getByTestId('favorites-grid').getByText('Golden Signal #160')).toBeVisible()
  })

  test('visitante é convidado a entrar ao favoritar', async ({ app, page }) => {
    await app.goto('/nft/emerald-ape-042')
    await favButton(app).click()
    await expect(page.getByRole('dialog').getByText('Entre na sua conta para salvar favoritos.')).toBeVisible()
  })
})

test.describe('Favoritos — falha da API', () => {
  test.use({ scenarios: ['instant', 'favorites-fail'] })

  test('a mudança otimista é revertida e o usuário recebe feedback', async ({ app, page }) => {
    await app.login('ana')
    await app.goto('/nft/sage-nomad-009')
    await expect(favButton(app)).toHaveAttribute('aria-pressed', 'false')
    await favButton(app).click()
    await expect(page.getByText(/Não foi possível favoritar Sage Nomad #009/).first()).toBeAttached()
    // Rollback: volta ao estado anterior (não favoritado)
    await expect(favButton(app)).toHaveAttribute('aria-pressed', 'false')

    // Recuperação: o servidor volta a funcionar e a ação passa a persistir.
    await app.mock((m) => m.setScenario(['instant']))
    await page.reload()
    await favButton(app).click()
    await expect(favoritedButton(app)).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(favoritedButton(app)).toHaveAttribute('aria-pressed', 'true')
  })
})
