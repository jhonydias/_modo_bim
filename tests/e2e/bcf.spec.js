/* Task 24 — bcf-para-pdf.html, o conversor gratuito que capta o lead.
 *
 * O que travar:
 *   1. clicar em gerar NUNCA baixa o arquivo — pede o e-mail;
 *   2. o que vai para o backend é um PDF de verdade, com o e-mail e o tipo certos;
 *   3. cada resposta do backend vira a tela certa (enviado / plano B / erro);
 *   4. a página está no padrão do site e não puxa nada de terceiro.
 *
 * O POST é sempre interceptado (interceptarEnvio): nada aqui toca em produção.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { interceptarEnvio, derrubarRede, lerArquivo } from './helpers/suite.js';

const CEREJA = 'rgb(129, 22, 30)';
const fixture = (nome) => fileURLToPath(new URL(`../fixtures/bcf/${nome}`, import.meta.url));

async function carregarBcf(page, nome = 'exemplo.bcfzip') {
    await page.locator('#conversor').scrollIntoViewIfNeeded();
    await page.locator('#file').setInputFiles(fixture(nome));
}

async function abrirEtapaEmail(page) {
    await carregarBcf(page);
    await expect(page.locator('#list .row')).toHaveCount(3);
    await page.locator('#go').click();
    await expect(page.locator('#passoEmail')).toBeVisible();
}

/** Registra todo download que a página tentar fazer. */
function vigiarDownloads(page) {
    const baixados = [];
    page.on('download', (d) => baixados.push(d));
    return baixados;
}

test.beforeEach(async ({ page }) => { await page.goto('/bcf-para-pdf.html'); });

test('lê o BCF no navegador e lista as issues com miniatura em JPEG', async ({ page }) => {
    await carregarBcf(page);

    await expect(page.locator('#list .row')).toHaveCount(3);
    await expect(page.locator('#status')).toContainText('3 issues encontradas');
    await expect(page.locator('#rproj')).toHaveValue('Residencial Exemplo');
    await expect(page.locator('#contagem')).toHaveText('· 3 de 3');

    // ordenadas pelo Index do BCF
    await expect(page.locator('#list .row .t').first()).toContainText('#1');
    await expect(page.locator('#list .row .t').first()).toContainText('Viga V12');

    // dois snapshots, os dois reencodados em JPEG (o PNG cru estourava o anexo)
    const srcs = await page.$$eval('#list img.thumb', (imgs) => imgs.map((i) => i.src.slice(0, 23)));
    expect(srcs).toEqual(['data:image/jpeg;base64,', 'data:image/jpeg;base64,']);
});

test('arquivo que não é BCF mostra erro e não abre o painel', async ({ page }) => {
    await carregarBcf(page, 'invalido.bcf');
    await expect(page.locator('#status')).toHaveClass(/err/);
    await expect(page.locator('#status')).toContainText('não parece ser um BCF');
    await expect(page.locator('#panel')).toBeHidden();
});

test('as bibliotecas são do site e só baixam quando a pessoa escolhe um arquivo', async ({ page }) => {
    const pedidos = [];
    page.on('request', (r) => pedidos.push(r.url()));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    expect(pedidos.filter((u) => u.includes('/js/vendor/')), 'baixou antes da hora').toEqual([]);

    await carregarBcf(page);
    await expect(page.locator('#list .row')).toHaveCount(3);

    expect(pedidos.filter((u) => u.includes('/js/vendor/')).length).toBe(2);
    const terceiros = pedidos.filter((u) => !u.startsWith('http://localhost:4173') && !u.startsWith('data:') && !u.startsWith('blob:'));
    expect(terceiros, 'requisição para fora do site').toEqual([]);
    expect(lerArquivo('bcf-para-pdf.html')).not.toMatch(/cdnjs|googleapis|claude\.use/);
});

test('clicar em gerar não baixa nada: pede o e-mail', async ({ page }) => {
    const baixados = vigiarDownloads(page);
    await abrirEtapaEmail(page);

    await expect(page.locator('#passoArquivo')).toBeHidden();
    await expect(page.locator('#resumo')).toHaveText('3 issues · Residencial Exemplo · exemplo.bcfzip');
    await expect(page.locator('#email')).toBeFocused();
    await page.waitForTimeout(500);
    expect(baixados).toHaveLength(0);
});

test('sem issue marcada, não avança', async ({ page }) => {
    await carregarBcf(page);
    await page.locator('#none').click();
    await expect(page.locator('#contagem')).toHaveText('· 0 de 3');
    await page.locator('#go').click();

    await expect(page.locator('#erroLista')).toHaveText('Marque ao menos uma issue.');
    await expect(page.locator('#passoEmail')).toBeHidden();
});

test('e-mail inválido não envia', async ({ page }) => {
    const enviados = await interceptarEnvio(page);
    await abrirEtapaEmail(page);

    await page.locator('#email').fill('fulana@semdominio');
    await page.locator('#enviar').click();

    await expect(page.locator('#campoEmail')).toHaveClass(/error/);
    await page.waitForTimeout(300);
    expect(enviados).toHaveLength(0);
});

test('envia um PDF de verdade com o e-mail e mostra o protocolo', async ({ page }) => {
    const baixados = vigiarDownloads(page);
    const enviados = await interceptarEnvio(page, { success: true, protocolo: 'BP-2026-0042', tipo: 'bcf-pdf' });

    await carregarBcf(page);
    await expect(page.locator('#list .row')).toHaveCount(3);
    await page.locator('#list .row input').nth(2).uncheck();   // a 3ª fica de fora
    await page.locator('#go').click();

    await page.locator('#email').fill('fulana@escritorio.com.br');
    await page.locator('#nome').fill('Fulana');
    await page.locator('#optin').check();
    await page.locator('#enviar').click();

    await expect(page.locator('#passoOk')).toBeVisible();
    await expect(page.locator('#okTitulo')).toHaveText('Enviado.');
    await expect(page.locator('#okProtocolo')).toHaveText('BP-2026-0042');
    await expect(page.locator('#okTexto')).toContainText('fulana@escritorio.com.br');
    await expect(page.locator('#baixar')).toBeHidden();

    expect(enviados).toHaveLength(1);
    const p = enviados[0];
    expect(p).toMatchObject({
        tipo: 'bcf-pdf',
        email: 'fulana@escritorio.com.br',
        nome: 'Fulana',
        optin: true,
        projeto: 'Residencial Exemplo',
        titulo: 'Relatório de issues',
        qtdIssues: '2',
        arquivoBcf: 'exemplo.bcfzip',
        pdfNome: 'Residencial_Exemplo_BCF.pdf'
    });
    expect(p).not.toHaveProperty('website_url');

    const pdf = Buffer.from(p.pdfBase64, 'base64');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);                // tem as imagens
    expect(pdf.length).toBeLessThan(15 * 1024 * 1024);
    // os snapshots entraram como JPEG (DCTDecode), não como PNG cru
    expect(pdf.toString('latin1')).toMatch(/\/DCTDecode/);

    expect(baixados).toHaveLength(0);
});

test('e-mail que não sai (ENVIO_FALHOU) oferece o download como plano B', async ({ page }) => {
    await interceptarEnvio(page, { success: false, code: 'ENVIO_FALHOU', protocolo: 'BP-2026-0043', error: 'Não conseguimos enviar o e-mail agora.' });
    await abrirEtapaEmail(page);
    await page.locator('#email').fill('fulana@escritorio.com.br');
    await page.locator('#enviar').click();

    await expect(page.locator('#okTitulo')).toHaveText('Quase lá.');
    await expect(page.locator('#okProtocolo')).toHaveText('BP-2026-0043');
    await expect(page.locator('#outro')).toBeHidden();

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#baixar').click()
    ]);
    expect(download.suggestedFilename()).toBe('Residencial_Exemplo_BCF.pdf');
});

test('recusa do servidor mostra o motivo e mantém o formulário', async ({ page }) => {
    await interceptarEnvio(page, { success: false, error: 'Dados inválidos', errors: ['E-mail inválido'] });
    await abrirEtapaEmail(page);
    await page.locator('#email').fill('fulana@escritorio.com.br');
    await page.locator('#enviar').click();

    await expect(page.locator('#erroEnvio')).toBeVisible();
    await expect(page.locator('#erroEnvio')).toHaveText('E-mail inválido');
    await expect(page.locator('#passoEmail')).toBeVisible();
    await expect(page.locator('#enviar')).toBeEnabled();
    await expect(page.locator('#email')).toHaveValue('fulana@escritorio.com.br');
});

test('rate limit do servidor aparece com a mensagem dele', async ({ page }) => {
    await interceptarEnvio(page, { success: false, error: 'Muitas tentativas. Aguarde alguns minutos.' });
    await abrirEtapaEmail(page);
    await page.locator('#email').fill('fulana@escritorio.com.br');
    await page.locator('#enviar').click();
    await expect(page.locator('#erroEnvio')).toHaveText('Muitas tentativas. Aguarde alguns minutos.');
});

test('sem rede, avisa e deixa tentar de novo', async ({ page }) => {
    await derrubarRede(page);
    await abrirEtapaEmail(page);
    await page.locator('#email').fill('fulana@escritorio.com.br');
    await page.locator('#enviar').click();

    await expect(page.locator('#erroEnvio')).toContainText('Verifique sua conexão');
    await expect(page.locator('#enviar')).toBeEnabled();
});

test('voltar da etapa de e-mail preserva a seleção', async ({ page }) => {
    await carregarBcf(page);
    await page.locator('#list .row input').nth(0).uncheck();
    await page.locator('#go').click();
    await expect(page.locator('#resumo')).toContainText('2 issues');

    await page.locator('#voltar').click();
    await expect(page.locator('#passoArquivo')).toBeVisible();
    await expect(page.locator('#contagem')).toHaveText('· 2 de 3');
    await expect(page.locator('#list .row input').nth(0)).not.toBeChecked();
});

test('converter outro arquivo volta ao início e guarda o e-mail', async ({ page }) => {
    await interceptarEnvio(page, { success: true, protocolo: 'BP-2026-0044' });
    await abrirEtapaEmail(page);
    await page.locator('#email').fill('fulana@escritorio.com.br');
    await page.locator('#enviar').click();
    await expect(page.locator('#passoOk')).toBeVisible();

    await page.locator('#outro').click();
    await expect(page.locator('#passoArquivo')).toBeVisible();
    await expect(page.locator('#panel')).toBeHidden();

    await carregarBcf(page);
    await expect(page.locator('#list .row')).toHaveCount(3);
    await page.locator('#go').click();
    await expect(page.locator('#email')).toHaveValue('fulana@escritorio.com.br');
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
            botao: cs('#go').fontFamily,
            ctaFinal: cs('.cta-final').backgroundColor
        };
    });
    expect(estilo.h1Fonte).toMatch(/^"?Sentient/);
    expect(estilo.h1Cor).toBe(CEREJA);
    expect(estilo.corpoFonte).toMatch(/^"?Inter/);
    expect(estilo.fundo).toBe('rgb(239, 238, 233)');
    expect(estilo.texto).toBe('rgb(76, 79, 55)');
    expect(estilo.label).toMatch(/Neue Haas Grotesk/);
    expect(estilo.botao).toMatch(/Neue Haas Grotesk/);
    expect(estilo.ctaFinal).toBe(CEREJA);

    // nada do sistema visual que chegou no commit 11ba6fc
    const html = lerArquivo('bcf-para-pdf.html');
    expect(html).not.toMatch(/Newsreader|Work Sans|#6B1F2A|prefers-color-scheme/i);
});

test('o cartão do e-mail é cereja, com o pattern brilhando', async ({ page }) => {
    await abrirEtapaEmail(page);
    const cartao = page.locator('#passoEmail');
    expect(await cartao.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(CEREJA);

    const pats = page.locator('#passoEmail .modo-tex, .cta-final .modo-tex');
    await expect(pats).toHaveCount(3);
    for (const p of await pats.all()) {
        expect(await p.evaluate((el) => getComputedStyle(el).animationName)).toBe('patShimmer');
    }
});

test('o acordeão abre uma dúvida por vez', async ({ page }) => {
    const qs = page.locator('.faq-q');
    await qs.nth(0).scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);

    await qs.nth(0).click();
    await expect(qs.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await qs.nth(1).click();
    await expect(qs.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(qs.nth(0)).toHaveAttribute('aria-expanded', 'false');
});
