import { test as base, expect, type Page } from '@playwright/test'
import type { MockControl } from '../src/mocks/control'
import type { ScenarioId } from '../src/mocks/scenarios'

/**
 * Fixtures compartilhadas:
 * - `scenarios`: cenários do mock ativos no teste (padrão: `instant`, sem latência).
 * - O painel Mock Lab fica oculto (não interfere em cliques nem em screenshots).
 * - `mock(fn)`: executa uma ação no SERVIDOR simulado (window.__KURIO_MOCK__);
 *   a UI recebe o efeito pelos caminhos reais (REST/MSW e Socket.IO).
 */
type Fixtures = {
  scenarios: ScenarioId[]
  app: App
}

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio@2026', name: 'Ana Souza' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio@2026', name: 'Bruno Lima' },
  carla: { email: 'carla@kurio.dev', password: 'Kurio@2026', name: 'Carla Mendes' },
} as const

export class App {
  constructor(readonly page: Page) {}

  get isMobile() {
    return (this.page.viewportSize()?.width ?? 1440) < 768
  }

  async goto(path: string) {
    await this.page.goto(path)
    await this.page.waitForFunction(() => !!window.__KURIO_MOCK__)
  }

  /** Executa uma função no servidor simulado. */
  async mock<T>(fn: (control: MockControl, arg: never) => T | Promise<T>, arg?: unknown): Promise<T> {
    return this.page.evaluate(
      ([source, a]) => {
        const f = new Function(`return (${source})`)() as (c: unknown, a: unknown) => unknown
        return f(window.__KURIO_MOCK__, a)
      },
      [fn.toString(), arg] as const,
    ) as Promise<T>
  }

  /** Login pela página /entrar (o destino padrão volta para `redirect`). */
  async login(user: keyof typeof USERS, { from = '/entrar' }: { from?: string } = {}) {
    if (!this.page.url().includes('/entrar')) await this.goto(from)
    const form = this.page.getByRole('form', { name: 'Entrar' })
    await form.getByPlaceholder('contato@email.com').fill(USERS[user].email)
    await form.getByPlaceholder('Senha').fill(USERS[user].password)
    await form.getByRole('button', { name: 'Entrar' }).click()
    await expect(this.page).not.toHaveURL(/\/entrar/)
  }

  /** Adiciona um NFT ao carrinho pelo detalhe (edição padrão). */
  async addToCart(nftId: string, quantity = 1) {
    await this.goto(`/nft/${nftId}`)
    const plus = this.page.getByRole('button', { name: /Aumentar quantidade/ })
    const visiblePlus = this.isMobile ? plus.last() : plus.first()
    for (let i = 1; i < quantity; i++) await visiblePlus.click()
    if (this.isMobile) await this.page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    else {
      await this.page.getByRole('button', { name: 'Comprar', exact: true }).click()
      await this.page.waitForURL('**/carrinho')
    }
    await expect(this.page.getByText(/adicionado ao carrinho/).first()).toBeAttached()
  }

  /** Do carrinho até a página de pagamento (usuário já autenticado). */
  async startCheckout() {
    await this.goto('/carrinho')
    await this.page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(this.page).toHaveURL(/\/pagamento/)
    await expect(this.page.getByTestId('checkout-submit')).toBeEnabled()
  }

  /** Conecta a carteira (simulação) e abre o diálogo de revisão. */
  async openReview() {
    await this.page.getByTestId('checkout-submit').click()
    await expect(this.page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeVisible()
  }

  cartCount() {
    return this.page.getByTestId('cart-count').first()
  }
}

export const test = base.extend<Fixtures>({
  scenarios: [['instant'], { option: true }],
  page: async ({ page, scenarios }, use) => {
    await page.addInitScript((ids) => {
      try {
        localStorage.setItem('kurio.mock.panel', 'hidden')
        if (!localStorage.getItem('kurio.mock.scenario')) localStorage.setItem('kurio.mock.scenario', JSON.stringify(ids))
      } catch {
        /* noop */
      }
    }, scenarios)
    await use(page)
  },
  app: async ({ page }, use) => {
    await use(new App(page))
  },
})

export { expect }
export type { App as AppType }
