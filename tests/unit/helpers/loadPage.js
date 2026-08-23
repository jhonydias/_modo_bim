/* Task 19 §2.1 — carregar uma página do site dentro do jsdom sem refatorar o site.
 *
 * O JS das páginas vive inline, em <script> clássico, sem IIFE e sem
 * DOMContentLoaded. Consequência: toda `function` declarada no topo vira
 * propriedade de window, e é isso que torna o teste unitário possível.
 *
 * Desde a task 20 existe também um <script src="js/config.js">, que define
 * window.MODOBIM_CONFIG. Ele precisa ser avaliado ANTES do inline — na ordem do
 * navegador. Sem isso, ENDPOINT_URL sai vazio e todo teste de envio testaria o
 * caminho de erro de configuração.
 */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

const raiz = (p) => new URL(`../../../${p}`, import.meta.url);

export function lerArquivo(caminhoRelativo) {
    return readFileSync(raiz(caminhoRelativo), 'utf8');
}

/**
 * @param {string} file  página na raiz do repo, ex.: 'cadastro.html'
 * @param {object} opts
 *   config: 'real'  → avalia js/config.js do repo (default)
 *           null    → simula js/config.js que não carregou (404)
 *           objeto  → MODOBIM_CONFIG sob medida, ex.: { ENDPOINT_URL:'x', DEV_MODE:true }
 *   url:    URL da página no jsdom
 *   reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
 *   width:  window.innerWidth (index.html decide o modo horizontal por ele)
 */
export function loadPage(file, opts = {}) {
    const {
        config = 'real',
        url = 'http://localhost:4173/' + file,
        reducedMotion = false,
        width = 1280
    } = opts;

    const html = lerArquivo(file);
    const dom = new JSDOM(html, {
        url,
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    const w = dom.window;

    const stubs = stubMissingApis(w, { reducedMotion, width });

    // 1) o <script src> primeiro, na mesma ordem do navegador
    if (config === 'real') w.eval(lerArquivo('js/config.js'));
    else if (config !== null) w.MODOBIM_CONFIG = config;
    // config === null → nada: MODOBIM_CONFIG fica undefined, como num 404

    // 2) só então os scripts inline
    const inline = [...w.document.querySelectorAll('script:not([src])')]
        .map((s) => s.textContent)
        .join('\n');

    /* Declarações `const`/`let` dentro de um eval ficam num escopo léxico
       próprio e somem quando ele termina — window.ENDPOINT_URL não existe, e um
       segundo w.eval('ENDPOINT_URL') dá ReferenceError. A saída é deixar, dentro
       do MESMO eval, uma janela para esse escopo: um eval direto dentro de uma
       função declarada ali enxerga tudo o que a página declarou. */
    w.eval(inline + '\n;window.__escopo = (expr) => eval(expr);');

    return {
        dom,
        window: w,
        document: w.document,
        /* CONFIG, ENDPOINT_URL, DEV_MODE, FORM_TYPE, totalSteps e formData são
           `const`/`let` do escopo do script: não estão em window. Só se leem por
           aqui. Funções (`function` no topo) estão em window normalmente. */
        evalIn: (expr) => w.__escopo(expr),
        ...stubs,
        fechar: () => dom.window.close()
    };
}

/* O jsdom não implementa IntersectionObserver, matchMedia, scrollTo,
   scrollIntoView nem HTMLMediaElement.play — todos usados pelas páginas. */
function stubMissingApis(w, { reducedMotion, width }) {
    const observers = [];

    class FakeIntersectionObserver {
        constructor(cb, options = {}) {
            this.cb = cb;
            this.options = options;
            this.elements = [];
            observers.push(this);
        }
        observe(el) {
            this.elements.push(el);
        }
        unobserve(el) {
            this.elements = this.elements.filter((e) => e !== el);
        }
        disconnect() {
            this.elements = [];
        }
        /* O teste decide quando "entrou em cena". */
        trigger(alvos = this.elements, isIntersecting = true) {
            const entries = alvos.map((target) => ({
                target,
                isIntersecting,
                intersectionRatio: isIntersecting ? 1 : 0,
                boundingClientRect: target.getBoundingClientRect()
            }));
            this.cb(entries, this);
        }
    }
    w.IntersectionObserver = FakeIntersectionObserver;

    w.matchMedia = (query) => ({
        media: query,
        matches: /prefers-reduced-motion/.test(query) ? reducedMotion : false,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false
    });

    w.scrollTo = vi.fn();
    w.Element.prototype.scrollIntoView = vi.fn();
    w.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    w.HTMLMediaElement.prototype.pause = vi.fn();
    w.requestAnimationFrame = (cb) => w.setTimeout(() => cb(Date.now()), 0);
    w.cancelAnimationFrame = (id) => w.clearTimeout(id);
    w.fetch = vi.fn();

    Object.defineProperty(w, 'innerWidth', { value: width, writable: true, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: 900, writable: true, configurable: true });

    /* jsdom devolve zeros em toda medida. lockHeight() e measureH() dividem por
       essas medidas; zero não quebra, mas deixa o teste sem sinal. Números
       plausíveis e estáveis bastam. */
    w.Element.prototype.getBoundingClientRect = function () {
        const largura = this.tagName === 'HTML' || this.tagName === 'BODY' ? width : 320;
        return {
            x: 0, y: 0, top: 0, left: 0, right: largura, bottom: 240,
            width: largura, height: 240,
            toJSON() { return this; }
        };
    };

    return {
        observers,
        /* Dispara todos os IOs criados pela página (revelações, contadores, vídeos). */
        dispararTodosObservers() {
            observers.forEach((o) => o.elements.length && o.trigger());
        }
    };
}

/** Aguarda a fila de microtasks/timers do jsdom drenar (submits são async). */
export function proximaVolta(w, voltas = 3) {
    return new Promise((resolve) => {
        let n = 0;
        const passo = () => (++n >= voltas ? resolve() : w.setTimeout(passo, 0));
        w.setTimeout(passo, 0);
    });
}
