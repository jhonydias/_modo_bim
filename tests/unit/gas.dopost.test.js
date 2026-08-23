/* Task 19 §4.7 e §4.8 — rate limit e doPost com tudo dublado. */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadGas, eventoPost, respostaJson } from './helpers/loadGas.js';
import { payloadOrcamento, payloadListaEspera, PAYLOAD_POR_TIPO } from './helpers/fixtures.js';

let gas;

/** Prepara as abas com cabeçalho, como uma planilha já em uso. */
function comAbas() {
    const g = loadGas();
    for (const tipo of ['orcamento', 'cadastro', 'lista-espera']) {
        g.__planilha.semear(g.FORMS[tipo].SHEET_NAME, [g.FORMS[tipo].COLUMNS]);
    }
    return g;
}

beforeEach(() => { gas = comAbas(); });

const postar = (corpo) => respostaJson(gas.doPost(eventoPost(corpo)));

describe('checkRateLimit_', () => {
    it('libera 3 envios e barra o 4º', () => {
        const dados = { email: 'a@b.co' };
        expect(gas.checkRateLimit_(dados, 'orcamento').ok).toBe(true);
        expect(gas.checkRateLimit_(dados, 'orcamento').ok).toBe(true);
        expect(gas.checkRateLimit_(dados, 'orcamento').ok).toBe(true);
        expect(gas.checkRateLimit_(dados, 'orcamento').ok).toBe(false);
    });

    it('e-mails diferentes não interferem', () => {
        for (let i = 0; i < 3; i++) gas.checkRateLimit_({ email: 'a@b.co' }, 'orcamento');
        expect(gas.checkRateLimit_({ email: 'outro@b.co' }, 'orcamento').ok).toBe(true);
    });

    /* A chave inclui o tipo: o mesmo e-mail pode mandar 3 propostas E 3
       inscrições. É o que torna a rodada @live viável com um endereço só. */
    it('tipos diferentes têm baldes separados', () => {
        for (let i = 0; i < 3; i++) gas.checkRateLimit_({ email: 'a@b.co' }, 'orcamento');
        expect(gas.checkRateLimit_({ email: 'a@b.co' }, 'lista-espera').ok).toBe(true);
    });

    /* A normalização troca tudo que não é [a-z0-9] por "_": colisão de propósito,
       mas ninguém adivinha lendo o formulário. */
    it('maiúsculas e pontuação caem no mesmo balde', () => {
        for (let i = 0; i < 3; i++) gas.checkRateLimit_({ email: 'A@B.com' }, 'orcamento');
        expect(gas.checkRateLimit_({ email: 'a@b.com' }, 'orcamento').ok).toBe(false);
        expect(gas.checkRateLimit_({ email: 'a_b_com' }, 'orcamento').ok).toBe(false);
    });

    it('sem e-mail, tudo cai no balde "anon"', () => {
        for (let i = 0; i < 3; i++) gas.checkRateLimit_({}, 'orcamento');
        expect(gas.checkRateLimit_({}, 'orcamento').ok).toBe(false);
    });
});

describe('doPost — entradas malformadas', () => {
    it('sem postData devolve "Payload vazio"', () => {
        expect(respostaJson(gas.doPost({}))).toEqual({ success: false, error: 'Payload vazio' });
        expect(respostaJson(gas.doPost(undefined)).error).toBe('Payload vazio');
    });

    it('corpo que não é JSON devolve "JSON inválido"', () => {
        expect(postar('isto não é json').error).toBe('JSON inválido');
    });

    it('tipo desconhecido é recusado', () => {
        expect(postar({ tipo: 'xpto' }).error).toBe('Tipo de formulário inválido');
    });

    /* Comportamento legado: sem `tipo`, cai em 'cadastro'. Congelado em teste
       para que uma mudança seja deliberada, não acidental. */
    it('sem tipo, assume cadastro', () => {
        const r = postar({ nomeCompleto: 'sem tipo' });
        expect(r.success).toBe(false);
        expect(r.error).toBe('Dados inválidos');       // recusado pela validação de cadastro
        expect(r.errors.join(' ')).toContain('Razão Social');
    });
});

describe('doPost — recusa por validação', () => {
    it('devolve errors[] junto com error (o front depende disso)', () => {
        const payload = payloadOrcamento();
        delete payload.email;
        const r = postar(payload);
        expect(r.success).toBe(false);
        expect(r.error).toBe('Dados inválidos');
        expect(Array.isArray(r.errors)).toBe(true);
        expect(r.errors.join(' ')).toContain('E-mail de contato');
    });

    it('nada é gravado quando a validação falha', () => {
        const payload = payloadOrcamento();
        delete payload.email;
        postar(payload);
        expect(gas.__planilha.getSheetByName('Orçamentos').getLastRow()).toBe(1); // só o cabeçalho
        expect(gas.__chamadas.emails.length).toBe(0);
    });

    /* O rate limit é checado ANTES da validação: 3 envios inválidos queimam a cota. */
    it('rate limit vem antes da validação', () => {
        const invalido = payloadOrcamento();
        delete invalido.email;
        invalido.email = 'queima@teste.com';
        delete invalido.nomeCompleto;

        for (let i = 0; i < 3; i++) expect(postar(invalido).error).toBe('Dados inválidos');
        expect(postar(invalido).error).toBe('Muitas tentativas. Aguarde alguns minutos.');
    });
});

describe('doPost — caminho feliz', () => {
    it('grava linha, chama o Notion e dispara os dois e-mails', () => {
        const r = postar(payloadOrcamento());

        expect(r.success).toBe(true);
        expect(r.protocolo).toMatch(/^OR-\d{4}-0001$/);
        expect(r.tipo).toBe('orcamento');

        const aba = gas.__planilha.getSheetByName('Orçamentos');
        expect(aba.getLastRow()).toBe(2);
        expect(aba.getRange(2, 1, 1, gas.FORMS.orcamento.COLUMNS.length).getValues()[0].length)
            .toBe(gas.FORMS.orcamento.COLUMNS.length);

        expect(gas.__chamadas.notion.length).toBe(1);
        expect(gas.__chamadas.emails.length).toBe(2);
    });

    it('o protocolo avança a cada envio', () => {
        expect(postar(payloadOrcamento({ email: 'um@teste.com' })).protocolo).toMatch(/-0001$/);
        expect(postar(payloadOrcamento({ email: 'dois@teste.com' })).protocolo).toMatch(/-0002$/);
    });

    it('funciona para os três tipos de formulário', () => {
        expect(postar(PAYLOAD_POR_TIPO.orcamento()).protocolo).toMatch(/^OR-/);
        expect(postar(PAYLOAD_POR_TIPO['lista-espera']()).protocolo).toMatch(/^LE-/);
        expect(postar(PAYLOAD_POR_TIPO.cadastro()).protocolo).toMatch(/^MB-/);
    });

    it('cria a aba quando ela ainda não existe', () => {
        const limpo = loadGas();
        const r = respostaJson(limpo.doPost(eventoPost(payloadListaEspera())));
        expect(r.success).toBe(true);
        expect(limpo.__planilha.getSheetByName('Lista de Espera').getLastRow()).toBe(2);
    });

    it('o payload é sanitizado antes de gravar', () => {
        postar(payloadOrcamento({ nomeCompleto: '<b>Fulana</b>' }));
        const linha = gas.__planilha.getSheetByName('Orçamentos').dados[1];
        expect(linha[2]).toBe('Fulana');
    });
});

/* Notion e e-mail são acessórios: nenhum dos dois pode derrubar um envio que já
   foi gravado na planilha. */
describe('doPost — falhas que não podem derrubar o envio', () => {
    it('Notion lançando não impede o sucesso e enfileira o reenvio', () => {
        gas.__notion.lancar = 'timeout';
        const r = postar(payloadOrcamento());

        expect(r.success).toBe(true);
        expect(gas.__planilha.getSheetByName('Fila Notion').getLastRow()).toBeGreaterThan(1);
    });

    it('Notion devolvendo 400 também enfileira', () => {
        gas.__notion.responder = () => ({ codigo: 400, corpo: '{"message":"invalid"}' });
        const r = postar(payloadOrcamento());
        expect(r.success).toBe(true);
        expect(gas.__planilha.getSheetByName('Fila Notion').getLastRow()).toBeGreaterThan(1);
    });

    it('MailApp lançando não impede o sucesso e vira AVISO no log', () => {
        gas.__mail.lancar = 'quota exceeded';
        const r = postar(payloadOrcamento());

        expect(r.success).toBe(true);
        const log = gas.__planilha.getSheetByName('Log de Erros');
        expect(log.dados.some((l) => l[1] === 'AVISO')).toBe(true);
    });
});

describe('doPost — rate limit', () => {
    it('o 4º envio do mesmo e-mail e tipo é barrado', () => {
        const payload = payloadOrcamento({ email: 'repetido@teste.com' });
        for (let i = 0; i < 3; i++) expect(postar(payload).success).toBe(true);

        const quarto = postar(payload);
        expect(quarto.success).toBe(false);
        expect(quarto.error).toBe('Muitas tentativas. Aguarde alguns minutos.');
        expect(gas.__planilha.getSheetByName('Orçamentos').getLastRow()).toBe(4); // nada gravado a mais
    });
});

describe('doGet', () => {
    it('responde ok com os três formulários', () => {
        const r = respostaJson(gas.doGet({}));
        expect(r.status).toBe('ok');
        expect(r.forms).toEqual(['orcamento', 'cadastro', 'lista-espera']);
    });
});
