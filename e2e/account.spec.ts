import { test, expect } from './fixtures'

/** 8. Edição de perfil, avatar, senha e carteiras, com erros de validação. */

// PNG 1×1 válido
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.describe('Perfil', () => {
  test('edita dados com validação local, conflito do servidor e persistência após refresh', async ({ app, page }) => {
    await app.login('ana')
    await app.goto('/conta/perfil')
    const displayName = page.getByRole('textbox', { name: /Nome de exibição/ })
    const username = page.getByRole('textbox', { name: /Nome de usuário/ })
    await expect(displayName).toHaveValue('Ana Souza')

    // Validação local
    await displayName.fill('A')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Informe ao menos 2 caracteres')).toBeVisible()
    await expect(displayName).toHaveAttribute('aria-invalid', 'true')

    // Conflito retornado pela API (usuário de outra conta)
    await displayName.fill('Ana S. Colecionadora')
    await username.fill('bruno.lima')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso')).toBeVisible()
    await expect(username).toHaveAttribute('aria-invalid', 'true')

    await username.fill('ana.colecionadora')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil atualizado com sucesso.').first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole('textbox', { name: /Nome de exibição/ })).toHaveValue('Ana S. Colecionadora')
    await expect(page.getByRole('textbox', { name: /Nome de usuário/ })).toHaveValue('ana.colecionadora')
  })

  test('avatar: rejeita formato inválido, envia imagem e remove', async ({ app, page }) => {
    await app.login('ana')
    await app.goto('/conta/perfil')
    const input = page.locator('#avatar-input')
    await input.setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
    await expect(page.getByText('Use uma imagem PNG, JPG ou WebP.')).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('img', { name: 'Seu avatar atual' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: 'Seu avatar atual' })).toBeVisible()
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByLabel('Sem avatar')).toBeVisible()
  })

  test('senha: valida confirmação, rejeita senha atual incorreta e altera', async ({ app, page }) => {
    await app.login('bruno')
    await app.goto('/conta/perfil')
    const current = page.getByLabel('Senha atual', { exact: true })
    const next = page.getByLabel('Nova senha', { exact: true })
    const confirm = page.getByLabel('Confirmar nova senha', { exact: true })

    await current.fill('Kurio@2026')
    await next.fill('NovaSenha2026')
    await confirm.fill('Diferente2026')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('As senhas não conferem')).toBeVisible()

    await current.fill('senhaErrada1')
    await confirm.fill('NovaSenha2026')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha atual incorreta').first()).toBeVisible()

    await current.fill('Kurio@2026')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha alterada com sucesso.').first()).toBeVisible()

    // Nova senha funciona no próximo login
    await page.getByRole('button', { name: 'Sair' }).click()
    await app.goto('/entrar')
    const form = page.getByRole('form', { name: 'Entrar' })
    await form.getByPlaceholder('contato@email.com').fill('bruno@kurio.dev')
    await form.getByPlaceholder('Senha').fill('NovaSenha2026')
    await form.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).not.toHaveURL(/\/entrar/)
  })
})

test.describe('Carteiras', () => {
  test('cadastra carteira principal e secundária com validação e conflito de endereço', async ({ app, page }) => {
    await app.login('carla')
    await app.goto('/conta/carteiras')
    await expect(page.getByText('Você ainda não adicionou uma carteira principal.')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar' }).first().click()

    const form = page.getByRole('form', { name: 'Carteira principal' })
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText('Informe o apelido da carteira')).toBeVisible()

    await form.getByRole('textbox', { name: /Apelido da carteira/ }).fill('Cofre Carla')
    await form.getByRole('textbox', { name: /Nome do perfil/ }).fill('Carla Coleciona')
    await form.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x123')
    await form.getByRole('textbox', { name: /Código de indicação/ }).fill('CARLA2026')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText(/Endereço inválido/)).toBeVisible()

    // Endereço já vinculado a outra conta (validação do servidor)
    await form.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0xA91F3c2B7d4E8a1F6b0C9e2D5a7B3c8E1f4AE82C')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText('Este endereço já está vinculado a outra conta Kurio')).toBeVisible()

    await form.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x9999999999999999999999999999999999999999')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva').first()).toBeAttached()

    // Secundária igual à principal
    await page.getByRole('checkbox', { name: 'Igual à carteira principal' }).click()
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    await expect(secondary.getByRole('textbox', { name: /Endereço da carteira/ })).toHaveValue('0x9999999999999999999999999999999999999999')
    await secondary.getByRole('button', { name: 'Salvar carteira secundária' }).click()
    await expect(page.getByText('Carteira secundária salva').first()).toBeAttached()

    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira secundária' })).toBeVisible()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByRole('textbox', { name: /Apelido da carteira/ })).toHaveValue('Cofre Carla')
  })
})
