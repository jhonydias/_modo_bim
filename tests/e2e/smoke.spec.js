/* Task 19 §5.3 — o portão. Roda primeiro e pega, em minutos, página quebrada,
 * 404, erro silencioso de JS e config ausente.
 *
 * Só o item 1 (GET no endpoint) toca a rede de produção, e é leitura pura:
 * doGet não grava nada. Por isso o arquivo inteiro roda em npm test.
 */
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import {
    PAGINAS, PAGINAS_COM_FORMULARIO, endpointDeProducao, lerArquivo, vigiarPagina
} from './helpers/suite.js';

const RAIZ = new URL('../../', import.meta.url);
const arquivoExiste = (nome) => existsSync(new URL(nome, RAIZ));

/* Fontes externas (Google Fonts, Fontshare) saem do nosso controle e caem em
   ambiente sem rede; não são sinal de regressão do site. */
const RUIDO_EXTERNO = [/fonts\.googleapis|fonts\.gstatic|api\.fontshare/];

test('1 · o endpoint de produção responde status ok com os 3 formulários', async ({ request }) => {
    const res = await request.get(endpointDeProducao());
    expect(res.status()).toBe(200);

    const corpo = await res.json();
    expect(corpo.status).toBe('ok');
    expect(corpo.forms).toEqual(['orcamento', 'cadastro', 'lista-espera']);
});

for (const pagina of PAGINAS) {
    test(`2-3 · ${pagina} carrega em 200, sem erro de console e sem resposta >= 400`, async ({ page }) => {
        const vigia = vigiarPagina(page, { ignorar: RUIDO_EXTERNO });

        const res = await page.goto('/' + pagina, { waitUntil: 'load' });
        expect(res.status()).toBe(200);
        await page.waitForTimeout(400); // deixa os observers e o autoplay reagirem

        vigia.conferir();
    });

    test(`4 · ${pagina} não tem link interno quebrado`, async ({ page }) => {
        await page.goto('/' + pagina);
        const internos = await page.$$eval('a[href]', (as) =>
            as.map((a) => a.getAttribute('href'))
                .filter((h) => h && !/^(https?:|mailto:|tel:|#)/.test(h)));

        for (const href of new Set(internos)) {
            const arquivo = href.split('#')[0].split('?')[0];
            expect(arquivoExiste(arquivo), `${pagina} aponta para ${arquivo}, que não existe`).toBe(true);
        }
    });

    test(`4b · ${pagina} abre todo link externo em nova aba com rel=noopener`, async ({ page }) => {
        await page.goto('/' + pagina);
        const externos = await page.$$eval('a[href^="http"]', (as) =>
            as.filter((a) => !/fonts\.googleapis|fonts\.gstatic|api\.fontshare/.test(a.href))
                .map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })));

        for (const link of externos) {
            expect(link.target, link.href).toBe('_blank');
            expect(link.rel ?? '', link.href).toContain('noopener');
        }
    });

    test(`5 · ${pagina} resolve todas as imagens e vídeos`, async ({ page }) => {
        const quebrados = [];
        page.on('response', (res) => {
            if (res.status() >= 400 && /\/img\//.test(res.url())) quebrados.push(res.url());
        });

        await page.goto('/' + pagina, { waitUntil: 'load' });
        // as imagens abaixo da dobra têm loading="lazy": rolar até o fim as força
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(800);

        /* Desde a task 21 o site usa <picture>. Dentro dele o <source> declara a
           mídia em `srcset` — `src` ali não é só desnecessário, é proibido pela
           especificação, e o validador do W3C reprova. Por isso a checagem é
           "tem fonte declarada", não "tem atributo src". */
        const semFonte = await page.$$eval('img, video, source', (els) =>
            els.filter((el) => !el.getAttribute('src') && !el.getAttribute('srcset'))
                .map((el) => el.tagName.toLowerCase() + (el.className ? '.' + el.className : '')));

        /* E o inverso, para o filtro acima não virar frouxidão: quem está dentro
           de <picture> tem de usar srcset e NÃO src; <img> e <video> continuam
           obrigados a ter src. */
        const fonteErrada = await page.$$eval('img, video, source', (els) => {
            const erros = [];
            for (const el of els) {
                const dentroDePicture = el.parentElement?.tagName === 'PICTURE';
                if (el.tagName === 'SOURCE' && dentroDePicture) {
                    if (!el.getAttribute('srcset')) erros.push('<source> em <picture> sem srcset');
                    if (el.getAttribute('src')) erros.push('<source> em <picture> com src (proibido pela spec)');
                } else if (el.tagName !== 'SOURCE' && !el.getAttribute('src') && !el.getAttribute('srcset')) {
                    erros.push(`<${el.tagName.toLowerCase()}> sem src`);
                }
            }
            return erros;
        });

        expect(quebrados, 'mídias com 404').toEqual([]);
        expect(semFonte, 'mídias sem src nem srcset').toEqual([]);
        expect(fonteErrada, 'mídias com o atributo de fonte errado').toEqual([]);
    });
}

/* Itens 6 e 7 — substituem o antigo "os 3 ENDPOINT_URL são iguais". Com o
   endpoint em arquivo único, o risco deixou de ser divergência e passou a ser
   ausência: config.js que não carrega derruba os três formulários de uma vez. */
for (const pagina of PAGINAS_COM_FORMULARIO.concat('contrato.html')) {
    test(`6 · ${pagina} carrega js/config.js com 200 e DEV_MODE desligado`, async ({ page }) => {
        const respostas = [];
        page.on('response', (res) => {
            if (res.url().endsWith('/js/config.js')) respostas.push(res.status());
        });

        await page.goto('/' + pagina, { waitUntil: 'load' });

        expect(respostas, 'js/config.js não foi requisitado').not.toEqual([]);
        expect(respostas.every((s) => s === 200)).toBe(true);

        const config = await page.evaluate(() => window.MODOBIM_CONFIG);
        expect(config, 'MODOBIM_CONFIG não existe no browser').toBeTruthy();
        expect(config.DEV_MODE, 'DEV_MODE ligado em produção').toBe(false);
        expect(config.ENDPOINT_URL).toBe(endpointDeProducao());
    });

    test(`7 · ${pagina} carrega js/config.js antes do script inline`, async ({ page }) => {
        await page.goto('/' + pagina);
        const html = lerArquivo(pagina);
        expect(html.indexOf('<script src="js/config.js">'))
            .toBeLessThan(html.indexOf('const CONFIG = window.MODOBIM_CONFIG'));

        // e o efeito prático: o endpoint chegou ao escopo do formulário
        const temEndpoint = await page.evaluate(() =>
            Boolean(window.MODOBIM_CONFIG && window.MODOBIM_CONFIG.ENDPOINT_URL));
        expect(temEndpoint).toBe(true);
    });
}

/* Item 8 — regressão do commit e291735: a logo era href="#" com um handler que
   dava preventDefault; não saía da página. */
for (const pagina of PAGINAS_COM_FORMULARIO) {
    test(`8 · ${pagina}: a logo do topo navega para a home`, async ({ page }) => {
        await page.goto('/' + pagina);
        await page.locator('#startBtn').click();
        await expect(page.locator('#stage-1')).toHaveClass(/active/);

        await page.locator('#wordmark').click();
        await page.waitForURL('**/index.html');
        expect(new URL(page.url()).pathname).toBe('/index.html');
    });
}
