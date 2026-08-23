/* Task 19 §5.7 — produtos.html.
 *
 * Página quase estática: menu, revelação e os destinos. Os links de terceiro
 * (Tally, WhatsApp) são conferidos por atributo, não navegando — rede de
 * terceiro em suíte de smoke é instabilidade importada.
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/produtos.html'); });

test('o menu abre, fecha no Escape e marca a página atual', async ({ page }) => {
    const menu = page.locator('#navLinks');
    const botao = page.locator('#navToggle');

    await expect(botao).toHaveAttribute('aria-expanded', 'false');
    await botao.click();
    await expect(menu).toHaveClass(/open/);
    await expect(botao).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveClass(/open/);

    await expect(page.locator('[aria-current="page"]')).toHaveAttribute('href', 'produtos.html');
});

test('os blocos revelam ao entrar em cena', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);

    const total = await page.locator('.reveal').count();
    await expect(page.locator('.reveal.in')).toHaveCount(total);
});

test('o card do diagnóstico aponta para o Tally, em nova aba', async ({ page }) => {
    const card = page.locator('.prod-card');
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute('href', 'https://tally.so/r/7RYDZ0');
    await expect(card).toHaveAttribute('target', '_blank');
    await expect(card).toHaveAttribute('rel', /noopener/);
    // saiu do estado "em breve" quando o produto foi publicado
    await expect(card).not.toHaveClass(/is-soon/);
});

test('os CTAs levam aos destinos certos', async ({ page }) => {
    await expect(page.locator('a.btn-cream')).toHaveAttribute('href', 'cadastro.html');
    await expect(page.locator('a.btn-ghost-light'))
        .toHaveAttribute('href', /^https:\/\/chat\.whatsapp\.com\//);
    await expect(page.locator('.footer a[href="lista-espera.html"]')).toHaveCount(1);
});

test('o CTA final tem a frase da task 18', async ({ page }) => {
    expect((await page.locator('.cta-final h2').textContent()).replace(/\s+/g, ' '))
        .toContain('pronto para o novo modo de projetar');
});

test('a proposta abre de verdade a partir daqui', async ({ page }) => {
    await page.locator('a.btn-cream').click();
    await page.waitForURL('**/cadastro.html');
    await expect(page.locator('#stage-cover')).toHaveClass(/active/);
});
