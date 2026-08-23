/* Task 19 §4.9 — a aba "Log de Erros" (commit 066a774).
 *
 * As rejeições do doPost dão `return` normal, não lançam: antes deste log elas
 * não apareciam em lugar nenhum. O teste mais importante daqui é o último — um
 * logger que derruba o envio é pior que nenhum logger.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadGas, eventoPost, respostaJson } from './helpers/loadGas.js';
import { payloadOrcamento } from './helpers/fixtures.js';

let gas;
beforeEach(() => {
    gas = loadGas();
    for (const tipo of ['orcamento', 'cadastro', 'lista-espera']) {
        gas.__planilha.semear(gas.FORMS[tipo].SHEET_NAME, [gas.FORMS[tipo].COLUMNS]);
    }
});

const log = () => gas.__planilha.getSheetByName('Log de Erros');
const linhas = () => log()?.dados.slice(1) ?? [];
const postar = (corpo) => respostaJson(gas.doPost(eventoPost(corpo)));

describe('criação da aba', () => {
    it('é criada na primeira falha, com cabeçalho de 6 colunas e linha congelada', () => {
        expect(gas.__planilha.getSheetByName('Log de Erros')).toBeNull();
        gas.doPost({});
        expect(log().dados[0]).toEqual(['Timestamp', 'Nível', 'Tipo', 'Protocolo', 'Mensagem', 'Detalhe']);
        expect(log().linhasCongeladas).toBe(1);
    });

    it('é reaproveitada nas falhas seguintes', () => {
        gas.doPost({});
        gas.doPost({});
        expect(linhas().length).toBe(2);
    });
});

describe('níveis por tipo de falha', () => {
    const nivelDaUltima = () => linhas().at(-1)[1];
    const mensagemDaUltima = () => linhas().at(-1)[4];

    it('payload vazio → ERRO', () => {
        gas.doPost({});
        expect(nivelDaUltima()).toBe('ERRO');
        expect(mensagemDaUltima()).toBe('Payload vazio');
    });

    it('JSON inválido → ERRO', () => {
        postar('nada disso é json');
        expect(nivelDaUltima()).toBe('ERRO');
        expect(mensagemDaUltima()).toBe('JSON inválido');
    });

    it('tipo inválido → ERRO', () => {
        postar({ tipo: 'xpto' });
        expect(nivelDaUltima()).toBe('ERRO');
        expect(mensagemDaUltima()).toBe('Tipo de formulário inválido');
    });

    it('rate limit → BLOQUEIO', () => {
        const payload = payloadOrcamento({ email: 'limite@teste.com' });
        for (let i = 0; i < 4; i++) postar(payload);
        expect(nivelDaUltima()).toBe('BLOQUEIO');
        expect(mensagemDaUltima()).toBe('Rate limit excedido');
    });

    it('validação → VALIDAÇÃO, com errors[], e-mail e campos recebidos', () => {
        const payload = payloadOrcamento();
        delete payload.nomeCompleto;
        postar(payload);

        const [, nivel, tipo, , mensagem, detalhe] = linhas().at(-1);
        expect(nivel).toBe('VALIDAÇÃO');
        expect(tipo).toBe('orcamento');
        expect(mensagem).toBe('Dados inválidos');

        const d = JSON.parse(detalhe);
        expect(d.email).toBe(payload.email);
        expect(d.errors.join(' ')).toContain('Nome completo');
        expect(d.camposRecebidos).toContain('empresa');
    });

    it('falha de e-mail → AVISO, sem derrubar o envio', () => {
        gas.__mail.lancar = 'quota exceeded';
        expect(postar(payloadOrcamento()).success).toBe(true);
        expect(linhas().at(-1)[1]).toBe('AVISO');
    });

    it('exceção inesperada → EXCEÇÃO', () => {
        // getLastRow explode no meio do doPost: simula falha real de infraestrutura
        gas.__planilha.getSheetByName('Orçamentos').getLastRow = () => { throw new Error('boom'); };
        const r = postar(payloadOrcamento());

        expect(r.success).toBe(false);
        expect(r.error).toBe('Erro interno. Tente novamente.');
        expect(linhas().at(-1)[1]).toBe('EXCEÇÃO');
    });
});

describe('envio bem-sucedido', () => {
    it('não gera linha de log — a aba é de erro, não de auditoria', () => {
        expect(postar(payloadOrcamento()).success).toBe(true);
        expect(gas.__planilha.getSheetByName('Log de Erros')).toBeNull();
    });
});

describe('limites e resiliência', () => {
    it('trunca o detalhe em LOG.MAX_DETAIL', () => {
        gas.logEvent_('ERRO', 'orcamento', '', 'detalhe grande', 'x'.repeat(5000));
        expect(linhas().at(-1)[5].length).toBe(gas.LOG.MAX_DETAIL);
    });

    it('trunca a mensagem em 500 caracteres', () => {
        gas.logEvent_('ERRO', 'orcamento', '', 'y'.repeat(900), null);
        expect(linhas().at(-1)[4].length).toBe(500);
    });

    it('ecoa no Cloud Logging mesmo quando a aba funciona', () => {
        gas.logEvent_('ERRO', 'orcamento', '', 'mensagem', { a: 1 });
        expect(gas.__chamadas.console.some(([nivel, texto]) =>
            nivel === 'error' && String(texto).includes('mensagem'))).toBe(true);
    });

    /* O teste que mais importa: um problema ao registrar jamais pode derrubar
       o envio. */
    it('se a criação da aba lançar, logEvent_ não propaga e o envio segue', () => {
        gas.__planilha.insertSheetLanca = 'permissão negada';
        expect(() => gas.logEvent_('ERRO', 'orcamento', '', 'com aba quebrada', null)).not.toThrow();
        expect(gas.__chamadas.logger.some((m) => m.includes('Falha ao registrar log'))).toBe(true);
    });

    it('com a aba quebrada, uma recusa continua devolvendo a resposta certa', () => {
        gas.__planilha.insertSheetLanca = 'permissão negada';
        const r = respostaJson(gas.doPost({}));
        expect(r).toEqual({ success: false, error: 'Payload vazio' });
    });
});
