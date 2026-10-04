import { test, expect } from './fixtures'

/**
 * 9. Alteração de preço/disponibilidade via Socket.IO durante o checkout.
 * Os eventos são emitidos pelo servidor simulado e chegam pelo socket.io-client.
 */

test.describe('Tempo real — nft.updated', () => {
  test('preço muda com o NFT no carrinho: a UI informa, atualiza o resumo e o catálogo', async ({ app, page }) => {
    await app.addToCart('emerald-ape-042', 1)
    await app.goto('/carrinho')
    await expect(page.getByTestId('quote-total')).toHaveText('1.206 ETH')

    await app.mock((m) => m.updateNft('emerald-ape-042', { editionId: '1-50', price: '1.5' }))
    await expect(page.getByTestId('realtime-notices')).toContainText('O preço de Emerald Ape #042 (1/50) mudou de 1.19 ETH para 1.50 ETH')
    await expect(page.getByTestId('quote-total')).toHaveText('1.516 ETH')
    await expect(page.getByText(/Preço alterado \(era 1\.19 ETH\)/).locator('visible=true').first()).toBeVisible()

    // Catálogo e detalhe refletem o novo preço (cache atualizado pelo evento)
    await app.goto('/nft/emerald-ape-042')
    await expect(page.getByText('1.50 ETH').locator('visible=true').first()).toBeVisible()
  })

  test('checkout impede confirmar com cotação desatualizada e exige nova confirmação', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('golden-beat-207', 1)
    await app.startCheckout()
    await app.openReview()
    const review = page.getByRole('dialog', { name: 'Revise seu pedido' })
    await expect(review.getByTestId('quote-total')).toHaveText('1.006 ETH')

    // Evento chega com a revisão aberta
    await app.mock((m) => m.updateNft('golden-beat-207', { editionId: '1-50', price: '1.25' }))
    await expect(review.getByText('Recebemos uma atualização de preço ou disponibilidade.')).toBeVisible()
    await expect(review.getByTestId('confirm-order')).toBeDisabled()
    await review.getByRole('button', { name: 'Atualizar revisão' }).click()
    await expect(review.getByText('Os valores do pedido mudaram', { exact: true })).toBeVisible()
    await expect(review.getByTestId('quote-total')).toHaveText('1.266 ETH')

    await review.getByRole('button', { name: 'Confirmar novos valores' }).click()
    await expect(page).toHaveURL(/\/pedidos\//)
    await expect(page.getByTestId('receipt-total')).toHaveText('1.266 ETH', { timeout: 15_000 })
  })

  test('edição esgotada durante o checkout bloqueia a confirmação', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('golden-beat-207', 1)
    await app.startCheckout()
    await app.mock((m) => m.updateNft('golden-beat-207', { editionId: '1-50', available: 0 }))
    await expect(page.getByTestId('realtime-notices')).toContainText('esgotou')
    await expect(page.getByTestId('checkout-submit')).toBeDisabled()
  })
})

test.describe('Tempo real — mudança concorrente no envio do pedido', () => {
  test.use({ scenarios: ['instant', 'price-change'] })

  test('o servidor rejeita a cotação desatualizada (409) e o usuário reconfirma', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('golden-beat-207', 1)
    await app.startCheckout()
    await app.openReview()
    const review = page.getByRole('dialog', { name: 'Revise seu pedido' })
    await review.getByTestId('confirm-order').click()
    await expect(review.getByText('Os valores do pedido mudaram', { exact: true })).toBeVisible()
    await expect(review.getByTestId('quote-total')).toHaveText('1.106 ETH')
    expect(await app.mock((m) => m.orders())).toHaveLength(0)

    await review.getByRole('button', { name: 'Confirmar novos valores' }).click()
    await expect(page).toHaveURL(/\/pedidos\//)
    expect(await app.mock((m) => m.orders())).toHaveLength(1)
  })
})
