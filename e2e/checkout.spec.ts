import { test, expect } from './fixtures'

/** 6. Compra completa, do catálogo ao recibo confirmado. */

test.describe('Compra', () => {
  test('do catálogo ao recibo confirmado, removendo do carrinho só o que foi comprado', async ({ app, page }) => {
    // Catálogo → detalhe
    await app.goto('/mercado')
    await page.getByRole('link', { name: 'Emerald Ape #042' }).locator('visible=true').first().click()
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042/)
    await app.addToCart('emerald-ape-042', 2)
    await app.addToCart('golden-beat-207', 1)

    // Checkout exige autenticação e retorna ao fluxo
    await app.goto('/carrinho')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=/)
    await app.login('ana')
    await expect(page).toHaveURL(/\/pagamento/)

    // Formulário preenchido a partir da carteira principal
    if (app.isMobile) await page.getByRole('button', { name: /Perfil do colecionador/ }).click()
    await expect(page.getByRole('textbox', { name: /Nome do perfil/ })).toHaveValue('Ana Colecionadora')

    await app.openReview()
    const review = page.getByRole('dialog', { name: 'Revise seu pedido' })
    await expect(review.getByTestId('quote-total')).toHaveText('3.386 ETH')
    await review.getByTestId('confirm-order').click()

    // Pendente → confirmado pela simulação (evento order.updated)
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const receipt = page.getByTestId('receipt')
    await expect(receipt).toBeVisible({ timeout: 15_000 })
    await expect(receipt.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible()
    await expect(receipt.getByTestId('receipt-total')).toHaveText('3.386 ETH')
    await expect(receipt.getByRole('link', { name: /Ver no Etherscan/ })).toHaveAttribute('href', /etherscan\.io\/tx\/0x[0-9a-f]{64}/)

    // O recibo é um snapshot: alterar o preço no catálogo não muda o pedido
    await app.mock((m) => m.updateNft('emerald-ape-042', { editionId: '1-50', price: '9.99' }))
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('3.386 ETH')

    // Itens comprados saíram do carrinho
    await app.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('mantém no carrinho quantidades adicionadas que não foram compradas', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('golden-signal-160', 1)
    await app.startCheckout()
    await app.openReview()
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedidos\//)
    const orderUrl = page.url()

    // Enquanto o pedido está pendente, o usuário adiciona outro item.
    await app.addToCart('golden-beat-207', 1)
    await page.goto(orderUrl)
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    await app.goto('/carrinho')
    await expect(page.getByText('Golden Beat #207').locator('visible=true').first()).toBeVisible()
    await expect(page.getByText('Golden Signal #160')).toHaveCount(0)
  })
})
