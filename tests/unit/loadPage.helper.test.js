/* Regressão da task 21 — o loadPage precisa ignorar <script> que não é JavaScript.
 *
 * O que aconteceu: a task 21 acrescentou blocos <script type="application/ld+json">
 * (Organization, WebSite, FAQPage, WebPage) em index, cadastro, lista-espera e
 * produtos. O helper coletava `script:not([src])` — TODO script inline — e passava
 * a concatenação para um eval. JSON avaliado como JavaScript morre no primeiro `:`
 * do objeto, e 134 dos 259 testes quebraram de uma vez com
 * `SyntaxError: Unexpected token ':'`.
 *
 * O helper estava errado, não o site: pelo HTML Standard, um <script> com type que
 * não é de JavaScript é um *data block* e o navegador nunca o executa. Estes testes
 * travam esse comportamento — se alguém remover o filtro, quebram aqui, com o motivo
 * escrito, em vez de espalhar SyntaxError por metade da suíte.
 */
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadPage, lerArquivo } from './helpers/loadPage.js';

const CONFIG_OK = { ENDPOINT_URL: 'https://script.google.com/macros/s/AKfycfake/exec', DEV_MODE: false };

/** Páginas do site que hoje têm pelo menos um bloco de dados no <head>. */
const COM_LD_JSON = ['index.html', 'cadastro.html', 'lista-espera.html', 'produtos.html'];

describe('loadPage e os <script> que não são JavaScript', () => {
    it.each(COM_LD_JSON)('%s realmente tem JSON-LD (senão este teste não prova nada)', (arquivo) => {
        const dom = new JSDOM(lerArquivo(arquivo));
        const blocos = dom.window.document.querySelectorAll('script[type="application/ld+json"]');
        expect(blocos.length).toBeGreaterThan(0);
        // e o conteúdo é JSON válido, não JavaScript
        for (const b of blocos) expect(() => JSON.parse(b.textContent)).not.toThrow();
        dom.window.close();
    });

    it.each(COM_LD_JSON)('%s carrega no jsdom sem SyntaxError', (arquivo) => {
        const pagina = loadPage(arquivo, { config: CONFIG_OK });
        // se o JSON-LD tivesse entrado no eval, loadPage teria lançado antes daqui
        expect(pagina.document.querySelector('body')).toBeTruthy();
        pagina.fechar();
    });

    it('o JS da página é avaliado de verdade — não basta não lançar', () => {
        const pagina = loadPage('cadastro.html', { config: CONFIG_OK });
        // showStage é uma `function` declarada no topo do script inline: só existe
        // em window se o eval do inline tiver rodado.
        expect(typeof pagina.window.showStage).toBe('function');
        expect(pagina.evalIn('ENDPOINT_URL')).toBe(CONFIG_OK.ENDPOINT_URL);
        pagina.fechar();
    });

    it('um data block novo em qualquer type não derruba o carregamento', () => {
        /* Cobre o caso geral, não só ld+json: importmap, speculationrules e
           text/template são todos data blocks e podem aparecer amanhã. */
        const html = lerArquivo('contrato.html').replace(
            '</head>',
            `<script type="importmap">{ "imports": { "a": "./a.js" } }</script>
             <script type="speculationrules">{ "prerender": [{ "urls": ["/x"] }] }</script>
             <script type="text/template"><div>{{ isto não é JS }}</div></script>
             </head>`
        );
        // loadPage lê do disco, então aqui o teste é do filtro em si
        const dom = new JSDOM(html);
        const executaveis = [...dom.window.document.querySelectorAll('script:not([src])')]
            .filter((s) => {
                const t = (s.getAttribute('type') || '').toLowerCase().trim();
                return ['', 'module', 'text/javascript', 'application/javascript'].includes(t);
            });
        expect(executaveis).toHaveLength(1);
        expect(() => new Function(executaveis[0].textContent)).not.toThrow();
        dom.window.close();
    });
});
