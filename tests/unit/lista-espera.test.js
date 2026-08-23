/* Task 19 §3.5 — lista-espera.html: 3 etapas, protocolo LE, bimclub obrigatório.
 *
 * A estrutura é a mesma do cadastro.html, então aqui ficam só as diferenças e o
 * caminho completo de envio — o que é idêntico já está coberto lá.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPage, proximaVolta } from './helpers/loadPage.js';
import {
    preencher, clicarPilulas, clicar, avancar, etapaAtiva, campo,
    bannerVisivel, camposComErro, preencherAte, digitar
} from './helpers/formulario.js';
import {
    ETAPAS_LISTA_ESPERA, PILULAS_LISTA_ESPERA,
    EMAILS_INVALIDOS, TELEFONES_VALIDOS
} from './helpers/fixtures.js';

const ENDPOINT_FAKE = 'https://script.google.com/macros/s/AKfycfake/exec';
const CONFIG_OK = { ENDPOINT_URL: ENDPOINT_FAKE, DEV_MODE: false };

let pagina;
afterEach(() => pagina?.fechar());

describe('estrutura', () => {
    beforeEach(() => { pagina = loadPage('lista-espera.html'); });

    it('tem 3 etapas', () => {
        expect(pagina.evalIn('totalSteps')).toBe(3);
        expect(pagina.evalIn('FORM_TYPE')).toBe('lista-espera');
    });

    it('vai da capa até a tela de sucesso', () => {
        ['stage-cover', 'stage-1', 'stage-2', 'stage-3', 'stage-success'].forEach((id, i) => {
            pagina.window.showStage(i);
            expect(etapaAtiva(pagina)).toBe(id);
        });
    });

    it('não tem os validadores exclusivos do orçamento', () => {
        expect(pagina.window.validarQuantidade).toBeUndefined();
        expect(pagina.window.validarDataFutura).toBeUndefined();
    });

    it('a máscara de telefone é a mesma', () => {
        expect(digitar(pagina, 'telefone', '9132221111')).toBe(TELEFONES_VALIDOS[1]);
    });

    it('a logo do topo leva para a home, sem handler de clique', () => {
        const logo = pagina.document.getElementById('wordmark');
        expect(logo.getAttribute('href')).toBe('index.html');
        const evento = new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true });
        logo.dispatchEvent(evento);
        expect(evento.defaultPrevented).toBe(false);
    });
});

describe('validação por etapa', () => {
    beforeEach(() => { pagina = loadPage('lista-espera.html'); });

    it('etapa 1 vazia marca os cinco obrigatórios', () => {
        clicar(pagina, '#startBtn');
        expect(pagina.window.validateStep(1)).toBe(false);
        expect(bannerVisivel(pagina, 1)).toBe(true);
        expect(camposComErro(pagina, 1).map((c) => c.nome).sort())
            .toEqual(['cidade', 'email', 'estado', 'nomeCompleto', 'telefone']);
    });

    it.each(EMAILS_INVALIDOS.filter(Boolean))('e-mail %j é recusado', (email) => {
        clicar(pagina, '#startBtn');
        preencher(pagina, { ...ETAPAS_LISTA_ESPERA[1], email });
        expect(pagina.window.validateStep(1)).toBe(false);
    });

    /* bimclub é obrigatório no backend (Code.gs) e no front só existe como
       pílula alimentando um hidden. Se o clique parar de escrever no hidden, o
       envio é recusado e nada no visual denuncia. */
    it('bimclub vazio reprova a etapa 3', () => {
        preencherAte(pagina, { etapas: ETAPAS_LISTA_ESPERA, ultima: 3 });
        clicarPilulas(pagina, 'softwareInteresse', ['Revit']);
        expect(pagina.window.validateStep(3)).toBe(false);
        expect(camposComErro(pagina, 3).map((c) => c.nome)).toContain('bimclub');
    });

    it('bimclub preenchido pela pílula libera a etapa 3', () => {
        preencherAte(pagina, { etapas: ETAPAS_LISTA_ESPERA, pilulas: PILULAS_LISTA_ESPERA, ultima: 3 });
        expect(campo(pagina, 'bimclub').value).toBe('Sim');
        expect(pagina.window.validateStep(3)).toBe(true);
    });

    it('softwareInteresse aqui é exclusivo e só tem Archicad e Revit', () => {
        const valores = [...pagina.document.querySelectorAll('[data-pill-group="softwareInteresse"] .pill')]
            .map((p) => p.dataset.value);
        expect(valores).toEqual(['Archicad', 'Revit']);

        preencherAte(pagina, { etapas: ETAPAS_LISTA_ESPERA, ultima: 3 });
        clicarPilulas(pagina, 'softwareInteresse', ['Archicad']);
        expect(clicarPilulas(pagina, 'softwareInteresse', ['Revit'])).toBe('Revit');
    });

    it('não avança da etapa 1 com o formulário vazio', () => {
        clicar(pagina, '#startBtn');
        avancar(pagina);
        expect(etapaAtiva(pagina)).toBe('stage-1');
    });
});

describe('envio', () => {
    function preparar(config = CONFIG_OK) {
        pagina = loadPage('lista-espera.html', { config });
        preencherAte(pagina, {
            etapas: ETAPAS_LISTA_ESPERA, pilulas: PILULAS_LISTA_ESPERA, ultima: 3
        });
        return pagina;
    }

    async function enviar() {
        clicar(pagina, '#submitBtn');
        await proximaVolta(pagina.window, 6);
    }

    const banner = () => pagina.document.getElementById('error-3');
    const protocolo = () => pagina.document.getElementById('protocolNumber').textContent;

    it('mostra o protocolo LE devolvido pelo servidor', async () => {
        preparar();
        pagina.window.fetch = vi.fn(async () => ({ json: async () => ({ success: true, protocolo: 'LE-2026-0021' }) }));
        await enviar();
        expect(protocolo()).toBe('LE-2026-0021');
        expect(etapaAtiva(pagina)).toBe('stage-success');
    });

    it('sem protocolo, usa o fallback LE-2026-0001', async () => {
        preparar();
        pagina.window.fetch = vi.fn(async () => ({ json: async () => ({ success: true }) }));
        await enviar();
        expect(protocolo()).toBe('LE-2026-0001');
    });

    it('manda tipo lista-espera e o bimclub escolhido', async () => {
        preparar();
        const fetch = vi.fn(async () => ({ json: async () => ({ success: true, protocolo: 'LE-2026-0022' }) }));
        pagina.window.fetch = fetch;
        await enviar();

        const payload = JSON.parse(fetch.mock.calls[0][1].body);
        expect(payload.tipo).toBe('lista-espera');
        expect(payload.bimclub).toBe('Sim');
        expect(payload).not.toHaveProperty('website_url');
    });

    /* Antes do commit 066a774 estas duas caíam na tela de sucesso com protocolo
       em branco: a página só tratava `if (result.success)`, sem ramo de falha. */
    it('recusa do servidor não mostra a tela de sucesso', async () => {
        preparar();
        pagina.window.fetch = vi.fn(async () => ({ json: async () => ({ success: false, errors: ['E-mail inválido'] }) }));
        await enviar();

        expect(etapaAtiva(pagina)).toBe('stage-3');
        expect(banner().textContent).toBe('E-mail inválido');
        expect(banner().classList.contains('visible')).toBe(true);
    });

    it('config ausente não mostra sucesso nem protocolo -DEV', async () => {
        preparar(null);
        const fetch = vi.fn();
        pagina.window.fetch = fetch;
        await enviar();

        expect(fetch).not.toHaveBeenCalled();
        expect(etapaAtiva(pagina)).toBe('stage-3');
        expect(banner().textContent)
            .toBe('Configuração do site não carregou. Recarregue a página e tente de novo.');
        expect(protocolo()).not.toBe('LE-2026-DEV');
    });

    it('honeypot preenchido não envia', async () => {
        preparar();
        const fetch = vi.fn();
        pagina.window.fetch = fetch;
        campo(pagina, 'website_url').value = 'http://spam.example';
        await enviar();
        expect(fetch).not.toHaveBeenCalled();
    });
});
