/* Task 19 §3.4 — o submit do cadastro.html, com fetch mockado.
 *
 * As duas linhas mais importantes daqui são as de configuração: config ausente e
 * DEV_MODE. Foi o buraco que a task 20 quase abriu — tela de sucesso, protocolo
 * fictício e nada salvo.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadPage, proximaVolta } from './helpers/loadPage.js';
import { preencherAte, clicar, campo, etapaAtiva } from './helpers/formulario.js';
import { ETAPAS_CADASTRO, PILULAS_CADASTRO } from './helpers/fixtures.js';

const ENDPOINT_FAKE = 'https://script.google.com/macros/s/AKfycfake/exec';

let paginaAberta;
afterEach(() => paginaAberta?.fechar());

/** Abre a página, preenche as 4 etapas e devolve tudo pronto para o clique de envio. */
function preparar({ config = { ENDPOINT_URL: ENDPOINT_FAKE, DEV_MODE: false }, pilulas = PILULAS_CADASTRO } = {}) {
    const pagina = loadPage('cadastro.html', { config });
    paginaAberta = pagina;
    preencherAte(pagina, { etapas: ETAPAS_CADASTRO, pilulas, ultima: 4 });
    return pagina;
}

function responder(pagina, corpo, { ok = true } = {}) {
    pagina.window.fetch = vi.fn(async () => ({ ok, json: async () => corpo }));
    return pagina.window.fetch;
}

async function enviar(pagina) {
    clicar(pagina, '#submitBtn');
    await proximaVolta(pagina.window, 6);
}

const banner = (pagina) => pagina.document.getElementById('error-4');
const protocolo = (pagina) => pagina.document.getElementById('protocolNumber').textContent;

describe('envio bem-sucedido', () => {
    it('mostra o protocolo devolvido pelo servidor e vai para a tela de sucesso', async () => {
        const pagina = preparar();
        responder(pagina, { success: true, protocolo: 'OR-2026-0007' });
        await enviar(pagina);

        expect(protocolo(pagina)).toBe('OR-2026-0007');
        expect(etapaAtiva(pagina)).toBe('stage-success');
    });

    it('sem protocolo na resposta, usa o fallback OR-2026-0001', async () => {
        const pagina = preparar();
        responder(pagina, { success: true });
        await enviar(pagina);
        expect(protocolo(pagina)).toBe('OR-2026-0001');
    });

    it('posta no ENDPOINT_URL da configuração, como texto simples', async () => {
        const pagina = preparar();
        const fetch = responder(pagina, { success: true, protocolo: 'OR-2026-0002' });
        await enviar(pagina);

        const [url, opcoes] = fetch.mock.calls[0];
        expect(url).toBe(ENDPOINT_FAKE);
        expect(opcoes.method).toBe('POST');
        expect(opcoes.headers['Content-Type']).toBe('text/plain;charset=utf-8');
    });

    it('o payload leva tipo, timestamp ISO e userAgent, e não leva o honeypot', async () => {
        const pagina = preparar();
        const fetch = responder(pagina, { success: true, protocolo: 'OR-2026-0003' });
        await enviar(pagina);

        const payload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(payload.tipo).toBe('orcamento');
        expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
        expect(payload.userAgent).toBeTruthy();
        expect(payload).not.toHaveProperty('website_url');
        expect(payload.nomeCompleto).toBe(ETAPAS_CADASTRO[1].nomeCompleto);
    });

    it('"Outro" vira o texto digitado e a chave softwareOutro some do payload', async () => {
        const pagina = preparar({ pilulas: { 3: { softwareInteresse: ['Revit', 'Outro'], nivelEquipe: ['Equipe mista'] } } });
        campo(pagina, 'softwareOutro').value = 'Solibri';
        pagina.window.saveStepData(3);

        const fetch = responder(pagina, { success: true, protocolo: 'OR-2026-0004' });
        await enviar(pagina);

        const payload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(payload.softwareInteresse).toBe('Revit, Solibri');
        expect(payload).not.toHaveProperty('softwareOutro');
    });

    it('a classe submitting é removida no finally', async () => {
        const pagina = preparar();
        responder(pagina, { success: true, protocolo: 'OR-2026-0005' });
        await enviar(pagina);
        expect(pagina.document.querySelector('.app').classList.contains('submitting')).toBe(false);
    });
});

describe('recusa do servidor', () => {
    it('mostra os motivos reais de errors[] separados por · e fica na etapa 4', async () => {
        const pagina = preparar();
        responder(pagina, {
            success: false,
            error: 'Dados inválidos',
            errors: ['Nome completo é obrigatório', 'E-mail inválido']
        });
        await enviar(pagina);

        expect(banner(pagina).textContent).toBe('Nome completo é obrigatório · E-mail inválido');
        expect(banner(pagina).classList.contains('visible')).toBe(true);
        expect(etapaAtiva(pagina)).toBe('stage-4');
    });

    it('sem errors[], mostra o error', async () => {
        const pagina = preparar();
        responder(pagina, { success: false, error: 'Muitas tentativas. Aguarde alguns minutos.' });
        await enviar(pagina);
        expect(banner(pagina).textContent).toBe('Muitas tentativas. Aguarde alguns minutos.');
    });

    it('sem nada, mostra "Envio recusado pelo servidor"', async () => {
        const pagina = preparar();
        responder(pagina, { success: false });
        await enviar(pagina);
        expect(banner(pagina).textContent).toBe('Envio recusado pelo servidor');
    });

    it('não perde o que foi digitado', async () => {
        const pagina = preparar();
        responder(pagina, { success: false, errors: ['qualquer coisa'] });
        await enviar(pagina);
        expect(campo(pagina, 'observacoes').value).toBe(ETAPAS_CADASTRO[4].observacoes);
    });

    it('remove submitting mesmo em erro', async () => {
        const pagina = preparar();
        responder(pagina, { success: false });
        await enviar(pagina);
        expect(pagina.document.querySelector('.app').classList.contains('submitting')).toBe(false);
    });
});

describe('falha de rede', () => {
    it('mostra a mensagem genérica de conexão, não a do servidor', async () => {
        const pagina = preparar();
        pagina.window.fetch = vi.fn(async () => { throw new Error('Failed to fetch'); });
        await enviar(pagina);

        expect(banner(pagina).textContent).toBe('Erro ao enviar. Verifique sua conexão e tente novamente.');
        expect(etapaAtiva(pagina)).toBe('stage-4');
    });
});

/* Estas duas são a razão de este arquivo existir. */
describe('configuração ausente (js/config.js com 404)', () => {
    it('não chama fetch, não mostra sucesso e explica o motivo real', async () => {
        const pagina = preparar({ config: null });
        const fetch = vi.fn();
        pagina.window.fetch = fetch;
        await enviar(pagina);

        expect(fetch).not.toHaveBeenCalled();
        expect(etapaAtiva(pagina)).toBe('stage-4');
        expect(banner(pagina).textContent)
            .toBe('Configuração do site não carregou. Recarregue a página e tente de novo.');
    });

    it('o protocolo não vira OR-2026-DEV', async () => {
        const pagina = preparar({ config: null });
        pagina.window.fetch = vi.fn();
        await enviar(pagina);
        expect(protocolo(pagina)).not.toBe('OR-2026-DEV');
    });
});

describe('DEV_MODE ligado de propósito', () => {
    it('não chama fetch e mostra o protocolo fictício', async () => {
        const pagina = preparar({ config: { ENDPOINT_URL: '', DEV_MODE: true } });
        const fetch = vi.fn();
        pagina.window.fetch = fetch;
        clicar(pagina, '#submitBtn');
        await proximaVolta(pagina.window, 4);
        await new Promise((r) => pagina.window.setTimeout(r, 900)); // o ramo dev espera 800ms

        expect(fetch).not.toHaveBeenCalled();
        expect(protocolo(pagina)).toBe('OR-2026-DEV');
        expect(etapaAtiva(pagina)).toBe('stage-success');
    });
});

describe('honeypot', () => {
    it('preenchido, nem chama fetch nem avança', async () => {
        const pagina = preparar();
        const fetch = vi.fn();
        pagina.window.fetch = fetch;
        campo(pagina, 'website_url').value = 'http://spam.example';
        await enviar(pagina);

        expect(fetch).not.toHaveBeenCalled();
        expect(etapaAtiva(pagina)).toBe('stage-4');
    });
});
