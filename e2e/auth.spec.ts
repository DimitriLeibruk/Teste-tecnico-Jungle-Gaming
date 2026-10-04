import { test, expect } from './fixtures'

/** 3. Cadastro, login, expiração de sessão, logout e troca de usuário. */

test.describe('Conta e sessão', () => {
  test('cadastro valida campos, trata conflito e cria a conta', async ({ app, page }) => {
    await app.goto('/cadastro')
    const form = page.getByRole('form', { name: 'Criar conta' })
    await form.getByRole('button', { name: 'Criar conta' }).click()
    await expect(form.getByText('Use pelo menos 3 caracteres')).toBeVisible()
    await expect(form.getByText('Informe o e-mail')).toBeVisible()

    // Conflito: e-mail já cadastrado (validação do servidor).
    await form.getByPlaceholder('Nome de usuário').fill('nova.pessoa')
    await form.getByPlaceholder('Digite seu e-mail').fill('ana@kurio.dev')
    await form.getByPlaceholder('Senha', { exact: true }).fill('SenhaForte1')
    await form.getByPlaceholder('Confirmar senha').fill('SenhaForte2')
    await form.getByRole('button', { name: 'Criar conta' }).click()
    await expect(form.getByText('As senhas não conferem')).toBeVisible()
    await form.getByPlaceholder('Confirmar senha').fill('SenhaForte1')
    await form.getByRole('button', { name: 'Criar conta' }).click()
    const email = form.getByPlaceholder('Digite seu e-mail')
    await expect(form.getByText('Este e-mail já está cadastrado')).toBeVisible()
    await expect(email).toHaveAttribute('aria-invalid', 'true')

    await email.fill('nova@kurio.dev')
    await form.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page).toHaveURL(/\/$/)
    // Sessão recuperável após refresh
    await page.reload()
    await app.goto('/conta/perfil')
    await expect(page.getByRole('textbox', { name: /Nome de usuário/ })).toHaveValue('nova.pessoa')
  })

  test('login inválido mostra erro e login válido retorna ao fluxo anterior', async ({ app, page }) => {
    await app.goto('/conta/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=/)
    const form = page.getByRole('form', { name: 'Entrar' })
    await form.getByPlaceholder('contato@email.com').fill('ana@kurio.dev')
    await form.getByPlaceholder('Senha').fill('senha-errada')
    await form.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()

    await app.login('ana')
    await expect(page).toHaveURL(/\/conta\/carteiras/)
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('sessão expirada durante a navegação redireciona ao login preservando o destino', async ({ app, page }) => {
    await app.login('ana')
    await app.goto('/conta/perfil')
    await expect(page.getByRole('textbox', { name: /Nome de exibição/ })).toHaveValue('Ana Souza')

    await app.mock((m) => m.expireSessions())
    await page.getByRole('link', { name: /Carteiras/ }).first().click()
    await expect(page).toHaveURL(/\/entrar\?.*motivo=expirada/)
    await expect(page.getByText(/Sua sessão expirou/).first()).toBeVisible()

    await app.login('ana')
    await expect(page).toHaveURL(/\/conta\//)
  })

  test('logout e troca de usuário limpam dados privados do usuário anterior', async ({ app, page }) => {
    await app.login('ana')
    await app.goto('/conta/favoritos')
    await expect(page.getByTestId('favorites-grid').getByText('Emerald Ape #042')).toBeVisible()

    // Logout pela conta
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    const stored = await page.evaluate(() => localStorage.getItem('kurio.session'))
    expect(stored).toBeNull()

    // Outro usuário não vê os favoritos da Ana
    await app.login('bruno')
    await app.goto('/conta/favoritos')
    await expect(page.getByTestId('favorites-grid').getByText('Ivory Baron #088')).toBeVisible()
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)

    // Rota privada após logout volta a exigir login
    await page.getByRole('button', { name: 'Sair' }).click()
    await app.goto('/pagamento')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento|\/entrar\?redirect=\/pagamento/)
  })
})

test.describe('Sessão expirada no servidor (cenário)', () => {
  test.use({ scenarios: ['session-expired'] })

  test('a primeira chamada autenticada após o login recebe 401 e o usuário é avisado', async ({ app, page }) => {
    await app.login('ana')
    await app.goto('/conta/perfil')
    await expect(page).toHaveURL(/\/entrar\?.*motivo=expirada/)
    await expect(page.getByText(/Sua sessão expirou/).first()).toBeVisible()
  })
})
