/* Task 22 — o schema do Notion, o backend e o formulário dizendo a mesma coisa.
 *
 * Três cópias da mesma verdade existem no repo e nenhuma pode importar a outra:
 *
 *   lista-espera.html      as opções que a pessoa vê
 *   script/Code.gs         buildNotionProps_(), que roda no Google
 *   script/notion-schema.mjs   as colunas que o database precisa ter
 *
 * Divergência entre elas não quebra nada em teste nem em deploy — quebra no
 * primeiro lead real, com `400 ... is not a property that exists`, e o lead
 * vai parar na aba "Fila Notion" em vez do Notion. Estes testes são o único
 * lugar em que as três se encontram.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { loadGas } from './helpers/loadGas.js';
import { SCHEMAS, ENV_DB } from '../../script/notion-schema.mjs';
import { PAYLOAD_POR_TIPO } from './helpers/fixtures.js';

/* Alvo do notion-schema.mjs → tipo do FORMS no Code.gs. */
const PARES = [
    ['orcamentos',  'orcamento'],
    ['cadastros',   'cadastro'],
    ['listaEspera', 'lista-espera'],
    ['leadsBcf',    'bcf-pdf'],      // task 24
];

/* A chave única do objeto é o tipo: { rich_text: {} } → 'rich_text'.
   Vale para os dois lados — o schema e o que buildNotionProps_ devolve. */
const tipo = (obj) => Object.keys(obj)[0];

/* beforeAll, e não beforeEach: nada aqui escreve no sandbox — buildNotionProps_
   é pura e FORMS só é lido. Recarregar o Code.gs em node:vm 21 vezes custava
   segundos e fazia a suíte inteira estourar o timeout de outro arquivo. */
let gas;
beforeAll(() => { gas = loadGas(); });

describe('colunas do Notion × buildNotionProps_', () => {
    it.each(PARES)('"%s" manda exatamente as colunas que o database tem', (alvo, tipoForm) => {
        const doSchema = Object.keys(SCHEMAS[alvo].properties);
        const doCodeGs = Object.keys(
            gas.buildNotionProps_(PAYLOAD_POR_TIPO[tipoForm](), 'X-2026-0001', gas.FORMS[tipoForm])
        );

        // Coluna no schema e não no Code.gs: nasce e fica sempre vazia.
        expect(doSchema.filter(c => !doCodeGs.includes(c))).toEqual([]);
        // Coluna no Code.gs e não no schema: é o 400 que derruba o envio.
        expect(doCodeGs.filter(c => !doSchema.includes(c))).toEqual([]);
    });

    it.each(PARES)('"%s" manda cada coluna no tipo que o database espera', (alvo, tipoForm) => {
        const props = gas.buildNotionProps_(PAYLOAD_POR_TIPO[tipoForm](), 'X-2026-0001', gas.FORMS[tipoForm]);

        for (const [coluna, def] of Object.entries(SCHEMAS[alvo].properties)) {
            expect(tipo(props[coluna]), coluna).toBe(tipo(def));
        }
    });

    it.each(PARES)('"%s" aponta para a variável de ambiente certa', (alvo, tipoForm) => {
        expect(gas.FORMS[tipoForm].NOTION_DB_KEY).toBe(ENV_DB[alvo]);
    });
});

/* ============================================================
 *  As opções dos selects × o que o formulário oferece
 * ============================================================
 *  Opção faltando no Notion não derruba a gravação — a API cria a
 *  opção sozinha. Derruba filtro e agrupamento salvos, e faz a
 *  coluna nascer com cores aleatórias. Por isso o schema carrega as
 *  opções, e por isso elas precisam ser as do formulário.
 * ============================================================ */
describe('opções de select × lista-espera.html', () => {
    const dom = new JSDOM(readFileSync(new URL('../../lista-espera.html', import.meta.url), 'utf8'));
    const $ = (sel) => dom.window.document.querySelector(sel);

    const doSelect = (name) =>
        [...$(`select[name="${name}"]`).options].map(o => o.value).filter(Boolean);
    const dasPilulas = (grupo) =>
        [...$(`[data-pill-group="${grupo}"]`).querySelectorAll('.pill')].map(p => p.dataset.value);

    const CAMPOS = [
        ['Estado',                doSelect('estado')],
        ['Software Atual',        doSelect('softwareAtual')],
        ['Nível BIM',             doSelect('nivelBIM')],
        ['Como Conheceu',         doSelect('comoConheceu')],
        ['Software de Interesse', dasPilulas('softwareInteresse')],
        ['BIMClub',               dasPilulas('bimclub')],
    ];

    it.each(CAMPOS)('"%s" tem no schema todas as opções do formulário', (coluna, doForm) => {
        const noSchema = SCHEMAS.listaEspera.properties[coluna].select.options.map(o => o.name);

        expect(doForm.length).toBeGreaterThan(0);
        expect(doForm.filter(o => !noSchema.includes(o))).toEqual([]);
    });

    it.each(CAMPOS)('"%s" não tem no schema opção que o formulário não oferece', (coluna, doForm) => {
        const noSchema = SCHEMAS.listaEspera.properties[coluna].select.options.map(o => o.name);

        expect(noSchema.filter(o => !doForm.includes(o))).toEqual([]);
    });
});
