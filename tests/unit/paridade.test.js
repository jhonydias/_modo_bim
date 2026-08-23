/* Task 19 §3.7 — paridade entre o payload que o front monta e o REQUIRED do backend.
 *
 * É o teste que teria pego o bug da task 18 no dia: reuniao1/reuniao2 saíram do
 * formulário e ficaram no REQUIRED do Code.gs, e TODA proposta passou a ser
 * recusada — sem que nada no repo acusasse.
 *
 * Ele não confere nomes de campo escritos à mão: monta o payload preenchendo o
 * formulário de verdade no jsdom e valida com o validatePayload_ de verdade.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { loadPage, proximaVolta } from './helpers/loadPage.js';
import { loadGas } from './helpers/loadGas.js';
import { preencherAte, clicar } from './helpers/formulario.js';
import {
    ETAPAS_CADASTRO, PILULAS_CADASTRO,
    ETAPAS_LISTA_ESPERA, PILULAS_LISTA_ESPERA
} from './helpers/fixtures.js';

const CONFIG_OK = { ENDPOINT_URL: 'https://script.google.com/macros/s/AKfycfake/exec', DEV_MODE: false };

const FORMULARIOS = [
    {
        tipo: 'orcamento',
        arquivo: 'cadastro.html',
        etapas: ETAPAS_CADASTRO,
        pilulas: PILULAS_CADASTRO,
        ultima: 4,
        /* Campos que o front manda e o backend não exige. Não é erro — é registro:
           se esta lista mudar, alguém mexeu no formulário sem olhar o backend. */
        extras: ['observacoes', 'softwareOutro', 'tipo', 'timestamp', 'userAgent']
    },
    {
        tipo: 'lista-espera',
        arquivo: 'lista-espera.html',
        etapas: ETAPAS_LISTA_ESPERA,
        pilulas: PILULAS_LISTA_ESPERA,
        ultima: 3,
        extras: ['empresa', 'comoConheceu', 'tipo', 'timestamp', 'userAgent']
    }
];

/** Preenche o formulário no jsdom e captura o payload exato que iria para a rede. */
async function capturarPayload({ arquivo, etapas, pilulas, ultima }) {
    const pagina = loadPage(arquivo, { config: CONFIG_OK });
    preencherAte(pagina, { etapas, pilulas, ultima });

    const fetch = vi.fn(async () => ({ json: async () => ({ success: true, protocolo: 'X-2026-0001' }) }));
    pagina.window.fetch = fetch;
    clicar(pagina, '#submitBtn');
    await proximaVolta(pagina.window, 6);

    expect(fetch, `${arquivo} não chegou a enviar`).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    pagina.fechar();
    return payload;
}

let gas;
beforeAll(() => { gas = loadGas(); });

describe.each(FORMULARIOS)('$arquivo -> FORMS["$tipo"]', (form) => {
    let payload;
    beforeAll(async () => { payload = await capturarPayload(form); });

    it('o tipo do payload é o esperado', () => {
        expect(payload.tipo).toBe(form.tipo);
    });

    it('toda chave obrigatória do backend chega preenchida', () => {
        const obrigatorios = Object.keys(gas.FORMS[form.tipo].REQUIRED);
        const faltando = obrigatorios.filter((k) => !payload[k] || !String(payload[k]).trim());
        expect(faltando, `campos exigidos pelo Code.gs que o formulário não manda: ${faltando}`)
            .toEqual([]);
    });

    it('o backend aceita o payload real do formulário', () => {
        const r = gas.validatePayload_(payload, gas.FORMS[form.tipo]);
        expect(r.errors).toEqual([]);
        expect(r.valid).toBe(true);
    });

    it('os campos enviados fora do REQUIRED continuam sendo os conhecidos', () => {
        const obrigatorios = Object.keys(gas.FORMS[form.tipo].REQUIRED);
        const enviadosAMais = Object.keys(payload).filter((k) => !obrigatorios.includes(k));
        expect(enviadosAMais.sort()).toEqual(
            form.extras.filter((e) => Object.keys(payload).includes(e)).sort()
        );
    });

    it('o payload passa pelo doPost sem ser recusado', () => {
        const sandbox = loadGas();
        sandbox.__planilha.semear(sandbox.FORMS[form.tipo].SHEET_NAME,
            [sandbox.FORMS[form.tipo].COLUMNS]);
        const saida = sandbox.doPost({ postData: { contents: JSON.stringify(payload) } });
        const resposta = JSON.parse(saida.getContent());
        expect(resposta.errors ?? []).toEqual([]);
        expect(resposta.success).toBe(true);
    });
});

/* Regressão explícita da task 18 — a asserção que trava o bloqueador. */
describe('regressão task 18', () => {
    it('reuniao1 e reuniao2 não são mais obrigatórios em orcamento', () => {
        const obrigatorios = Object.keys(gas.FORMS.orcamento.REQUIRED);
        expect(obrigatorios).not.toContain('reuniao1');
        expect(obrigatorios).not.toContain('reuniao2');
    });

    it('cadastro.html não tem mais nenhum campo de reunião', () => {
        const pagina = loadPage('cadastro.html');
        expect(pagina.document.querySelector('[name="reuniao1"]')).toBeNull();
        expect(pagina.document.querySelector('[name="reuniao2"]')).toBeNull();
        pagina.fechar();
    });
});
