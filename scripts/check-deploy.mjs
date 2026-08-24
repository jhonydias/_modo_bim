#!/usr/bin/env node
/**
 * Conferência do site DEPOIS de publicado. Rodar com:
 *
 *   npm run check:deploy                      → contra https://modobim.com.br
 *   npm run check:deploy -- --url http://...  → contra outro endereço
 *   npm run check:deploy -- --rapido          → pula o Lighthouse (só o HTTP, ~10s)
 *
 * Existe porque o GitHub Pages leva alguns minutos para publicar e, até publicar,
 * nada do que se mede localmente vale. Cobre os itens 2 e 3 da checagem pós-merge
 * da task 21, mais uma quarta parte que não estava na lista e devia estar (§C).
 *
 * Sai com código 1 se qualquer bloco reprovar, para dar para encadear em CI.
 *
 * Se a variável PSI_API_KEY estiver no ambiente, o §D usa a API do PageSpeed
 * Insights; sem chave ela devolve 429 quase sempre, então o padrão é rodar o
 * Lighthouse local, que é o mesmo motor da parte de laboratório do PSI.
 */
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/* ────────────────────────────── argumentos ────────────────────────────── */

const args = process.argv.slice(2);
const valorDe = (nome, padrao) => {
    const i = args.indexOf(nome);
    return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};
const BASE = valorDe('--url', 'https://modobim.com.br').replace(/\/+$/, '');
const RAPIDO = args.includes('--rapido');

/* ──────────────────────────── saída formatada ─────────────────────────── */

const VERDE = '\x1b[32m', VERMELHO = '\x1b[31m', AMARELO = '\x1b[33m', CINZA = '\x1b[90m', FIM = '\x1b[0m';
let reprovas = 0, avisos = 0;

const titulo = (t) => console.log(`\n${t}\n${'─'.repeat(t.length)}`);
function ok(msg, detalhe = '') {
    console.log(`  ${VERDE}✓${FIM} ${msg}${detalhe ? ` ${CINZA}${detalhe}${FIM}` : ''}`);
}
function falha(msg, detalhe = '') {
    reprovas++;
    console.log(`  ${VERMELHO}✗${FIM} ${msg}${detalhe ? ` ${VERMELHO}${detalhe}${FIM}` : ''}`);
}
function aviso(msg, detalhe = '') {
    avisos++;
    console.log(`  ${AMARELO}!${FIM} ${msg}${detalhe ? ` ${CINZA}${detalhe}${FIM}` : ''}`);
}
const conferir = (cond, msg, detalhe = '') => (cond ? ok(msg, detalhe) : falha(msg, detalhe));

/* ─────────────────────────────── HTTP ─────────────────────────────────── */

/** GET que nunca lança: devolve {status, headers, corpo} ou {erro}. */
async function buscar(url, { comCorpo = true } = {}) {
    try {
        const res = await fetch(url, {
            redirect: 'follow',
            headers: { 'Accept-Encoding': 'gzip, br', 'User-Agent': 'modobim-check-deploy' },
        });
        return {
            status: res.status,
            headers: Object.fromEntries(res.headers.entries()),
            corpo: comCorpo ? await res.text() : '',
            url: res.url,
        };
    } catch (e) {
        return { erro: e.message };
    }
}

/* ═══════════════════ §A — os arquivos respondem certo ═══════════════════ */
/* (item 2 da checagem: robots.txt, sitemap.xml e a página de erro)          */

async function bloco_A_arquivos() {
    titulo('A · robots.txt, sitemap.xml e 404');

    const robots = await buscar(`${BASE}/robots.txt`);
    if (robots.erro) falha('GET /robots.txt', robots.erro);
    else {
        conferir(robots.status === 200, 'GET /robots.txt responde 200', `(veio ${robots.status})`);
        conferir(robots.corpo.includes(`Sitemap: ${BASE}/sitemap.xml`),
            'robots.txt aponta o sitemap');
        conferir(/Disallow:\s*\/contrato\.html/.test(robots.corpo),
            'robots.txt tem Disallow para contrato.html');
    }

    const sitemap = await buscar(`${BASE}/sitemap.xml`);
    if (sitemap.erro) falha('GET /sitemap.xml', sitemap.erro);
    else {
        conferir(sitemap.status === 200, 'GET /sitemap.xml responde 200', `(veio ${sitemap.status})`);
        const locs = [...sitemap.corpo.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
        conferir(locs.length === 4, 'sitemap lista 4 URLs', `(listou ${locs.length})`);
        /* `every` sobre lista vazia devolve true: sem esta guarda, um sitemap que
           não existe passaria nas duas checagens abaixo e daria falso conforto. */
        conferir(locs.length > 0 && !sitemap.corpo.includes('contrato'),
            'sitemap NÃO lista contrato.html (é noindex)');
        conferir(locs.length > 0 && locs.every((l) => l.startsWith(BASE)),
            'toda <loc> está no domínio próprio');
        /* O Pages serve .xml como application/xml; se vier text/html é porque o
           arquivo não existe e caiu no 404, o que o status 200 acima esconderia
           quando há redirecionamento. */
        conferir(/xml/.test(sitemap.headers['content-type'] || ''),
            'sitemap.xml tem content-type de XML', `(veio ${sitemap.headers['content-type']})`);
        for (const loc of locs) {
            const r = await buscar(loc, { comCorpo: false });
            conferir(r.status === 200, `  URL do sitemap responde 200: ${loc.replace(BASE, '') || '/'}`,
                `(veio ${r.erro || r.status})`);
        }
    }

    /* Caminho inexistente tem de dar 404 de verdade — e, num Pages com
       404.html na raiz, o corpo é a nossa página, não a do GitHub. */
    const inexistente = await buscar(`${BASE}/pagina-que-nao-existe-${Date.now().toString(36)}`);
    if (inexistente.erro) falha('GET de caminho inexistente', inexistente.erro);
    else {
        conferir(inexistente.status === 404, 'caminho inexistente responde 404',
            `(veio ${inexistente.status})`);
        conferir(/Esta página não/.test(inexistente.corpo),
            'o 404 servido é o nosso 404.html, não o do GitHub');
        conferir(/content="noindex/.test(inexistente.corpo), 'o 404 é noindex');
        /* O 404 é servido em QUALQUER caminho: se os links dele fossem relativos,
           quebrariam. Esta é a checagem que prova que ficaram raiz-absolutos. */
        const relativos = [...inexistente.corpo.matchAll(/(?:href|src)="(?!https?:|\/|#|mailto:|tel:|data:)([^"]+)"/g)];
        conferir(relativos.length === 0, 'o 404 não tem link relativo',
            relativos.length ? `(${relativos.slice(0, 3).map((m) => m[1]).join(', ')})` : '');
    }
}

/* ═══════════════ §B — a identidade do site está no ar certa ═════════════ */

async function bloco_B_identidade() {
    titulo('B · identidade das páginas (canonical, OG, JSON-LD)');

    const PAGINAS = ['/', '/cadastro.html', '/contrato.html', '/lista-espera.html', '/produtos.html'];
    for (const p of PAGINAS) {
        const r = await buscar(BASE + p);
        const nome = p === '/' ? 'index' : p.replace(/^\/|\.html$/g, '');
        if (r.erro || r.status !== 200) { falha(`${nome}: GET`, r.erro || `status ${r.status}`); continue; }

        const canonical = (r.corpo.match(/rel="canonical" href="([^"]+)"/) || [])[1];
        const problemas = [];
        if (!canonical) problemas.push('sem canonical');
        else if (!canonical.startsWith(BASE)) problemas.push(`canonical fora do domínio: ${canonical}`);
        if (/jhonydias\.github\.io/.test(r.corpo)) problemas.push('ainda cita jhonydias.github.io');
        if (/fontshare|googleapis|gstatic/.test(r.corpo)) problemas.push('ainda cita CDN de fonte de terceiro');
        if (!/property="og:type"/.test(r.corpo)) problemas.push('sem og:type');
        if (!/name="twitter:card" content="summary_large_image"/.test(r.corpo)) problemas.push('sem twitter:card');

        for (const bloco of r.corpo.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
            try { JSON.parse(bloco[1]); } catch (e) { problemas.push(`JSON-LD inválido: ${e.message}`); }
        }
        const esperaLd = nome !== 'contrato';
        const temLd = /application\/ld\+json/.test(r.corpo);
        if (esperaLd && !temLd) problemas.push('sem JSON-LD');

        const robots = (r.corpo.match(/name="robots" content="([^"]+)"/) || [])[1] || '';
        if (nome === 'contrato' && !/noindex/.test(robots)) problemas.push('contrato deveria ser noindex');
        if (nome !== 'contrato' && /noindex/.test(robots)) problemas.push('página indexável marcada como noindex');

        if (problemas.length) falha(`${nome}`, problemas.join(' · '));
        else ok(`${nome}`, `canonical ${canonical.replace(BASE, '') || '/'}${temLd ? ' · JSON-LD ok' : ''}`);
    }

    const og = await buscar(`${BASE}/og-image.png`, { comCorpo: false });
    conferir(og.status === 200 && /image\/png/.test(og.headers['content-type'] || ''),
        'og-image.png responde 200 e continua PNG',
        `(${og.status} ${og.headers?.['content-type'] || ''})`);
}

/* ══════ §C — a tipografia e as imagens chegaram (o erro que passou perto) ══ */

async function bloco_C_assets() {
    titulo('C · fontes e imagens realmente servidas');
    console.log(`  ${CINZA}Este bloco não estava na checagem original. Está aqui porque o erro que`);
    console.log(`  mais passou perto na task 21 foi o @font-face não entrar em três páginas:`);
    console.log(`  o site rodou inteiro no fallback Georgia/Arial e as capturas pareciam certas.${FIM}`);

    const PAGINAS = ['/', '/cadastro.html', '/contrato.html', '/lista-espera.html', '/produtos.html'];
    const referenciados = new Set();

    for (const p of PAGINAS) {
        const r = await buscar(BASE + p);
        if (r.erro || r.status !== 200) { falha(`${p}: GET`, r.erro || `status ${r.status}`); continue; }
        const nome = p === '/' ? 'index' : p.replace(/^\/|\.html$/g, '');

        const faces = (r.corpo.match(/@font-face/g) || []).length;
        const preloads = (r.corpo.match(/rel="preload" as="font"/g) || []).length;
        if (faces === 0) falha(`${nome}: nenhum @font-face`, 'a página vai renderizar no fallback do sistema');
        else if (preloads === 0) aviso(`${nome}: ${faces} @font-face, mas nenhum preload`);
        else ok(`${nome}`, `${faces} @font-face · ${preloads} preload de fonte`);

        for (const m of r.corpo.matchAll(/(?:href|src|poster)="((?:fonts|img|js)\/[^"]+)"/g)) referenciados.add(m[1]);
        for (const m of r.corpo.matchAll(/srcset="([^"]+)"/g)) {
            for (const parte of m[1].split(',')) {
                const u = parte.trim().split(/\s+/)[0];
                if (u && /^(fonts|img)\//.test(u)) referenciados.add(u);
            }
        }
        /* url() do CSS embutido. Sem isto ficavam de fora justamente os quatro pesos
           de Sentient que NÃO são pré-carregados (500, 700 e os dois itálicos) e o
           logo das páginas de formulário — arquivos que só o @font-face e o
           background-image citam, e que sumiriam sem ninguém notar se a pasta
           fonts/ não fosse publicada. */
        for (const m of r.corpo.matchAll(/url\(\s*['"]?((?:fonts|img)\/[^'")]+)['"]?\s*\)/g)) {
            referenciados.add(m[1]);
        }
    }

    const lista = [...referenciados].sort();
    console.log(`  ${CINZA}conferindo ${lista.length} arquivos referenciados…${FIM}`);
    const quebrados = [];
    for (const rel of lista) {
        const r = await buscar(`${BASE}/${rel}`, { comCorpo: false });
        if (r.erro || r.status !== 200) quebrados.push(`${rel} → ${r.erro || r.status}`);
    }
    conferir(quebrados.length === 0, `todos os ${lista.length} arquivos referenciados respondem 200`,
        quebrados.length ? `\n      ${quebrados.join('\n      ')}` : '');

    const woff2 = lista.filter((f) => f.endsWith('.woff2'));
    conferir(woff2.length > 0, 'a página referencia arquivos .woff2 próprios',
        `(${woff2.length} arquivos)`);
}

/* ═════════════ §D — Lighthouse / PSI na home (item 3 da checagem) ════════ */

/** Régua do §2.2 da task 21. */
const MINIMOS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 100 };
const ROTULO = { performance: 'Performance', accessibility: 'Acessibilidade', 'best-practices': 'Boas práticas', seo: 'SEO' };

async function viaPSI(chave) {
    const u = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    u.searchParams.set('url', BASE + '/');
    u.searchParams.set('strategy', 'mobile');
    for (const c of Object.keys(MINIMOS)) u.searchParams.append('category', c);
    u.searchParams.set('key', chave);
    const res = await fetch(u);
    if (!res.ok) throw new Error(`PSI respondeu ${res.status}`);
    return (await res.json()).lighthouseResult;
}

function viaLighthouseLocal() {
    const saida = path.join(tmpdir(), `lh-modobim-${process.pid}.json`);
    /* Comando montado como string única, com as aspas escritas por mim.
       Duas armadilhas já pagas aqui:
       - passar os argumentos em array com `shell: true` faz o Node concatenar
         sem escapar, e o --chrome-flags (que tem espaços) chega partido;
       - chamar `npx.cmd` com `shell: false` dá EINVAL no Node 24 no Windows,
         que desde a correção de segurança recusa executar .cmd sem shell.
       Aspas duplas delimitam um argumento só tanto no cmd.exe quanto no sh. */
    const comando = [
        'npx -y lighthouse@12',
        `"${BASE}/"`,
        '--quiet',
        '"--chrome-flags=--headless=new --no-sandbox --disable-gpu"',
        `--only-categories=${Object.keys(MINIMOS).join(',')}`,
        '--output=json',
        `"--output-path=${saida}"`,
    ].join(' ');
    try {
        execSync(comando, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
        /* O Lighthouse às vezes sai com código != 0 mas grava o relatório do
           mesmo jeito (avisos de protocolo). Só desiste se o arquivo não existir. */
        const detalhe = (e.stderr?.toString() || e.message).split('\n').filter(Boolean).slice(-2).join(' | ');
        try { readFileSync(saida); } catch { throw new Error(detalhe.slice(0, 200)); }
    }
    const r = JSON.parse(readFileSync(saida, 'utf8'));
    rmSync(saida, { force: true });
    return r;
}

async function bloco_D_lighthouse() {
    titulo('D · Lighthouse mobile na home');

    const chave = process.env.PSI_API_KEY;
    let r, origem;
    try {
        if (chave) { r = await viaPSI(chave); origem = 'API do PageSpeed Insights'; }
        else {
            console.log(`  ${CINZA}sem PSI_API_KEY no ambiente — rodando o Lighthouse local`);
            console.log(`  (mesmo motor da parte de laboratório do PSI; leva ~1 min)${FIM}`);
            r = viaLighthouseLocal();
            origem = 'Lighthouse local';
        }
    } catch (e) {
        aviso('não deu para medir', e.message);
        console.log(`  ${CINZA}Rode à mão: https://pagespeed.web.dev/analysis?url=${encodeURIComponent(BASE + '/')}${FIM}`);
        return;
    }

    if (r.runtimeError) { falha('Lighthouse não conseguiu carregar a página', r.runtimeError.message); return; }
    console.log(`  ${CINZA}fonte: ${origem}${FIM}`);

    for (const [cat, minimo] of Object.entries(MINIMOS)) {
        const nota = Math.round((r.categories[cat]?.score ?? 0) * 100);
        conferir(nota >= minimo, `${ROTULO[cat].padEnd(15)} ${String(nota).padStart(3)}`, `(mínimo ${minimo})`);
    }

    const num = (k) => r.audits[k]?.numericValue;
    const METRICAS = [
        ['LCP', 'largest-contentful-paint', 2500, 'ms'],
        ['FCP', 'first-contentful-paint', 1800, 'ms'],
        ['TBT', 'total-blocking-time', 200, 'ms'],
        ['CLS', 'cumulative-layout-shift', 0.1, ''],
        ['TTFB', 'server-response-time', 800, 'ms'],
    ];
    console.log('');
    for (const [nome, id, teto, un] of METRICAS) {
        const v = num(id);
        if (v == null) continue;
        const valor = un === 'ms' ? Math.round(v) : Number(v.toFixed(3));
        conferir(valor <= teto, `${nome.padEnd(5)} ${String(valor).padStart(6)}${un}`, `(máximo ${teto}${un})`);
    }

    const lcpEl = r.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet;
    if (lcpEl) console.log(`  ${CINZA}elemento do LCP: ${String(lcpEl).slice(0, 70)}${FIM}`);

    const bloqueantes = r.audits['render-blocking-resources']?.details?.items || [];
    conferir(bloqueantes.length === 0, 'nenhum recurso bloqueando o render',
        bloqueantes.length ? `(${bloqueantes.map((i) => i.url).join(', ')})` : '');

    const terceiros = (r.audits['third-party-summary']?.details?.items || []);
    conferir(terceiros.length === 0, 'nenhuma origem de terceiro',
        terceiros.length ? `(${terceiros.map((i) => i.entity).join(', ')})` : '');
}

/* ─────────────────────────────── execução ─────────────────────────────── */

console.log(`\nConferindo ${BASE}`);
await bloco_A_arquivos();
await bloco_B_identidade();
await bloco_C_assets();
if (RAPIDO) console.log(`\n${CINZA}D · Lighthouse pulado (--rapido)${FIM}`);
else await bloco_D_lighthouse();

console.log('');
if (reprovas) {
    console.log(`${VERMELHO}${reprovas} checagem(ns) reprovada(s)${FIM}${avisos ? `, ${avisos} aviso(s)` : ''}.`);
    process.exit(1);
}
console.log(`${VERDE}Tudo certo${FIM}${avisos ? ` — ${avisos} aviso(s) acima` : ''}.`);
