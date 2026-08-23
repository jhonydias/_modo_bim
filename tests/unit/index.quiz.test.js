/* Task 19 §3.8 — quiz de direcionamento do index.html.
 *
 * É o único componente da landing com lógica de decisão. As funções do quiz
 * estão dentro de `if (quizForm) { … }`, então não existem em window: tudo é
 * testado pelo DOM, clicando nos radios como uma pessoa faz.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadPage } from './helpers/loadPage.js';

let pagina;
beforeEach(() => { pagina = loadPage('index.html'); });
afterEach(() => pagina.fechar());

/** Marca a alternativa `letra` (a..d) da pergunta `n` e dispara o clique real. */
function responder(n, letra) {
    const radio = pagina.document.getElementById(`q${n}${letra}`);
    if (!radio) throw new Error(`alternativa q${n}${letra} não existe`);
    radio.checked = true;
    radio.dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true }));
}

const resultado = () => pagina.document.getElementById('quizResult');
const primario = () => pagina.document.getElementById('resPrimary');
const largura = () => pagina.document.getElementById('quizProgress').style.width;
const etapaVisivel = () =>
    [...pagina.document.querySelectorAll('.quiz-step')].findIndex((s) => !s.hidden);

describe('pontuação', () => {
    it('5 respostas nas duas primeiras alternativas → treinamento', () => {
        [1, 2, 3, 4, 5].forEach((n) => responder(n, 'a'));
        expect(primario().getAttribute('href')).toBe('lista-espera.html?perfil=treinamento');
        expect(resultado().hidden).toBe(false);
    });

    it('5 respostas nas duas últimas → implementação', () => {
        [1, 2, 3, 4, 5].forEach((n) => responder(n, 'd'));
        expect(primario().getAttribute('href')).toBe('cadastro.html?perfil=implementacao');
    });

    it('3 treinamento e 2 implementação → treinamento, por maioria', () => {
        ['a', 'b', 'a', 'c', 'd'].forEach((letra, i) => responder(i + 1, letra));
        expect(primario().getAttribute('href')).toContain('perfil=treinamento');
    });

    it('3 implementação e 2 treinamento → implementação', () => {
        ['c', 'd', 'c', 'a', 'b'].forEach((letra, i) => responder(i + 1, letra));
        expect(primario().getAttribute('href')).toContain('perfil=implementacao');
    });
});

/* Empate exige perguntas em branco — com as 5 respondidas ele é impossível
   (5 é ímpar). Aí a pergunta 2 decide sozinha. */
describe('desempate pela pergunta 2', () => {
    it('empate 1x1 com a pergunta 2 em treinamento → treinamento', () => {
        responder(1, 'c'); // implementação
        responder(2, 'a'); // treinamento
        avancarSemResponder(3);
        expect(primario().getAttribute('href')).toContain('perfil=treinamento');
    });

    it('empate 1x1 com a pergunta 2 em implementação → implementação', () => {
        responder(1, 'a'); // treinamento
        responder(2, 'd'); // implementação
        avancarSemResponder(3);
        expect(primario().getAttribute('href')).toContain('perfil=implementacao');
    });

});

describe('navegação', () => {
    it('cada resposta avança uma etapa', () => {
        expect(etapaVisivel()).toBe(0);
        responder(1, 'a');
        expect(etapaVisivel()).toBe(1);
        responder(2, 'b');
        expect(etapaVisivel()).toBe(2);
    });

    it('a barra de progresso vai de 0% a 100%', () => {
        expect(largura()).toBe('0%');
        responder(1, 'a');
        expect(largura()).toBe('20%');
        [2, 3, 4].forEach((n) => responder(n, 'a'));
        expect(largura()).toBe('80%');
        responder(5, 'a');
        expect(largura()).toBe('100%');
    });

    it('o botão Voltar fica escondido na pergunta 1 e aparece depois', () => {
        const voltar = pagina.document.getElementById('quizBack');
        expect(voltar.hidden).toBe(true);
        responder(1, 'a');
        expect(voltar.hidden).toBe(false);
    });

    it('Voltar retrocede uma etapa', () => {
        responder(1, 'a');
        responder(2, 'a');
        clicarEm('#quizBack');
        expect(etapaVisivel()).toBe(1);
    });

    /* O handler é 'click', não 'change': quem volta e reconfirma a MESMA
       alternativa não dispara change e ficaria preso na tela. */
    it('reconfirmar a alternativa já marcada avança mesmo assim', () => {
        responder(1, 'a');
        responder(2, 'a');
        clicarEm('#quizBack');
        expect(etapaVisivel()).toBe(1);
        responder(2, 'a');
        expect(etapaVisivel()).toBe(2);
    });
});

describe('recomeçar', () => {
    it('limpa as respostas e volta para a pergunta 1', () => {
        [1, 2, 3, 4, 5].forEach((n) => responder(n, 'd'));
        expect(resultado().hidden).toBe(false);

        clicarEm('#quizRestart');

        expect(resultado().hidden).toBe(true);
        expect(pagina.document.getElementById('quizForm').hidden).toBe(false);
        expect(etapaVisivel()).toBe(0);
        expect(pagina.document.querySelectorAll('#quizForm input:checked').length).toBe(0);
    });
});

describe('privacidade do link de saída', () => {
    it('o href só carrega ?perfil=, sem nenhum dado pessoal', () => {
        [1, 2, 3, 4, 5].forEach((n) => responder(n, 'a'));
        const url = new URL(primario().getAttribute('href'), 'https://modobim.com.br/');
        expect([...url.searchParams.keys()]).toEqual(['perfil']);
        expect(url.searchParams.get('perfil')).toBe('treinamento');
    });

    it('os dois destinos possíveis são páginas do próprio site', () => {
        [1, 2, 3, 4, 5].forEach((n) => responder(n, 'a'));
        expect(primario().getAttribute('href')).toMatch(/^lista-espera\.html\?/);

        clicarEm('#quizRestart');
        [1, 2, 3, 4, 5].forEach((n) => responder(n, 'd'));
        expect(primario().getAttribute('href')).toMatch(/^cadastro\.html\?/);
    });
});

function clicarEm(seletor) {
    pagina.document.querySelector(seletor)
        .dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true }));
}

/* Avança sem acrescentar resposta: reclica um radio JÁ marcado. O handler é de
   'click' e não olha qual radio foi, então cada clique anda uma etapa; e como o
   radio já estava marcado, a contagem de picks não muda. É também o caminho real
   de quem volta e reconfirma a mesma alternativa. */
function avancarSemResponder(vezes) {
    const jaMarcado = pagina.document.querySelector('#quizForm input:checked');
    if (!jaMarcado) throw new Error('nenhuma alternativa marcada para reclicar');
    for (let i = 0; i < vezes; i++) {
        jaMarcado.dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true }));
    }
}
