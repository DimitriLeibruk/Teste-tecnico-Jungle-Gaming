import { test, expect } from './fixtures'

/** 7. Falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido. */

test.describe('Pagamento recusado', () => {
  test.use({ scenarios: ['instant', 'payment-declined'] })

  test('pedido recusado não mostra confirmação e preserva os itens', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('emerald-ape-042', 1)
    await app.startCheckout()
    await app.openReview()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()

    // Estado terminal: recarregar mantém "recusado"
    await page.reload()
    await expect(page.getByTestId('order-declined')).toBeVisible()
    await app.goto('/carrinho')
    await expect(page.getByText('Emerald Ape #042').locator('visible=true').first()).toBeVisible()
  })
})

test.describe('Clique repetido', () => {
  test('cliques repetidos em confirmar geram um único pedido', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('golden-beat-207', 1)
    await app.startCheckout()
    await app.openReview()
    // Três cliques no mesmo tick (antes de o React desabilitar o botão).
    await page.getByTestId('confirm-order').evaluate((button: HTMLButtonElement) => {
      button.click()
      button.click()
      button.click()
    })
    await expect(page).toHaveURL(/\/pedidos\//)
    const orders = await app.mock((m) => m.orders())
    expect(orders).toHaveLength(1)
  })
})

test.describe('Timeout após criação do pedido', () => {
  test.use({ scenarios: ['instant', 'order-timeout'] })

  test('a nova tentativa com a mesma chave de idempotência recupera o mesmo pedido', async ({ app, page }) => {
    test.setTimeout(60_000)
    await app.login('ana')
    await app.addToCart('golden-beat-207', 1)
    await app.startCheckout()
    await app.openReview()
    const keys: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/orders')) keys.push(r.headers()['idempotency-key'] ?? '')
    })
    await page.getByTestId('confirm-order').click()
    // 1ª resposta se perde (timeout de 8 s); o cliente reenvia com a MESMA chave e recupera o pedido.
    await expect(page.getByRole('button', { name: /Enviando pedido/ })).toBeVisible()
    await expect(page).toHaveURL(/\/pedidos\//, { timeout: 20_000 })
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBeTruthy()
    expect(keys[1]).toBe(keys[0])
    const orders = await app.mock((m) => m.orders())
    expect(orders).toHaveLength(1)
    expect(page.url()).toContain(orders[0]!.id)
  })
})

test.describe('Carteira recusa a conexão', () => {
  test.use({ scenarios: ['instant', 'wallet-rejected'] })

  test('mostra a recusa e permite tentar novamente', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('golden-beat-207', 1)
    await app.startCheckout()
    await page.getByTestId('checkout-submit').click()
    await expect(page.getByText(/A conexão foi recusada na carteira/)).toBeVisible()
    await app.openReview()
    await expect(page.getByText(/Conectado: MetaMask/)).toBeAttached()
  })
})

test.describe('Desconexão da carteira', () => {
  test('desconectar a carteira exige nova conexão antes de confirmar', async ({ app, page }) => {
    await app.login('ana')
    await app.addToCart('golden-beat-207', 1)
    await app.startCheckout()
    await app.openReview()
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page.getByText(/Conectado: MetaMask/)).toBeVisible()
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByText(/Conectado: MetaMask/)).toHaveCount(0)
    await expect(page.getByText(/será conectada \(simulação\)/)).toBeVisible()
  })
})
