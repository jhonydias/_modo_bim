/* Task 19 §4.1 e §4.2 — validadores puros e validatePayload_ do script/Code.gs. */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadGas } from './helpers/loadGas.js';
import {
    CNPJ_VALIDO, CNPJ_INVALIDO, CPF_VALIDO, CPF_INVALIDO,
    EMAILS_VALIDOS, EMAILS_INVALIDOS, TELEFONES_VALIDOS, TELEFONES_INVALIDOS,
    PAYLOAD_POR_TIPO
} from './helpers/fixtures.js';

let gas;
beforeAll(() => { gas = loadGas(); });

describe('validarCNPJ_', () => {
    it('aceita CNPJ válido com e sem máscara', () => {
        expect(gas.validarCNPJ_(CNPJ_VALIDO)).toBe(true);
        expect(gas.validarCNPJ_(CNPJ_VALIDO.replace(/\D/g, ''))).toBe(true);
    });

    it('recusa dígito verificador trocado', () => {
        expect(gas.validarCNPJ_(CNPJ_INVALIDO)).toBe(false);
    });

    it('recusa sequência repetida, tamanho errado e vazio', () => {
        expect(gas.validarCNPJ_('11111111111111')).toBe(false);
        expect(gas.validarCNPJ_('1122233300018')).toBe(false);   // 13
        expect(gas.validarCNPJ_('112223330001811')).toBe(false); // 15
        expect(gas.validarCNPJ_('')).toBe(false);
        expect(gas.validarCNPJ_(null)).toBe(false);
    });
});

describe('validarCPF_', () => {
    it('aceita CPF válido com e sem máscara', () => {
        expect(gas.validarCPF_(CPF_VALIDO)).toBe(true);
        expect(gas.validarCPF_(CPF_VALIDO.replace(/\D/g, ''))).toBe(true);
    });

    it('recusa dígito trocado, sequência repetida, tamanho errado e vazio', () => {
        expect(gas.validarCPF_(CPF_INVALIDO)).toBe(false);
        expect(gas.validarCPF_('11111111111')).toBe(false);
        expect(gas.validarCPF_('5299822472')).toBe(false);   // 10
        expect(gas.validarCPF_('529982247255')).toBe(false); // 12
        expect(gas.validarCPF_('')).toBe(false);
        expect(gas.validarCPF_(null)).toBe(false);
    });
});

describe('validarEmail_', () => {
    it.each(EMAILS_VALIDOS)('aceita %s', (e) => expect(gas.validarEmail_(e)).toBe(true));
    it.each(EMAILS_INVALIDOS)('recusa %j', (e) => expect(gas.validarEmail_(e)).toBe(false));
});

describe('validarTelefone_', () => {
    it.each(TELEFONES_VALIDOS)('aceita %s (10 ou 11 dígitos)', (t) =>
        expect(gas.validarTelefone_(t)).toBe(true));
    it.each(TELEFONES_INVALIDOS)('recusa %j', (t) => expect(gas.validarTelefone_(t)).toBe(false));
});

describe('validarQuantidade_', () => {
    it('aceita inteiros de 1 a 999', () => {
        expect(gas.validarQuantidade_(1)).toBe(true);
        expect(gas.validarQuantidade_(999)).toBe(true);
        expect(gas.validarQuantidade_('42')).toBe(true);
    });
    it('recusa 0, 1000, fracionário e texto', () => {
        expect(gas.validarQuantidade_(0)).toBe(false);
        expect(gas.validarQuantidade_(1000)).toBe(false);
        expect(gas.validarQuantidade_(1.5)).toBe(false);
        expect(gas.validarQuantidade_('abc')).toBe(false);
    });
});

describe('validarDataHora_', () => {
    it('aceita ISO local, com e sem segundos', () => {
        expect(gas.validarDataHora_('2026-09-10T14:30')).toBe(true);
        expect(gas.validarDataHora_('2026-09-10T14:30:00')).toBe(true);
    });
    it('recusa formato brasileiro e vazio', () => {
        expect(gas.validarDataHora_('10/09/2026')).toBe(false);
        expect(gas.validarDataHora_('')).toBe(false);
    });
});

/* Front e backend validam e-mail e telefone por conta própria. Se um aceitar o
   que o outro recusa, a pessoa preenche, passa no cliente e é recusada no
   servidor — sem entender por quê. Esta é a asserção que amarra os dois. */
describe('paridade de validadores entre front e backend', () => {
    it('validarEmail_ concorda com validarEmail do cadastro.html', async () => {
        const { loadPage } = await import('./helpers/loadPage.js');
        const pagina = loadPage('cadastro.html');
        for (const e of [...EMAILS_VALIDOS, ...EMAILS_INVALIDOS]) {
            expect(pagina.window.validarEmail(e), `divergiu em ${JSON.stringify(e)}`)
                .toBe(gas.validarEmail_(e));
        }
        pagina.fechar();
    });

    it('validarTelefone_ concorda com validarTelefone do cadastro.html', async () => {
        const { loadPage } = await import('./helpers/loadPage.js');
        const pagina = loadPage('cadastro.html');
        for (const t of [...TELEFONES_VALIDOS, ...TELEFONES_INVALIDOS]) {
            expect(pagina.window.validarTelefone(t), `divergiu em ${JSON.stringify(t)}`)
                .toBe(gas.validarTelefone_(t));
        }
        pagina.fechar();
    });
});

describe('validatePayload_', () => {
    it.each(['orcamento', 'lista-espera', 'cadastro'])(
        'payload completo de %s é válido', (tipo) => {
            const r = gas.validatePayload_(PAYLOAD_POR_TIPO[tipo](), gas.FORMS[tipo]);
            expect(r.errors).toEqual([]);
            expect(r.valid).toBe(true);
        }
    );

    it.each(['orcamento', 'lista-espera', 'cadastro'])(
        'cada obrigatório removido de %s vira erro com o rótulo em português', (tipo) => {
            const config = gas.FORMS[tipo];
            for (const [campo, rotulo] of Object.entries(config.REQUIRED)) {
                const payload = PAYLOAD_POR_TIPO[tipo]();
                delete payload[campo];
                const r = gas.validatePayload_(payload, config);
                expect(r.valid, `${tipo}.${campo} passou sem estar presente`).toBe(false);
                expect(r.errors.join(' | ')).toContain(rotulo);
            }
        }
    );

    it('campo obrigatório só com espaços conta como ausente', () => {
        const r = gas.validatePayload_(
            PAYLOAD_POR_TIPO.orcamento({ nomeCompleto: '   ' }), gas.FORMS.orcamento);
        expect(r.valid).toBe(false);
        expect(r.errors.join(' ')).toContain('Nome completo');
    });

    /* Regressão da task 18: reuniao1/reuniao2 saíram do formulário e do REQUIRED.
       Enquanto estiveram lá, TODA proposta era recusada. */
    it('orçamento sem reuniao1/reuniao2 é válido', () => {
        const payload = payloadSemReuniao();
        const r = gas.validatePayload_(payload, gas.FORMS.orcamento);
        expect(r.valid).toBe(true);
        expect(r.errors.join(' ')).not.toMatch(/Reuni/);
    });

    it('reuniao1/reuniao2 não estão no REQUIRED de orcamento', () => {
        expect(Object.keys(gas.FORMS.orcamento.REQUIRED)).not.toContain('reuniao1');
        expect(Object.keys(gas.FORMS.orcamento.REQUIRED)).not.toContain('reuniao2');
    });

    it('cadastro com CNPJ inválido acusa CNPJ', () => {
        const r = gas.validatePayload_(
            PAYLOAD_POR_TIPO.cadastro({ cnpj: CNPJ_INVALIDO }), gas.FORMS.cadastro);
        expect(r.errors).toContain('CNPJ inválido');
    });

    it('cadastro com CPF inválido acusa CPF', () => {
        const r = gas.validatePayload_(
            PAYLOAD_POR_TIPO.cadastro({ cpfRepresentante: CPF_INVALIDO }), gas.FORMS.cadastro);
        expect(r.errors).toContain('CPF inválido');
    });

    it('cadastro com CEP de 7 dígitos acusa CEP', () => {
        const r = gas.validatePayload_(
            PAYLOAD_POR_TIPO.cadastro({ cep: '6600000' }), gas.FORMS.cadastro);
        expect(r.errors).toContain('CEP inválido');
    });
});

function payloadSemReuniao() {
    const p = PAYLOAD_POR_TIPO.orcamento();
    delete p.reuniao1;
    delete p.reuniao2;
    return p;
}
