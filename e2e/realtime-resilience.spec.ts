import { test, expect } from './fixtures'

/** 10. Eventos duplicados ou antigos, desconexão e retomada de pedido pendente. */

test.describe('Eventos duplicados e antigos', () => {
  test.use({ scenarios: ['instant', 'realtime-chaos'] })

  test('duplicatas e versões antigas não regridem o estado nem reaplicam efeitos', async ({ app, page }) => {
    await app.addToCart('emerald-ape-042', 1)
    await app.goto('/carrinho')
    await expect(page.getByTestId('quote-total')).toHaveText('1.206 ETH')

    // Com realtime-chaos, cada evento chega duplicado e seguido de uma versão antiga (preço 999).
    await app.mock((m) => m.updateNft('emerald-ape-042', { editionId: '1-50', price: '1.3' }))
    await expect(page.getByTestId('quote-total')).toHaveText('1.316 ETH')
    await expect(page.getByTestId('realtime-notices').getByRole('status')).toHaveCount(1)

    // Reenvios explícitos: duplicata exata e evento com versão anterior
    await app.mock((m) => m.replayLastEvent())
    await app.mock((m) => m.emitStaleNftEvent('emerald-ape-042'))
    await page.waitForTimeout(500)
    await expect(page.getByTestId('realtime-notices').getByRole('status')).toHaveCount(1)
    await expect(page.getByTestId('quote-total')).toHaveText('1.316 ETH')

    await app.goto('/nft/emerald-ape-042')
    await app.mock((m) => m.emitStaleNftEvent('emerald-ape-042'))
    await page.waitForTimeout(400)
    await expect(page.getByText('1.30 ETH').locator('visible=true').first()).toBeVisible()
    await expect(page.getByText('999')).toHaveCount(0)
    await expect(page.getByText('0.01 ETH')).toHaveCount(0)
  })
})

test.describe('Desconexão e retomada', () => {
  test('queda do socket com pedido pendente: reconecta, reconcilia via REST e mostra o resultado', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('golden-beat-207', 1)
    await app.startCheckout()
    await app.openReview()
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedidos\//)

    // Derruba o servidor de tempo real por 4 s enquanto o pedido está pendente.
    await app.mock((m) => m.disconnectSockets(4000))
    await expect(page.getByText(/Conexão em tempo real perdida/)).toBeVisible()
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Conexão em tempo real perdida/)).toHaveCount(0, { timeout: 10_000 })
    expect(await app.mock((m) => m.orders())).toHaveLength(1)
  })

  test('recarregar a página com pedido pendente recupera o estado sem criar outra compra', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('golden-beat-207', 1)
    await app.startCheckout()
    await app.openReview()
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedidos\//)
    await page.reload()
    await expect(page.getByTestId('order-pending').or(page.getByTestId('receipt'))).toBeVisible()
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    expect(await app.mock((m) => m.orders())).toHaveLength(1)

    // Pedido confirmado é terminal
    await app.mock((m) => m.settleOrder(m.orders()[0]!.id, 'declined'))
    await page.reload()
    await expect(page.getByTestId('receipt')).toBeVisible()
  })

  test('eventos de pedido de outra sessão não chegam ao usuário atual', async ({ app }) => {
    await app.login('ana')
    await app.goto('/')
    const peers = await app.mock((m) => m.connectedPeers())
    // Socket reautenticado com a sessão atual: só a Ana recebe eventos de pedidos dela.
    expect(peers.every((p) => p.userId === 'usr_ana')).toBe(true)
  })
})
