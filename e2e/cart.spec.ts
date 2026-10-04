import { test, expect } from './fixtures'

/** 5. Carrinho, quantidades, remoção, cupom e persistência após refresh/login. */

const rows = (app: import('./fixtures').App) => app.page.getByTestId(app.isMobile ? 'cart-row-mobile' : 'cart-row')

test.describe('Carrinho', () => {
  test('alterar quantidade, remover, cupom e resumo coerente com a API', async ({ app, page }) => {
    await app.addToCart('emerald-ape-042', 2)
    await app.addToCart('golden-beat-207', 1)
    await app.goto('/carrinho')
    await expect(rows(app)).toHaveCount(2)

    // 2 × 1.19 + 0.99 = 3.37 | taxa 0.016 | total 3.386
    await expect(page.getByTestId('quote-subtotal')).toHaveText('3.37 ETH')
    await expect(page.getByTestId('quote-total')).toHaveText('3.386 ETH')

    // Aumentar quantidade
    await page.getByRole('button', { name: 'Aumentar quantidade de Golden Beat #207 (1/50)' }).click()
    await expect(page.getByTestId('quote-subtotal')).toHaveText('4.36 ETH')

    // Cupom inválido e expirado
    const coupon = page.getByPlaceholder('Digite o código promocional...').locator('visible=true')
    await coupon.fill('NAOEXISTE')
    await coupon.press('Enter')
    await expect(page.getByText('Código promocional inválido').first()).toBeVisible()
    await expect(coupon).toHaveAttribute('aria-invalid', 'true')
    await coupon.fill('VERAO2025')
    await coupon.press('Enter')
    await expect(page.getByText('Este cupom expirou').first()).toBeVisible()

    // Cupom válido: 10% de 4.36 = 0.436
    await coupon.fill('KURIO10')
    await coupon.press('Enter')
    await expect(page.getByText('KURIO10').locator('visible=true').first()).toBeVisible()
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.436')
    await expect(page.getByTestId('quote-total')).toHaveText('3.94 ETH')

    // Remover cupom e item
    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).locator('visible=true').click()
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.00')
    await page.getByRole('button', { name: /Remover Golden Beat #207/ }).locator('visible=true').click()
    await expect(rows(app)).toHaveCount(1)
    await expect(page.getByTestId('quote-total')).toHaveText('2.396 ETH')
  })

  test('limite de quantidade respeita a disponibilidade da edição', async ({ app, page }) => {
    await app.goto('/')
    await app.mock((m) => m.updateNft('neon-vessel-552', { editionId: '1-50', available: 2 }))
    await app.addToCart('neon-vessel-552', 2)
    await app.goto('/carrinho')
    await expect(page.getByRole('button', { name: 'Aumentar quantidade de Neon Vessel #552 (1/50)' })).toBeDisabled()
  })

  test('carrinho do visitante persiste após refresh e é preservado ao autenticar', async ({ app, page }) => {
    await app.addToCart('violet-nomad-314', 3)
    await app.goto('/carrinho')
    await page.reload()
    await expect(rows(app)).toHaveCount(1)
    await expect(page.getByTestId('quote-subtotal')).toHaveText('4.17 ETH')

    // Login: o carrinho do visitante é mesclado no do usuário.
    await app.login('bruno')
    await app.goto('/carrinho')
    await expect(rows(app)).toHaveCount(1)
    await expect(page.getByText('Violet Nomad #314').locator('visible=true').first()).toBeVisible()
    await expect(app.cartCount()).toHaveText('3')

    // Logout: o carrinho do usuário não vaza para o visitante
    await app.goto('/conta/perfil')
    await page.getByRole('button', { name: 'Sair' }).click()
    await app.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()

    // Novo login recupera o carrinho do usuário
    await app.login('bruno')
    await app.goto('/carrinho')
    await expect(page.getByText('Violet Nomad #314').locator('visible=true').first()).toBeVisible()
  })
})
