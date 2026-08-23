/* Task 19 §05 — utilidades do E2E.
 *
 * Dois modos, um código: por padrão o POST é interceptado e nada toca em
 * produção; nos specs marcados @live a rede é real.
 */
import { expect } from '@playwright/test';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const PAGINAS = ['index.html', 'cadastro.html', 'lista-espera.html', 'produtos.html'];
export const PAGINAS_COM_FORMULARIO = ['cadastro.html', 'lista-espera.html'];

const RAIZ = new URL('../../../', import.meta.url);
export const lerArquivo = (p) => readFileSync(new URL(p, RAIZ), 'utf8');

export function endpointDeProducao() {
    const config = lerArquivo('js/config.js');
    const url = config.match(/ENDPOINT_URL:\s*'([^']+)'/)?.[1];
    if (!url) throw new Error('ENDPOINT_URL não encontrado em js/config.js');
    return url;
}

/* ============================================================
 *  Interceptação do envio (modo padrão)
 * ============================================================ */
export const ROTA_ENVIO = '**/macros/s/**';

/** Responde o POST sem sair da máquina. Devolve os payloads capturados. */
export async function interceptarEnvio(page, resposta = { success: true, protocolo: 'OR-2026-9999' }) {
    const capturados = [];
    await page.route(ROTA_ENVIO, async (route) => {
        capturados.push(JSON.parse(route.request().postData() || '{}'));
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(typeof resposta === 'function' ? resposta() : resposta)
        });
    });
    return capturados;
}

/** Deixa o POST falhar como se não houvesse rede. */
export async function derrubarRede(page) {
    await page.route(ROTA_ENVIO, (route) => route.abort('failed'));
}

/** Serve js/config.js com 404, para exercitar a guarda de configuração. */
export async function esconderConfig(page) {
    await page.route('**/js/config.js', (route) => route.fulfill({ status: 404, body: '' }));
}

/* ============================================================
 *  Dados marcados (rodada @live)
 * ============================================================ */

/* E-mail único por envio: resolve o rate limit (3 por 5 min) e deixa toda linha
   de teste localizável. Precisa ser uma caixa que existe de verdade — o item
   "e-mail recebido" do DoD depende disso. O domínio modobim.com.br serve o site
   pelo GitHub Pages e não tem caixa. */
export const CAIXA_QA = process.env.MODOBIM_QA_EMAIL || 'jhonymarlon@gmail.com';

export function emailDeTeste(prefixo) {
    const [usuario, dominio] = CAIXA_QA.split('@');
    return `${usuario}+qa-${prefixo}-${Date.now()}@${dominio}`;
}

export const MARCA = '[TESTE AUTOMATIZADO]';

export function dadosProposta({ live = false } = {}) {
    return {
        nomeCompleto: live ? `${MARCA} Fulana QA` : 'Fulana de Teste',
        empresa: live ? `${MARCA} Escritório QA` : 'Escritório Teste',
        email: live ? emailDeTeste('or') : 'fulana@teste.com.br',
        telefone: '91988887777',
        produtosServicos: 'Projetos residenciais e comerciais',
        gargalo: 'Retrabalho entre disciplinas',
        objetivoBIM: 'Compatibilizar antes da obra',
        qtdPessoas: '5',
        observacoes: live ? `${MARCA} rodada @live da task 19` : 'Sem restrição de agenda.'
    };
}

export function dadosListaEspera({ live = false } = {}) {
    return {
        nomeCompleto: live ? `${MARCA} Ciclana QA` : 'Ciclana de Teste',
        email: live ? emailDeTeste('le') : 'ciclana@teste.com.br',
        telefone: '9132221111',
        cidade: 'Belém',
        estado: 'PA',
        empresa: live ? `${MARCA} Autônoma QA` : 'Autônoma',
        cargo: 'Arquiteta',
        softwareAtual: 'AutoCAD',
        nivelBIM: 'Iniciante',
        objetivo: 'Sair do CAD',
        comoConheceu: 'Instagram'
    };
}

/* ============================================================
 *  Registro de faxina
 * ============================================================ */
const ARQUIVO_ENVIADOS = new URL('test-results/enviados.json', RAIZ);

/** Guarda protocolo, e-mail e horário de cada envio real, para apagar depois. */
export function registrarEnvio(registro) {
    const caminho = ARQUIVO_ENVIADOS.pathname.replace(/^\//, '');
    mkdirSync(dirname(caminho), { recursive: true });
    let atual = [];
    try { atual = JSON.parse(readFileSync(caminho, 'utf8')); } catch { /* primeiro envio */ }
    atual.push({ ...registro, quando: new Date().toISOString() });
    writeFileSync(caminho, JSON.stringify(atual, null, 2), 'utf8');
    return caminho;
}

/* ============================================================
 *  Navegação dos formulários
 * ============================================================ */

/* Sai do campo antes de clicar em qualquer outra coisa.
 *
 * O validador visual roda no `blur` e, quando o valor é inválido, revela a
 * mensagem de erro — que EMPURRA em ~12px tudo que está abaixo. Um clique feito
 * na sequência tem o mousedown num lugar e o mouseup em outro, e se perde.
 * Blur explícito aqui deixa isso determinístico; o efeito em si está descrito e
 * coberto em cadastro.spec.js ("o primeiro clique depois de um valor inválido"). */
export async function sairDoCampo(page) {
    await page.evaluate(() => document.activeElement?.blur?.());
}

export async function preencherCampos(page, valores) {
    for (const [nome, valor] of Object.entries(valores)) {
        const campo = page.locator(`[name="${nome}"]`);
        if (await campo.evaluate((el) => el.tagName === 'SELECT')) {
            await campo.selectOption(valor);
        } else {
            await campo.fill('');
            await campo.type(valor, { delay: 0 });
        }
    }
    await sairDoCampo(page);
}

export async function marcarPilulas(page, grupo, valores) {
    for (const valor of valores) {
        await page.locator(`[data-pill-group="${grupo}"] .pill`, { hasText: new RegExp(`^${valor}`) })
            .first().click();
    }
}

/* showStage() foca o primeiro campo da etapa com `setTimeout(..., 400)`, para
 * esperar a transição. Quem digita antes disso perde as teclas: o foco atrasado
 * chega no meio e leva o resto do texto para o primeiro campo. Uma pessoa
 * dificilmente ganha essa corrida; um teste ganha sempre. Daí a espera. */
export async function esperarFocoDaEtapa(page) {
    await page.waitForFunction(() => {
        const ativa = document.querySelector('.stage.active');
        return ativa && (ativa.contains(document.activeElement)
            || !ativa.querySelector('input:not([type="hidden"]):not(.honeypot), select, textarea'));
    }, null, { timeout: 3000 }).catch(() => { /* etapa sem campo: segue */ });
}

export async function comecar(page) {
    await page.locator('#startBtn').click();
    await esperarFocoDaEtapa(page);
}

export async function avancar(page) {
    await page.locator('.stage.active [data-next]').click();
    await esperarFocoDaEtapa(page);
}

export async function voltar(page) {
    await page.locator('.stage.active [data-back]').click();
    await esperarFocoDaEtapa(page);
}

export async function etapaAtiva(page) {
    return page.locator('.stage.active').getAttribute('id');
}

/* A faixa "no mundo real" (.vmarquee-track) tem animação infinita. O Playwright
 * só clica num elemento depois de ele ficar "estável" por dois quadros, e no
 * WebKit essa animação contínua faz qualquer clique na página esperar até o
 * timeout. Pausar só ela deixa o resto da página intacto — nada do que os testes
 * afirmam depende desse deslize decorativo. */
export async function pausarFaixaAnimada(page) {
    await page.addStyleTag({
        content: '.vmarquee-track { animation-play-state: paused !important; }'
    });
}

/** Rola até o elemento sem exigir estabilidade (útil perto de áreas animadas). */
export async function rolarAte(page, seletor) {
    await page.evaluate((s) => {
        document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' });
    }, seletor);
    await page.waitForTimeout(250);
}

/** Zero erro no console e zero resposta >= 400 — o item 3 do smoke. */
export function vigiarPagina(page, { ignorar = [] } = {}) {
    const erros = [];
    const respostasRuins = [];

    page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const texto = msg.text();
        if (ignorar.some((re) => re.test(texto))) return;
        erros.push(texto);
    });
    page.on('pageerror', (err) => erros.push(String(err)));
    page.on('response', (res) => {
        if (res.status() >= 400 && !ignorar.some((re) => re.test(res.url()))) {
            respostasRuins.push(`${res.status()} ${res.url()}`);
        }
    });

    return {
        erros,
        respostasRuins,
        conferir() {
            expect(erros, 'erros de console').toEqual([]);
            expect(respostasRuins, 'respostas >= 400').toEqual([]);
        }
    };
}
