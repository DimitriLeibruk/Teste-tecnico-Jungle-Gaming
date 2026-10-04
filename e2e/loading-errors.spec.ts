import { test, expect } from './fixtures'

/** 12. Skeletons durante carregamento lento, feedback de falha e recuperação após nova tentativa. */

test.describe('Carregamento lento', () => {
  test.use({ scenarios: ['slow'] })

  test('skeletons com shimmer no catálogo, detalhe e resumo do carrinho', async ({ app, page }) => {
    await app.goto('/')
    await expect(page.getByLabel('Carregando NFTs')).toBeVisible()
    await expect(page.locator('.skeleton:visible').first()).toBeVisible()
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 10_000 })

    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 10_000 })

    await app.goto('/carrinho')
    await expect(page.getByLabel('Carregando carrinho')).toBeVisible()
  })

  test('com movimento reduzido o shimmer é desativado', async ({ app, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await app.goto('/')
    const skeleton = page.locator('.skeleton:visible').first()
    await expect(skeleton).toBeVisible()
    const animation = await skeleton.evaluate((el) => getComputedStyle(el, '::after').animationName)
    expect(animation === 'none' || animation === '').toBe(true)
  })
})

test.describe('Falha transitória', () => {
  test.use({ scenarios: ['instant', 'catalog-error'] })

  test('mostra o erro após as novas tentativas automáticas e recupera ao tentar novamente', async ({ app, page }) => {
    await app.goto('/mercado')
    await expect(page.getByText('Não foi possível carregar o catálogo')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Catálogo temporariamente indisponível')).toBeVisible()
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })
})

test.describe('Sem conexão', () => {
  test.use({ scenarios: ['offline'] })

  test('informa falha de conexão', async ({ app, page }) => {
    await app.goto('/mercado')
    await expect(page.getByText('Sem conexão').first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Catálogo vazio', () => {
  test.use({ scenarios: ['instant', 'empty'] })

  test('exibe estado vazio', async ({ app, page }) => {
    await app.goto('/mercado')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
  })
})
