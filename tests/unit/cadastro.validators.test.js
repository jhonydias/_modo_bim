/* Task 19 §3.1 e §3.2 — validadores, máscara e pílulas do cadastro.html.
 *
 * As funções são `function` declarada no topo de um <script> clássico, então
 * estão em window. Os `const` (ENDPOINT_URL, totalSteps…) não estão — para esses
 * existe o evalIn.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadPage } from './helpers/loadPage.js';
import { digitar, clicarPilulas, campo } from './helpers/formulario.js';
import { EMAILS_VALIDOS, EMAILS_INVALIDOS, TELEFONES_VALIDOS, TELEFONES_INVALIDOS } from './helpers/fixtures.js';

let pagina;
beforeEach(() => { pagina = loadPage('cadastro.html'); });
afterEach(() => pagina.fechar());

describe('validarEmail', () => {
    it.each(EMAILS_VALIDOS)('aceita %s', (e) => expect(pagina.window.validarEmail(e)).toBe(true));
    it.each(EMAILS_INVALIDOS)('recusa %j', (e) => expect(pagina.window.validarEmail(e)).toBe(false));
});

describe('validarTelefone', () => {
    it.each(TELEFONES_VALIDOS)('aceita %s', (t) => expect(pagina.window.validarTelefone(t)).toBe(true));
    it.each(TELEFONES_INVALIDOS)('recusa %j', (t) => expect(pagina.window.validarTelefone(t)).toBe(false));
});

describe('validarQuantidade', () => {
    it('aceita 1, 999 e string numérica', () => {
        expect(pagina.window.validarQuantidade('1')).toBe(true);
        expect(pagina.window.validarQuantidade('999')).toBe(true);
        expect(pagina.window.validarQuantidade('42')).toBe(true);
    });

    /* Number('') é 0 e reprova pelo >= 1; ' 5 ' é 5 e aprova; '1e3' é 1000 e
       reprova pelo <= 999. Documentado porque não é óbvio lendo a função. */
    it.each(['0', '1000', '-1', '1.5', '', 'abc', '1e3'])('recusa %j', (v) => {
        expect(pagina.window.validarQuantidade(v)).toBe(false);
    });

    it("' 5 ' passa porque Number ignora espaços nas pontas", () => {
        expect(pagina.window.validarQuantidade(' 5 ')).toBe(true);
    });
});

/* validarDataFutura e o atributo data-future são código morto desde a task 18:
   não existe mais input[type="datetime-local"] no formulário. A função é testada
   como função pura porque é grátis; teste de DOM para ela seria mentira. */
describe('validarDataFutura (código morto, mantido por segurança)', () => {
    it('aceita data futura e recusa passada, inválida e vazia', () => {
        const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
        const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 16);
        expect(pagina.window.validarDataFutura(amanha)).toBe(true);
        expect(pagina.window.validarDataFutura(ontem)).toBe(false);
        expect(pagina.window.validarDataFutura('2026-13-45')).toBe(false);
        expect(pagina.window.validarDataFutura('')).toBe(false);
    });

    it('não há mais nenhum campo datetime-local usando data-future', () => {
        expect(pagina.document.querySelectorAll('input[type="datetime-local"]').length).toBe(0);
        expect(pagina.document.querySelectorAll('[data-future]').length).toBe(0);
    });
});

describe('maskPhone', () => {
    /* O parêntese só aparece no 3º dígito: a regex é /(\d{2})(\d)/, então com
       "9" e "91" ainda não há o que agrupar. Comportamento real do código —
       o refinamento de 22/08 previa "(9" já no primeiro dígito, e estava errado. */
    it('formata progressivamente enquanto se digita', () => {
        expect(pagina.window.maskPhone('9')).toBe('9');
        expect(pagina.window.maskPhone('91')).toBe('91');
        expect(pagina.window.maskPhone('919')).toBe('(91) 9');
        expect(pagina.window.maskPhone('91988887777')).toBe('(91) 98888-7777');
    });

    it('formata fixo de 10 dígitos', () => {
        expect(pagina.window.maskPhone('9132221111')).toBe('(91) 3222-1111');
    });

    it('descarta o 12º dígito', () => {
        expect(pagina.window.maskPhone('919888877779')).toBe('(91) 98888-7777');
    });

    it('ignora letras coladas no campo', () => {
        expect(pagina.window.maskPhone('abc91988887777xyz')).toBe('(91) 98888-7777');
    });

    it('aplica no campo real conforme a pessoa digita', () => {
        expect(digitar(pagina, 'telefone', '91988887777')).toBe('(91) 98888-7777');
    });
});

describe('grupos de pílulas', () => {
    it('softwareInteresse é múltiplo e espelha os valores separados por vírgula', () => {
        expect(clicarPilulas(pagina, 'softwareInteresse', ['Revit', 'Archicad']))
            .toBe('Revit, Archicad');
    });

    it('clicar de novo desmarca', () => {
        clicarPilulas(pagina, 'softwareInteresse', ['Revit', 'Archicad']);
        expect(clicarPilulas(pagina, 'softwareInteresse', ['Revit'])).toBe('Archicad');
    });

    it('nivelEquipe é exclusivo: a segunda escolha substitui a primeira', () => {
        clicarPilulas(pagina, 'nivelEquipe', ['Partirão do zero']);
        expect(clicarPilulas(pagina, 'nivelEquipe', ['Equipe mista'])).toBe('Equipe mista');
    });

    it('marcar "Outro" revela o campo softwareOutro', () => {
        const reveal = pagina.document.querySelector('.field-reveal');
        expect(reveal.classList.contains('open')).toBe(false);
        clicarPilulas(pagina, 'softwareInteresse', ['Outro']);
        expect(reveal.classList.contains('open')).toBe(true);
        expect(campo(pagina, 'softwareOutro')).toBeTruthy();
    });

    it('desmarcar "Outro" fecha o campo revelado', () => {
        clicarPilulas(pagina, 'softwareInteresse', ['Outro']);
        clicarPilulas(pagina, 'softwareInteresse', ['Outro']);
        expect(pagina.document.querySelector('.field-reveal').classList.contains('open')).toBe(false);
    });

    /* A lista de opções muda por decisão comercial (Navisworks saiu em 23/08) e o
       backend não valida valores. O que precisa de teste é o mecanismo; a lista
       fica aqui só como registro do estado atual. */
    it('as opções atuais de softwareInteresse são Revit, Archicad e Outro', () => {
        const valores = [...pagina.document.querySelectorAll('[data-pill-group="softwareInteresse"] .pill')]
            .map((p) => p.dataset.value);
        expect(valores).toEqual(['Revit', 'Archicad', 'Outro']);
    });
});
