/* Task 19 §4.3 a §4.6 — sanitização, protocolo, linha da planilha, Notion e e-mails. */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadGas } from './helpers/loadGas.js';
import { payloadOrcamento, payloadListaEspera, payloadCadastro, PAYLOAD_POR_TIPO } from './helpers/fixtures.js';

let gas;
beforeEach(() => { gas = loadGas(); });

describe('sanitizeData_', () => {
    it('remove tags HTML', () => {
        const r = gas.sanitizeData_({ gargalo: '<script>alert(1)</script>retrabalho' });
        expect(r.gargalo).toBe('alert(1)retrabalho');
        expect(r.gargalo).not.toContain('<');
    });

    it('corta campo comum em 500 caracteres', () => {
        const r = gas.sanitizeData_({ nomeCompleto: 'a'.repeat(600) });
        expect(r.nomeCompleto.length).toBe(500);
    });

    it('corta campo longo em 2000 caracteres', () => {
        for (const campo of ['objetivo', 'produtosServicos', 'gargalo', 'objetivoBIM', 'observacoes']) {
            const r = gas.sanitizeData_({ [campo]: 'a'.repeat(2500) });
            expect(r[campo].length, campo).toBe(2000);
        }
    });

    it('remove espaços nas pontas', () => {
        expect(gas.sanitizeData_({ email: '  a@b.co  ' }).email).toBe('a@b.co');
    });

    it('deixa valores não-string intactos', () => {
        const r = gas.sanitizeData_({ n: 42, nulo: null, bool: true });
        expect(r).toEqual({ n: 42, nulo: null, bool: true });
    });
});

describe('generateProtocol_', () => {
    const ano = new Date().getFullYear();
    const semear = (linhas) =>
        gas.__planilha.semear('Orçamentos', [gas.FORMS.orcamento.COLUMNS, ...linhas]);

    it('planilha só com cabeçalho gera o 0001', () => {
        semear([]);
        expect(gas.generateProtocol_(gas.FORMS.orcamento)).toBe(`OR-${ano}-0001`);
    });

    it('com 7 protocolos do ano corrente, gera o 0008', () => {
        semear(Array.from({ length: 7 }, (_, i) => ['ts', `OR-${ano}-${String(i + 1).padStart(4, '0')}`]));
        expect(gas.generateProtocol_(gas.FORMS.orcamento)).toBe(`OR-${ano}-0008`);
    });

    /* Conta linhas com o prefixo do ano — não lê um contador. Apagar uma linha
       de teste REUSA aquele número; é por isso que a faxina precisa acontecer
       antes do primeiro cliente real (task 19 §05.2). */
    it('protocolo de ano anterior não conta', () => {
        semear([['ts', `OR-${ano - 1}-0009`]]);
        expect(gas.generateProtocol_(gas.FORMS.orcamento)).toBe(`OR-${ano}-0001`);
    });

    it('apagar uma linha faz o próximo protocolo repetir o número', () => {
        const aba = semear([['ts', `OR-${ano}-0001`], ['ts', `OR-${ano}-0002`]]);
        expect(gas.generateProtocol_(gas.FORMS.orcamento)).toBe(`OR-${ano}-0003`);
        aba.deleteRow(3);
        expect(gas.generateProtocol_(gas.FORMS.orcamento)).toBe(`OR-${ano}-0002`);
    });

    it('cada tipo tem o seu prefixo', () => {
        for (const [tipo, prefixo] of [['orcamento', 'OR'], ['cadastro', 'MB'], ['lista-espera', 'LE']]) {
            gas.__planilha.semear(gas.FORMS[tipo].SHEET_NAME, [gas.FORMS[tipo].COLUMNS]);
            expect(gas.generateProtocol_(gas.FORMS[tipo])).toBe(`${prefixo}-${ano}-0001`);
        }
    });
});

describe('buildRow_', () => {
    it.each(['orcamento', 'cadastro', 'lista-espera'])(
        'a linha de %s tem o tamanho do COLUMNS', (tipo) => {
            const config = gas.FORMS[tipo];
            const linha = gas.buildRow_(PAYLOAD_POR_TIPO[tipo](), 'ts', 'X-2026-0001', config);
            expect(linha.length).toBe(config.COLUMNS.length);
        }
    );

    it('começa por timestamp e protocolo, na ordem do COLUMNS', () => {
        const linha = gas.buildRow_(payloadOrcamento(), '23/08/2026 10:00', 'OR-2026-0007', gas.FORMS.orcamento);
        expect(linha[0]).toBe('23/08/2026 10:00');
        expect(linha[1]).toBe('OR-2026-0007');
        expect(linha[2]).toBe(payloadOrcamento().nomeCompleto);
    });

    it('campo ausente vira string vazia, nunca undefined', () => {
        const linha = gas.buildRow_({}, 'ts', 'OR-2026-0001', gas.FORMS.orcamento);
        expect(linha.includes(undefined)).toBe(false);
        expect(linha.filter((v) => v === '').length).toBeGreaterThan(5);
    });

    /* reuniao1/reuniao2 saíram do formulário na task 18: as colunas continuam
       existindo e sempre chegam vazias. */
    it('as colunas de reunião ficam vazias sem quebrar', () => {
        const cols = gas.FORMS.orcamento.COLUMNS;
        const linha = gas.buildRow_(payloadOrcamento(), 'ts', 'OR-2026-0001', gas.FORMS.orcamento);
        expect(linha[cols.indexOf('Reunião (1ª opção)')]).toBe('');
        expect(linha[cols.indexOf('Reunião (2ª opção)')]).toBe('');
    });
});

describe('buildNotionProps_', () => {
    it('monta as propriedades no formato da API do Notion', () => {
        const props = gas.buildNotionProps_(payloadOrcamento(), 'OR-2026-0007', gas.FORMS.orcamento);
        // O título do item no Notion é o nome da pessoa; o protocolo é rich_text.
        expect(props['Nome Completo'].title[0].text.content).toBe(payloadOrcamento().nomeCompleto);
        expect(props['Protocolo'].rich_text[0].text.content).toBe('OR-2026-0007');
        expect(props['E-mail'].email).toBe(payloadOrcamento().email);
    });

    it('multi-select quebra "Revit, Archicad" em duas opções', () => {
        const props = gas.buildNotionProps_(payloadOrcamento(), 'OR-2026-0001', gas.FORMS.orcamento);
        const multi = Object.values(props).find((p) => p && p.multi_select);
        expect(multi.multi_select.map((o) => o.name)).toEqual(['Revit', 'Archicad']);
    });

    it('valor vazio vira conteúdo nulo, sem quebrar', () => {
        const props = gas.buildNotionProps_({}, 'OR-2026-0001', gas.FORMS.orcamento);
        /* O helper devolve a propriedade com o conteúdo nulo — { date: null } —,
           não a propriedade nula: é o formato que a API do Notion aceita como vazio. */
        expect(props['Reunião (1ª opção)']).toEqual({ date: null });
        expect(props['Empresa']).toEqual({ rich_text: [] });
        expect(props['Nível da Equipe']).toEqual({ select: null });
        expect(() => JSON.stringify(props)).not.toThrow();
    });

    it.each(['orcamento', 'cadastro', 'lista-espera'])('não quebra para %s', (tipo) => {
        expect(() => gas.buildNotionProps_(PAYLOAD_POR_TIPO[tipo](), 'X-2026-0001', gas.FORMS[tipo]))
            .not.toThrow();
    });
});

describe('formatação de data', () => {
    it('formatDataHora_ e notionDataHora_ aceitam vazio sem lançar', () => {
        expect(() => gas.formatDataHora_('')).not.toThrow();
        expect(() => gas.formatDataHora_(undefined)).not.toThrow();
        expect(gas.formatDataHora_('')).toBe('');
        expect(gas.notionDataHora_('')).toBe('');
    });
});

describe('escapeHtml_ e os e-mails', () => {
    it('escapa os cinco caracteres', () => {
        expect(gas.escapeHtml_(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
    });

    it('payload com <img onerror> não vira tag no HTML do e-mail', () => {
        const html = gas.renderOrcamentoRows_(
            payloadOrcamento({ gargalo: '<img src=x onerror=alert(1)>' }));
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });

    it.each([
        ['renderOrcamentoRows_', payloadOrcamento],
        ['renderCadastroRows_', payloadCadastro],
        ['renderListaEsperaRows_', payloadListaEspera]
    ])('%s produz linhas para o payload completo', (fn, monta) => {
        const html = gas[fn](monta());
        expect(html.length).toBeGreaterThan(50);
        expect(html).not.toContain('undefined');
    });

    it('renderRow_ com valor vazio devolve string vazia', () => {
        expect(gas.renderRow_('Rótulo', '')).toBe('');
        expect(gas.renderRow_('Rótulo', undefined)).toBe('');
    });

    it('formatEndereco_ sem complemento não deixa vírgula solta', () => {
        const endereco = gas.formatEndereco_(payloadCadastro({ complemento: '' }));
        expect(endereco).not.toMatch(/,\s*,/);
        expect(endereco.trim()).not.toMatch(/,$/);
    });
});
