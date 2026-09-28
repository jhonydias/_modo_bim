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
    /* rola aos poucos: com o card do kit (task 23) a página ficou mais alta, e um
       salto direto para o fim passa por cima dos cards sem eles cruzarem a tela */
    const altura = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= altura; y += 400) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(60);
    }
    await page.waitForTimeout(800);

    const total = await page.locator('.reveal').count();
    await expect(page.locator('.reveal.in')).toHaveCount(total);
});

test('a vitrine tem dois produtos, o kit primeiro', async ({ page }) => {
    await expect(page.locator('.prod-card')).toHaveCount(2);
    await expect(page.locator('.prod-card').first()).toHaveClass(/prod-card--media/);
});

/* Task 23 — o card do kit é o único com imagem, e a imagem é a capa. */
test('o card do kit mostra a capa e aponta para kit.html, na mesma aba', async ({ page }) => {
    const card = page.locator('a.prod-card--media');
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute('href', 'kit.html');
    await expect(card).not.toHaveAttribute('target', /.+/);

    const capa = card.locator('img');
    await expect(capa).toHaveAttribute('src', 'img/capa-kit.png');
    await expect(capa).toHaveAttribute('alt', /Kit de Projeto BIM/);
    await capa.scrollIntoViewIfNeeded();
    await expect.poll(() => capa.evaluate((img) => img.complete && img.naturalWidth)).toBe(1080);
});

test('clicar na capa abre a página do kit', async ({ page }) => {
    const capa = page.locator('a.prod-card--media img');
    await capa.scrollIntoViewIfNeeded();
    await capa.click();
    await page.waitForURL('**/kit.html');
    await expect(page.locator('h1')).toContainText('Os erros de um projeto BIM');
});

test('o card do diagnóstico aponta para o Tally, em nova aba', async ({ page }) => {
    const card = page.locator('a.prod-card[href^="https://tally.so"]');
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
