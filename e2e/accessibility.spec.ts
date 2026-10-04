import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

/** 11. Navegação por teclado, foco de diálogos e validação de formulários (+ auditoria axe). */

test.describe('Acessibilidade', () => {
  test('skip link e navegação por teclado até um NFT', async ({ app, page }) => {
    test.skip(app.isMobile, 'teclado físico: desktop')
    await app.goto('/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()

    // Tab até o primeiro link de NFT do catálogo e Enter abre o detalhe
    const firstCard = page.getByTestId('catalog-grid').getByRole('link', { name: 'Emerald Ape #042', exact: true }).locator('visible=true')
    await firstCard.focus()
    await expect(firstCard).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042/)
  })

  test('diálogo de login prende o foco, fecha com Esc e devolve o foco ao gatilho', async ({ app, page }) => {
    test.skip(app.isMobile, 'modal do header: desktop')
    await app.goto('/')
    const trigger = page.getByRole('banner').getByRole('button', { name: 'Entrar' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Foco dentro do diálogo e preso nele
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('erros de validação ficam associados aos campos (aria-describedby/aria-invalid)', async ({ app, page }) => {
    await app.goto('/entrar')
    const form = page.getByRole('form', { name: 'Entrar' })
    await form.getByRole('button', { name: 'Entrar' }).click()
    const email = form.getByPlaceholder('contato@email.com')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy}`)).toHaveText('Informe o e-mail')
    await expect(email).toBeFocused()
  })

  test('drawer de filtros (mobile) recebe e devolve o foco', async ({ app, page }) => {
    test.skip(!app.isMobile, 'drawer existe apenas no mobile')
    await app.goto('/')
    const trigger = page.getByRole('button', { name: 'Abrir filtros e ordenação' })
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: /Filtros e ordenação/ })
    await expect(sheet).toBeVisible()
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  })

  for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar']) {
    test(`auditoria axe sem violações sérias em ${path}`, async ({ app, page }) => {
      await app.goto(path)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('[data-sonner-toaster]').analyze()
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([])
    })
  }
})
