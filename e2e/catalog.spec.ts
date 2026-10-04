import { test, expect } from './fixtures'

/** 1. Busca, filtros combinados, ordenação, paginação e restauração pelo histórico. */

const cardNames = (page: import('@playwright/test').Page) =>
  page.getByTestId('catalog-grid').locator('[data-testid="nft-card"]:visible h3').allInnerTexts()

test.describe('Catálogo', () => {
  test('filtros combinados, ordenação e paginação compõem a URL e sobrevivem a refresh e histórico', async ({ app, page }) => {
    await app.goto('/mercado')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Página 4' })).toBeVisible()

    // Paginação
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    if (app.isMobile) await page.getByRole('button', { name: 'Abrir filtros e ordenação' }).click()
    const filters = app.isMobile ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Filtros' })

    // Filtro de categoria reinicia a paginação
    await filters.getByRole('button', { name: /Música/ }).click()
    await expect(page).toHaveURL(/categories=musica/)
    await expect(page).not.toHaveURL(/page=/)
    // Filtro combinado com rede
    await filters.getByRole('button', { name: /Ethereum/ }).click()
    await expect(page).toHaveURL(/networks=ethereum/)
    await expect(filters.getByRole('button', { name: /Música/ })).toHaveAttribute('aria-pressed', 'true')

    // Ordenação por menor preço
    await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price-asc/)
    if (app.isMobile) await page.getByRole('button', { name: /Ver .* resultados/ }).click()

    const names = await cardNames(page)
    expect(names.length).toBeGreaterThan(0)
    const prices = (await page.getByTestId('catalog-grid').locator('[data-testid="nft-card"]:visible p span:first-child').allInnerTexts()).map((t) => parseFloat(t))
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    expect(names).toContain('Golden Signal #160')

    // Refresh mantém o estado
    const url = page.url()
    await page.reload()
    await expect(page).toHaveURL(url)
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    expect(await cardNames(page)).toEqual(names)

    // Histórico: volta para página 2 sem filtros e avança novamente
    await page.goBack() // remove ordenação
    await page.goBack() // remove rede
    await page.goBack() // remove categoria
    await expect(page).toHaveURL(/page=2/)
    await expect(page).not.toHaveURL(/categories=/)
    await page.goForward()
    await expect(page).toHaveURL(/categories=musica/)
  })

  test('busca por texto reflete os parâmetros enviados à API e trata resultado vazio', async ({ app, page }) => {
    const requests: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/nfts?')) requests.push(r.url())
    })
    await app.goto('/mercado?q=golden')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    const names = await cardNames(page)
    expect(names.every((n) => n.toLowerCase().includes('golden'))).toBe(true)
    expect(requests.some((u) => u.includes('q=golden'))).toBe(true)

    await app.goto('/mercado?q=inexistente-xyz')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page).not.toHaveURL(/q=/)
  })

  test('parâmetros inválidos na URL são ignorados sem quebrar a página', async ({ app, page }) => {
    await app.goto('/mercado?page=abc&sort=hack&categories=<script>&minPrice=-1')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })
})

test.describe('Catálogo — respostas fora de ordem', () => {
  test.use({ scenarios: ['out-of-order'] })

  test('a resposta antiga não sobrescreve a consulta mais recente', async ({ app, page }) => {
    test.skip(app.isMobile, 'cenário de rede validado no desktop')
    await app.goto('/mercado')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    const filters = page.getByRole('complementary', { name: 'Filtros' })
    // Dois cliques rápidos: a 1ª resposta (lenta, 1,2 s) chega depois da 2ª (rápida).
    await filters.getByRole('button', { name: /Fotografia/ }).click()
    await filters.getByRole('button', { name: /Música/ }).click()
    await expect(page).toHaveURL(/categories=fotografia,musica|categories=musica,fotografia/)
    await page.waitForTimeout(1600)
    const names = await cardNames(page)
    // Resultado final corresponde à consulta mais recente (Fotografia + Música).
    expect(names).toContain('Golden Beat #207')
  })
})
