/* Task 23 — kit.html.
 *
 * Duas coisas a travar: (1) todo CTA de compra leva ao checkout da Kiwify, sem
 * placeholder sobrando; (2) a página está no padrão visual do site — fontes,
 * cores e o pattern cereja com brilho —, medido no browser, não no texto do CSS.
 * O checkout é conferido por atributo, não navegando: rede de terceiro em suíte
 * de smoke é instabilidade importada.
 */
import { test, expect } from '@playwright/test';
import { lerArquivo } from './helpers/suite.js';

const CHECKOUT = 'https://pay.kiwify.com.br/omXmzfG';
const CEREJA = 'rgb(129, 22, 30)';

test.beforeEach(async ({ page }) => { await page.goto('/kit.html'); });

test('todo CTA de compra leva ao checkout da Kiwify, em nova aba', async ({ page }) => {
    const ctas = page.locator('[data-checkout]');
    // hero, cartão de preço e CTA final
    await expect(ctas).toHaveCount(3);
    for (const cta of await ctas.all()) {
        await expect(cta).toHaveAttribute('href', CHECKOUT);
        await expect(cta).toHaveAttribute('target', '_blank');
        await expect(cta).toHaveAttribute('rel', /noopener/);
    }
});

test('nenhum botão de compra ficou fora do checkout', async ({ page }) => {
    expect(lerArquivo('kit.html')).not.toMatch(/LINK_CHECKOUT/);

    // todo .btn da página que fala em "kit" é um CTA de compra
    const rotulos = await page.$$eval('a.btn', (as) => as
        .filter((a) => /kit/i.test(a.textContent))
        .map((a) => ({ texto: a.textContent.trim(), checkout: a.hasAttribute('data-checkout') })));
    expect(rotulos.length).toBeGreaterThan(0);
    for (const r of rotulos) expect(r.checkout, r.texto).toBe(true);
});

test('fontes e cores são as do site', async ({ page }) => {
    const estilo = await page.evaluate(() => {
        const cs = (sel) => getComputedStyle(document.querySelector(sel));
        return {
            h1Fonte: cs('h1').fontFamily,
            h1Cor: cs('h1').color,
            corpoFonte: cs('body').fontFamily,
            fundo: cs('body').backgroundColor,
            texto: cs('body').color,
            label: cs('.label').fontFamily,
            ctaFinal: cs('.cta-final').backgroundColor
        };
    });
    expect(estilo.h1Fonte).toMatch(/^"?Sentient/);
    expect(estilo.h1Cor).toBe(CEREJA);
    expect(estilo.corpoFonte).toMatch(/^"?Inter/);
    expect(estilo.fundo).toBe('rgb(239, 238, 233)');
    expect(estilo.texto).toBe('rgb(76, 79, 55)');
    expect(estilo.label).toMatch(/Neue Haas Grotesk/);
    expect(estilo.ctaFinal).toBe(CEREJA);

    // nenhuma fonte fora do padrão foi carregada
    expect(lerArquivo('kit.html')).not.toMatch(/Source\+Serif|Source Serif/);
});

test('o detalhe cereja tem o pattern com brilho', async ({ page }) => {
    const pats = page.locator('.problema .modo-tex, .cta-final .modo-tex');
    await expect(pats).toHaveCount(3);
    for (const p of await pats.all()) {
        expect(await p.evaluate((el) => getComputedStyle(el).animationName)).toBe('patShimmer');
    }
    expect(await page.locator('.problema').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(CEREJA);
});

test('o acordeão abre uma dúvida por vez', async ({ page }) => {
    const qs = page.locator('.faq-q');
    await qs.nth(0).scrollIntoViewIfNeeded();
    await page.waitForTimeout(900); // espera o reveal da lista assentar

    await qs.nth(0).click();
    await expect(qs.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => page.locator('.faq-a').nth(0).evaluate((el) => el.offsetHeight)).toBeGreaterThan(0);

    await qs.nth(1).click();
    await expect(qs.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(qs.nth(0)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.faq-item.open')).toHaveCount(1);
});

test('os blocos revelam ao entrar em cena', async ({ page }) => {
    // rola aos poucos: o observer só marca o que realmente passou pela tela
    const altura = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= altura; y += 500) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(60);
    }
    await page.waitForTimeout(800);

    const total = await page.locator('.reveal').count();
    await expect(page.locator('.reveal.in')).toHaveCount(total);
});

test('as imagens do kit e a foto das autoras carregam de verdade', async ({ page }) => {
    const imgs = page.locator('main img');
    for (const img of await imgs.all()) {
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0),
            { message: await img.getAttribute('src') }).toBe(true);
    }
    await expect(page.locator('img[src="img/dayana-e-joene.jpg"]')).toHaveCount(1);
});

test('o link secundário do hero leva à lista de materiais', async ({ page }) => {
    await page.locator('.hero .tlink').click();
    await expect(page).toHaveURL(/#materiais$/);
    await expect(page.locator('#materiais')).toBeInViewport();
});
