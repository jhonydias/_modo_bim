/* Task 19 §3.9 e §3.10 — menu, revelação de texto, FAQ, selecionador e produtos.html.
 *
 * O que depende de layout real (altura da seção "quem somos", CTAs lado a lado)
 * não cabe no jsdom e vive no E2E. Aqui fica o que é estrutura e estado.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadPage } from './helpers/loadPage.js';

let pagina;
afterEach(() => pagina?.fechar());

const clicar = (seletor) => {
    const el = pagina.document.querySelector(seletor);
    if (!el) throw new Error(`elemento "${seletor}" não existe`);
    el.dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    return el;
};

describe('menu do index.html', () => {
    beforeEach(() => { pagina = loadPage('index.html'); });

    const menu = () => pagina.document.getElementById('navLinks');
    const botao = () => pagina.document.getElementById('navToggle');

    it('começa fechado, com aria-expanded false', () => {
        expect(menu().classList.contains('open')).toBe(false);
        expect(botao().getAttribute('aria-expanded')).toBe('false');
    });

    it('abre e fecha no clique do botão, e o aria-expanded acompanha', () => {
        clicar('#navToggle');
        expect(menu().classList.contains('open')).toBe(true);
        expect(botao().getAttribute('aria-expanded')).toBe('true');

        clicar('#navToggle');
        expect(menu().classList.contains('open')).toBe(false);
        expect(botao().getAttribute('aria-expanded')).toBe('false');
    });

    it('fecha ao escolher um link', () => {
        clicar('#navToggle');
        pagina.document.querySelector('#navLinks a')
            .dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true }));
        expect(menu().classList.contains('open')).toBe(false);
    });

    it('fecha ao clicar fora', () => {
        clicar('#navToggle');
        pagina.document.body.dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true }));
        expect(menu().classList.contains('open')).toBe(false);
    });

    it('fecha no Escape', () => {
        clicar('#navToggle');
        pagina.document.dispatchEvent(new pagina.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(menu().classList.contains('open')).toBe(false);
    });
});

describe('splitReveal', () => {
    beforeEach(() => { pagina = loadPage('index.html'); });

    it('quebra o texto em spans .rt-w > i', () => {
        const alvo = pagina.document.querySelector('.cta-final .rt') ?? pagina.document.querySelector('.rt');
        expect(alvo.querySelectorAll('.rt-w > i').length).toBeGreaterThan(3);
    });

    it('preserva <em> e <br> dentro do texto quebrado', () => {
        const comEm = [...pagina.document.querySelectorAll('.rt')].find((n) => n.querySelector('em'));
        expect(comEm, 'nenhum .rt com <em> na página').toBeTruthy();
        expect(comEm.querySelector('em')).toBeTruthy();
        expect(comEm.querySelectorAll('em .rt-w').length).toBeGreaterThan(0);
    });

    it('a página aplica uma única passada: nenhum .rt-w dentro de outro', () => {
        expect(pagina.document.querySelectorAll('.rt-w .rt-w').length).toBe(0);
    });

    /* splitReveal NÃO é idempotente: rodar de novo no mesmo nó envolve os
       wrappers existentes outra vez e dobra a contagem. Hoje isso não acontece
       porque a página o chama uma vez só, no carregamento. O teste congela a
       limitação — quem for chamá-lo de novo (num resize, por exemplo) precisa
       saber que tem de restaurar o texto antes. */
    it('rodar duas vezes duplica os wrappers (limitação conhecida)', () => {
        const alvo = pagina.document.querySelector('.rt');
        const antes = alvo.querySelectorAll('.rt-w').length;
        pagina.window.splitReveal(alvo);
        expect(alvo.querySelectorAll('.rt-w').length).toBe(antes * 2);
        // o texto visível, porém, continua o mesmo — não há perda de conteúdo
        expect(alvo.textContent.replace(/\s+/g, ' ').trim().length).toBeGreaterThan(0);
    });

    /* Com reduced-motion o splitReveal nem roda: o texto fica inteiro, visível. */
    it('não roda com prefers-reduced-motion', () => {
        const reduzida = loadPage('index.html', { reducedMotion: true });
        expect(reduzida.document.querySelectorAll('.rt-w').length).toBe(0);
        expect(reduzida.document.querySelector('.rt').textContent.trim().length).toBeGreaterThan(10);
        reduzida.fechar();
    });
});

describe('FAQ', () => {
    beforeEach(() => { pagina = loadPage('index.html'); });

    const itens = () => [...pagina.document.querySelectorAll('.faq-item')];
    const abrir = (i) => itens()[i].querySelector('.faq-q')
        .dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true }));

    it('abre um item e marca aria-expanded', () => {
        abrir(0);
        expect(itens()[0].classList.contains('open')).toBe(true);
        expect(itens()[0].querySelector('.faq-q').getAttribute('aria-expanded')).toBe('true');
    });

    it('é acordeão exclusivo: abrir um fecha o outro', () => {
        abrir(0);
        abrir(1);
        expect(itens()[0].classList.contains('open')).toBe(false);
        expect(itens()[1].classList.contains('open')).toBe(true);
        expect(itens()[0].querySelector('.faq-q').getAttribute('aria-expanded')).toBe('false');
    });

    it('clicar no aberto fecha', () => {
        abrir(0);
        abrir(0);
        expect(itens()[0].classList.contains('open')).toBe(false);
    });
});

describe('selecionador de seção', () => {
    beforeEach(() => { pagina = loadPage('index.html'); });

    it('setActive marca um único .sec-link', () => {
        pagina.window.setActive(2);
        const ativos = pagina.document.querySelectorAll('.sec-link.active');
        expect(ativos.length).toBe(1);
        expect(ativos[0].dataset.target).toBe(pagina.evalIn('panelIds')[2]);
    });

    it('setActive(-1) não deixa nenhum marcado e apaga o indicador', () => {
        pagina.window.setActive(2);
        pagina.window.setActive(-1);
        expect(pagina.document.querySelectorAll('.sec-link.active').length).toBe(0);
        expect(pagina.document.querySelector('.sec-indicator').style.opacity).toBe('0');
    });

    it('os alvos do selecionador existem na página', () => {
        for (const id of pagina.evalIn('panelIds')) {
            expect(pagina.document.getElementById(id), `painel #${id} não existe`).toBeTruthy();
        }
    });
});

describe('rodapé e ano', () => {
    beforeEach(() => { pagina = loadPage('index.html'); });

    it('#year mostra o ano corrente', () => {
        expect(pagina.document.getElementById('year').textContent)
            .toBe(String(new Date().getFullYear()));
    });
});

describe('revelação por IntersectionObserver', () => {
    beforeEach(() => { pagina = loadPage('index.html'); });

    it('elementos .reveal recebem .in quando entram em cena', () => {
        const antes = pagina.document.querySelectorAll('.reveal.in').length;
        pagina.dispararTodosObservers();
        expect(pagina.document.querySelectorAll('.reveal.in').length).toBeGreaterThan(antes);
    });
});

describe('produtos.html', () => {
    beforeEach(() => { pagina = loadPage('produtos.html'); });

    it('o menu abre e fecha como no index', () => {
        clicar('#navToggle');
        expect(pagina.document.getElementById('navLinks').classList.contains('open')).toBe(true);
        pagina.document.dispatchEvent(new pagina.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(pagina.document.getElementById('navLinks').classList.contains('open')).toBe(false);
    });

    it('os blocos .reveal aparecem quando o observer dispara', () => {
        pagina.dispararTodosObservers();
        const total = pagina.document.querySelectorAll('.reveal').length;
        expect(pagina.document.querySelectorAll('.reveal.in').length).toBe(total);
    });

    it('marca a própria página no menu com aria-current', () => {
        expect(pagina.document.querySelector('[aria-current="page"]').getAttribute('href'))
            .toBe('produtos.html');
    });

    it('os destinos dos CTAs são os atuais', () => {
        const hrefs = [...pagina.document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
        expect(hrefs).toContain('cadastro.html');            // proposta
        expect(hrefs).toContain('lista-espera.html');        // rodapé
        expect(hrefs).toContain('https://tally.so/r/7RYDZ0'); // card do diagnóstico
        expect(hrefs.some((h) => h.startsWith('https://chat.whatsapp.com/'))).toBe(true);
    });

    it('todo link externo abre em nova aba com rel=noopener', () => {
        const externos = [...pagina.document.querySelectorAll('a[href^="http"]')]
            .filter((a) => !a.href.includes('fonts.googleapis') && !a.href.includes('api.fontshare'));
        expect(externos.length).toBeGreaterThan(0);
        for (const a of externos) {
            expect(a.getAttribute('target'), a.getAttribute('href')).toBe('_blank');
            expect(a.getAttribute('rel'), a.getAttribute('href')).toContain('noopener');
        }
    });
});
