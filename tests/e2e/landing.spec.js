/* Task 19 §5.6 — index.html: modos de scroll, quiz, equipe, FAQ e mídia.
 *
 * Boa parte disto só existe com layout de verdade — é por isso que mora aqui e
 * não no jsdom.
 */
import { test, expect } from '@playwright/test';
import { pausarFaixaAnimada, rolarAte } from './helpers/suite.js';

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.describe('modos de navegação', () => {
    test('em ≥768px o selecionador aparece ao rolar e marca o painel clicado', async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto('/index.html');
        await pausarFaixaAnimada(page);

        const links = page.locator('.sec-link');
        const alvos = await links.evaluateAll((as) => as.map((a) => a.dataset.target));
        expect(alvos).toEqual(['nosso-modo', 'nossos-servicos', 'implementacoes', 'treinamentos']);

        // a barra só aparece depois de rolar ~60% da viewport (updateBarVisibility)
        await page.evaluate(() => window.scrollTo(0, window.innerHeight));
        await expect(page.locator('#sectionBar')).toHaveClass(/show/);

        await links.nth(2).click();
        await expect(links.nth(2)).toHaveClass(/active/, { timeout: 10_000 });
        await expect(page.locator('.sec-link.active')).toHaveCount(1);
    });

    test('em <768px não há rolagem horizontal', async ({ page }) => {
        await page.setViewportSize(MOBILE);
        await page.goto('/index.html');
        await pausarFaixaAnimada(page);
        await page.waitForTimeout(300);

        const estouro = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(estouro, 'a página rola para o lado no celular').toBeLessThanOrEqual(1);
    });

    /* Sem isto há risco real de conteúdo invisível para quem tem a preferência
       ligada: o modo horizontal não liga e o texto precisa aparecer inteiro. */
    test('com prefers-reduced-motion o conteúdo fica visível e sem modo horizontal', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize(DESKTOP);
        await page.goto('/index.html');
        await pausarFaixaAnimada(page);
        await page.waitForTimeout(400);

        // sem quebra em .rt-w: o texto não depende de animação para existir
        expect(await page.locator('.rt-w').count()).toBe(0);

        for (const id of ['nosso-modo', 'nossos-servicos', 'implementacoes', 'treinamentos']) {
            const secao = page.locator(`#${id}`);
            await expect(secao, `#${id} sumiu com reduced-motion`).toBeVisible();
        }

        const titulo = page.locator('#nossos-servicos h2').first();
        await expect(titulo).toBeVisible();
        expect((await titulo.textContent()).trim().length).toBeGreaterThan(5);
    });
});

test.describe('CTAs do hero', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto('/index.html');
        await pausarFaixaAnimada(page);
    });

    test('são proposta e diagnóstico, com o externo em nova aba', async ({ page }) => {
        const botoes = page.locator('.hero-actions .btn');
        await expect(botoes).toHaveCount(2);

        await expect(botoes.nth(0)).toHaveAttribute('href', 'cadastro.html');
        // commit 8427596: o "Saiba mais" do hero virou o diagnóstico do Tally
        await expect(botoes.nth(1)).toHaveAttribute('href', 'https://tally.so/r/7RYDZ0');
        await expect(botoes.nth(1)).toHaveAttribute('target', '_blank');
        await expect(botoes.nth(1)).toHaveAttribute('rel', /noopener/);
    });

    /* O ponto todo do @media (min-width:901px): nos 13px padrão os dois somavam
       535px numa coluna de ~494px e o segundo caía de linha.
       As larguras rodam num teste só, na mesma página: cinco recarregamentos com
       os vídeos da faixa custam memória e derrubaram o WebKit no Windows. */
    test('ficam lado a lado em toda largura de desktop', async ({ page }) => {
        for (const largura of [901, 1024, 1180, 1440, 1920]) {
            await page.setViewportSize({ width: largura, height: 900 });
            await page.waitForTimeout(250);

            const topos = await page.locator('.hero-actions .btn').evaluateAll((els) =>
                els.map((el) => el.getBoundingClientRect().top));
            expect(topos).toHaveLength(2);
            expect(Math.abs(topos[0] - topos[1]),
                `o segundo botão caiu de linha em ${largura}px`).toBeLessThan(4);
        }
    });

    test('o "Saiba mais" restante leva a #nossos-servicos', async ({ page }) => {
        const saibaMais = page.locator('a.tlink', { hasText: 'Saiba mais' });
        await expect(saibaMais).toHaveCount(1);
        await expect(saibaMais).toHaveAttribute('href', '#nossos-servicos');
    });
});

/* Regressões corrigidas em 22/08 e ainda sem teste até aqui. */
test.describe('seção quem somos', () => {
    const alturaDaSecao = (page) =>
        page.locator('.team').evaluate((el) => Math.round(el.getBoundingClientRect().height));
    const topoDoRotulo = (page) =>
        page.locator('.team-panel--copy .label').first()
            .evaluate((el) => Math.round(el.getBoundingClientRect().top - el.closest('.team').getBoundingClientRect().top));

    for (const largura of [768, 1024, 1440]) {
        test(`em ${largura}px a altura e o rótulo não mudam ao abrir uma bio`, async ({ page }) => {
            await page.setViewportSize({ width: largura, height: 900 });
            await page.goto('/index.html');
        await pausarFaixaAnimada(page);
            await rolarAte(page, '#equipe');
            await page.waitForTimeout(600);

            const alturaDefault = await alturaDaSecao(page);
            const rotuloDefault = await topoDoRotulo(page);

            const nomes = page.locator('.team-name');
            await expect(nomes).toHaveCount(2);

            for (let i = 0; i < 2; i++) {
                await nomes.nth(i).click();
                await page.waitForTimeout(700); // transição do fade + lockHeight

                expect(Math.abs(await alturaDaSecao(page) - alturaDefault),
                    `a seção mudou de altura na bio ${i}`).toBeLessThanOrEqual(2);
                expect(Math.abs(await topoDoRotulo(page) - rotuloDefault),
                    `o rótulo "_quem somos" desceu na bio ${i}`).toBeLessThanOrEqual(2);

                await expect(page.locator('#teamBack')).toBeVisible();
                await page.locator('#teamBack').click();
                await page.waitForTimeout(700);
            }
        });
    }

    test('o botão de voltar não se sobrepõe ao nome do canto', async ({ page }) => {
        await page.setViewportSize({ width: 901, height: 900 });
        await page.goto('/index.html');
        await pausarFaixaAnimada(page);
        await rolarAte(page, '#equipe');
        await page.waitForTimeout(500);

        await page.locator('.team-name').first().click();
        await page.waitForTimeout(700);

        const voltar = await page.locator('#teamBack').boundingBox();
        const nome = await page.locator('.team-photo .team-name').first().boundingBox()
            .catch(() => null);

        if (nome) {
            const sobrepoe = voltar.x < nome.x + nome.width && nome.x < voltar.x + voltar.width
                && voltar.y < nome.y + nome.height && nome.y < voltar.y + voltar.height;
            expect(sobrepoe, 'o "voltar" cobre o nome').toBe(false);
        }
    });
});

test.describe('quiz na página real', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto('/index.html');
        await pausarFaixaAnimada(page);
        await rolarAte(page, '#quiz');
    });

    test('cinco respostas de treinamento levam à lista de espera', async ({ page }) => {
        for (const n of [1, 2, 3, 4, 5]) await page.locator(`#q${n}a`).click();
        await expect(page.locator('#quizResult')).toBeVisible();
        await expect(page.locator('#resPrimary'))
            .toHaveAttribute('href', 'lista-espera.html?perfil=treinamento');
    });

    test('cinco respostas de implementação levam à proposta, e o link funciona', async ({ page }) => {
        for (const n of [1, 2, 3, 4, 5]) await page.locator(`#q${n}d`).click();
        await expect(page.locator('#resPrimary'))
            .toHaveAttribute('href', 'cadastro.html?perfil=implementacao');

        await page.locator('#resPrimary').click();
        await page.waitForURL('**/cadastro.html?perfil=implementacao');
        await expect(page.locator('#stage-cover')).toHaveClass(/active/);
    });

    test('recomeçar limpa as respostas', async ({ page }) => {
        for (const n of [1, 2, 3, 4, 5]) await page.locator(`#q${n}a`).click();
        await page.locator('#quizRestart').click();

        await expect(page.locator('#quizResult')).toBeHidden();
        await expect(page.locator('#quizForm')).toBeVisible();
        expect(await page.locator('#quizForm input:checked').count()).toBe(0);
    });
});

test.describe('conteúdo e mídia', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto('/index.html');
        await pausarFaixaAnimada(page);
    });

    test('o FAQ é acordeão exclusivo', async ({ page }) => {
        await rolarAte(page, '#faq');
        const itens = page.locator('.faq-item');

        await itens.nth(0).locator('.faq-q').click();
        await expect(itens.nth(0)).toHaveClass(/open/);

        await itens.nth(1).locator('.faq-q').click();
        await expect(itens.nth(0)).not.toHaveClass(/open/);
        await expect(itens.nth(1)).toHaveClass(/open/);

        await itens.nth(1).locator('.faq-q').click();
        await expect(itens.nth(1)).not.toHaveClass(/open/);
    });

    test('os contadores param num número, sem NaN', async ({ page }) => {
        const stats = page.locator('[data-count]');
        // asserção, não skip: se os contadores sumirem, o teste precisa acusar
        expect(await stats.count(), 'os contadores sumiram da página').toBeGreaterThan(0);

        await rolarAte(page, '[data-count]');
        await page.waitForTimeout(2500);

        const textos = await stats.allTextContents();
        for (const t of textos) {
            expect(t).not.toContain('NaN');
            expect(t.trim()).not.toBe('');
        }
    });

    /* Os vídeos ficam dentro do .vmarquee, que tem animação infinita: nenhuma
       ação do Playwright que exija elemento "estável" funciona neles. Por isso a
       rolagem é feita por evaluate, e as asserções olham atributo e erro. */
    test('os vídeos da faixa "no mundo real" não estouram erro', async ({ page }) => {
        const erros = [];
        page.on('pageerror', (e) => erros.push(String(e)));

        const videos = page.locator('video');
        expect(await videos.count(), 'a faixa de vídeos sumiu da página').toBeGreaterThan(0);

        await page.evaluate(() => {
            document.querySelector('.vmarquee')?.scrollIntoView({ block: 'center' });
        });
        await page.waitForTimeout(2000);

        // o autoplay pode ser recusado pelo browser; o .catch do site trata isso
        expect(erros, 'o play() recusado virou erro de página').toEqual([]);
        expect(await videos.first().getAttribute('src')).toBeTruthy();
        expect(await videos.first().getAttribute('poster'), 'sem poster o quadro fica preto')
            .toBeTruthy();
    });

    test('o carrossel de depoimentos troca no clique do quoteNav', async ({ page }) => {
        const nav = page.locator('#quoteNav .qdot');
        expect(await nav.count(), 'o carrossel de depoimentos sumiu da página').toBeGreaterThan(1);

        await rolarAte(page, '#quoteNav');
        await nav.nth(1).click();

        // o estado ativo é .is-on + aria-pressed, não .active
        await expect(nav.nth(1)).toHaveClass(/is-on/);
        await expect(nav.nth(1)).toHaveAttribute('aria-pressed', 'true');
        await expect(nav.nth(0)).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('.quote.is-on, .gallery-quote .is-on').first()).toBeVisible();
    });

    test('o CTA final tem a frase da task 18', async ({ page }) => {
        const cta = page.locator('.cta-final h2');
        expect((await cta.textContent()).replace(/\s+/g, ' '))
            .toContain('pronto para o novo modo de projetar');

        const html = await page.content();
        expect(html).not.toContain('pronto para implementar BIM');
    });
});
