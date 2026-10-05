#!/usr/bin/env node
/* ============================================================
 *  notion-bootstrap.mjs — setup dos databases do Notion (task 08)
 * ============================================================
 *  Faz por API o que os passos 2, 4 e 6 de tasks/08/notion-integracao.md
 *  descrevem na mão: cria os databases com os nomes e tipos de coluna
 *  que buildNotionProps_() (script/Code.gs) espera, grava uma página
 *  [TESTE] em cada um e devolve os IDs para as Propriedades do script
 *  do Apps Script.
 *
 *  Os schemas moram em script/notion-schema.mjs (task 22) — este
 *  arquivo é só a linha de comando em volta deles.
 *
 *  Só é preciso rodar de novo se os databases forem recriados —
 *  trocar o token da integração NÃO exige nada disto.
 *
 *  Requisitos: Node 18+ (usa fetch nativo). Nenhuma dependência.
 *
 *  O token NUNCA fica no arquivo — vem do ambiente:
 *
 *    PowerShell   $env:NOTION_TOKEN = 'ntn_...'
 *    bash         export NOTION_TOKEN=ntn_...
 *
 *  Comandos:
 *
 *    node script/notion-bootstrap.mjs check     # token + acesso às páginas
 *    node script/notion-bootstrap.mjs create    # cria os databases
 *    node script/notion-bootstrap.mjs verify    # confere colunas/tipos/opções do que já existe
 *    node script/notion-bootstrap.mjs seed      # grava uma página [TESTE] em cada
 *    node script/notion-bootstrap.mjs cleanup   # arquiva as páginas [TESTE]
 *    node script/notion-bootstrap.mjs all       # check + create + verify + seed
 *
 *  Todos aceitam um alvo opcional — `orcamentos`, `cadastros` ou
 *  `listaEspera` — para agir em um só database. Sem ele, agem nos três:
 *
 *    node script/notion-bootstrap.mjs all orcamentos
 *
 *  Antes de qualquer coisa: conecte a integração às páginas
 *  (••• › Connections › Connect to). Sem isso a API responde
 *  404 object_not_found mesmo para páginas que existem.
 * ============================================================ */

import { DBS, ENV_DB, SCHEMAS, SEEDS } from './notion-schema.mjs';

const TOKEN = process.env.NOTION_TOKEN;
const API = 'https://api.notion.com/v1/';
const VERSION = '2022-06-28';   // mesma de NOTION.VERSION em Code.gs

/* ============================================================
 *  API
 * ============================================================ */

async function notion(path, method = 'GET', body) {
    const res = await fetch(API + path, {
        method,
        headers: {
            'Authorization': 'Bearer ' + TOKEN,
            'Notion-Version': VERSION,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
}

let falhas = 0;

/* Alvo opcional na linha de comando: age em um database só. */
let ALVO = null;
const alvos = () => Object.entries(SCHEMAS).filter(([key]) => !ALVO || key === ALVO);

async function step(label, fn) {
    const r = await fn();
    if (r.ok) {
        console.log(`  [OK]   ${label}`);
    } else {
        falhas++;
        console.log(`  [ERRO] ${label} — HTTP ${r.status} ${r.json.code || ''}`);
        console.log(`         ${(r.json.message || JSON.stringify(r.json)).substring(0, 300)}`);
    }
    return r;
}

/* Tipo que o schema local pede para uma propriedade: a chave única do
 * objeto ({ rich_text: {} } → 'rich_text'). É o mesmo vocabulário que a
 * API devolve em `property.type`, então dá para comparar direto. */
const tipoLocal = def => Object.keys(def)[0];

const opcoesLocais = def => (def.select?.options || def.multi_select?.options || []).map(o => o.name);
const opcoesRemotas = prop => (prop.select?.options || prop.multi_select?.options || []).map(o => o.name);

/* ============================================================
 *  COMANDOS
 * ============================================================ */

async function check() {
    console.log('\n· Verificando token e acesso às páginas');

    const me = await step('token válido', () => notion('users/me'));
    if (me.ok) console.log(`         integração: ${me.json.name}`);

    for (const [key, schema] of alvos()) {
        const r = await step(`página "${key}" acessível`, () => notion('pages/' + schema.page));
        if (r.ok) {
            const t = Object.values(r.json.properties || {}).find(p => p.type === 'title');
            console.log(`         "${t?.title?.[0]?.plain_text ?? '(sem título)'}"`);
        } else if (r.status === 404) {
            console.log('         → conecte a integração: ••• › Connections › Connect to');
        }
    }
    return falhas === 0;
}

async function create() {
    console.log('\n· Criando os databases');

    for (const [key, schema] of alvos()) {
        const r = await step(`database "${schema.title}"`, () => notion('databases', 'POST', {
            parent: { type: 'page_id', page_id: schema.page },
            title: [{ type: 'text', text: { content: schema.title } }],
            is_inline: true,
            properties: schema.properties,
        }));
        if (r.ok) {
            DBS[key] = r.json.id;
            console.log(`         id:  ${r.json.id.replace(/-/g, '')}`);
            console.log(`         url: ${r.json.url}`);
            console.log(`         → cole este id em ${ENV_DB[key]} (Propriedades do Apps Script)`);
            console.log(`           e no DBS de script/notion-schema.mjs`);
        }
    }
}

/* Compara o database que está no ar com o schema local. Existe porque
 * `create` só prova que a criação passou naquele dia: quem edita uma
 * coluna pela interface do Notion (renomear, trocar Text por Select)
 * quebra a gravação silenciosamente — o lead vai para a "Fila Notion" e
 * fica lá. `verify` é o que transforma isso em uma mensagem legível. */
async function verify() {
    console.log('\n· Conferindo os databases contra o schema local');

    for (const [key, schema] of alvos()) {
        if (!DBS[key]) {
            falhas++;
            console.log(`  [ERRO] "${schema.title}" — sem ID de database; rode \`create ${key}\` antes ou defina ${ENV_DB[key]}`);
            continue;
        }

        const r = await notion('databases/' + DBS[key]);
        if (!r.ok) {
            falhas++;
            console.log(`  [ERRO] "${schema.title}" — HTTP ${r.status} ${r.json.code || ''}`);
            if (r.status === 404) console.log('         → ID errado ou integração sem acesso (••• › Connections).');
            continue;
        }

        const remoto = r.json.properties || {};
        const problemas = [];

        for (const [nome, def] of Object.entries(schema.properties)) {
            const prop = remoto[nome];
            if (!prop) {
                problemas.push(`falta a coluna "${nome}" (${tipoLocal(def)})`);
                continue;
            }
            if (prop.type !== tipoLocal(def)) {
                problemas.push(`"${nome}" é ${prop.type} no Notion, deveria ser ${tipoLocal(def)}`);
                continue;
            }
            // Opção faltando não quebra a gravação (a API cria a opção sozinha),
            // mas quebra filtro e agrupamento salvos — por isso avisa, sem falhar.
            const faltando = opcoesLocais(def).filter(o => !opcoesRemotas(prop).includes(o));
            if (faltando.length) console.log(`  [aviso] "${schema.title}" · "${nome}" sem as opções: ${faltando.join(', ')}`);
        }

        const sobrando = Object.keys(remoto).filter(n => !schema.properties[n]);

        if (problemas.length) {
            falhas++;
            console.log(`  [ERRO] "${schema.title}" — ${problemas.length} divergência(s):`);
            problemas.forEach(p => console.log(`         · ${p}`));
        } else {
            console.log(`  [OK]   "${schema.title}" — ${Object.keys(schema.properties).length} colunas conferem`);
        }
        // Coluna a mais é inofensiva para a gravação: só aparece para o caso de
        // ter sido criada por engano (ou de o schema local estar desatualizado).
        if (sobrando.length) console.log(`  [aviso] "${schema.title}" tem colunas fora do schema: ${sobrando.join(', ')}`);
    }
}

async function seed() {
    console.log('\n· Gravando as páginas [TESTE]');
    const hoje = new Date().toISOString().slice(0, 10);

    for (const [key, schema] of alvos()) {
        if (!DBS[key]) {
            falhas++;
            console.log(`  [ERRO] "${schema.title}" — sem ID de database; rode \`create\` antes ou defina ${ENV_DB[key]}`);
            continue;
        }
        await step(`página [TESTE] em "${schema.title}"`, () => notion('pages', 'POST', {
            parent: { database_id: DBS[key] },
            properties: SEEDS[key](hoje),
        }));
    }

    console.log('\n  Confira no Notion e depois rode `cleanup` para apagá-las.');
}

async function cleanup() {
    console.log('\n· Arquivando as páginas [TESTE]');

    for (const [key, schema] of alvos()) {
        if (!DBS[key]) {
            falhas++;
            console.log(`  [ERRO] "${schema.title}" — sem ID de database; rode \`create\` antes ou defina ${ENV_DB[key]}`);
            continue;
        }
        const q = await notion(`databases/${DBS[key]}/query`, 'POST', {});
        if (!q.ok) {
            falhas++;
            console.log(`  [ERRO] consultar "${schema.title}" — HTTP ${q.status} ${q.json.code || ''}`);
            // 404 aqui é ambíguo: pode ser falta de conexão com a integração
            // ou o database estar na lixeira — a consulta responde igual nos dois casos.
            if (q.status === 404) {
                const db = await notion('databases/' + DBS[key]);
                if (db.ok && db.json.in_trash) console.log('         → o database está na lixeira do Notion; restaure antes.');
                else if (!db.ok) console.log('         → ID errado ou integração sem acesso (••• › Connections).');
            }
            continue;
        }

        const testes = q.json.results.filter(pg => {
            const t = Object.values(pg.properties).find(p => p.type === 'title');
            return (t?.title?.[0]?.plain_text || '').startsWith('[TESTE]');
        });

        if (!testes.length) {
            console.log(`  [OK]   "${schema.title}" — nada a apagar`);
            continue;
        }

        for (const pg of testes) {
            const r = await step(`arquivar ${pg.id} em "${schema.title}"`,
                () => notion('pages/' + pg.id, 'PATCH', { archived: true }));
            // Arquivar exige a capability "Update content"; só "Insert content" devolve 403.
            if (r.status === 403) console.log('         → a integração precisa da capability "Update content", ou apague à mão.');
        }
    }
}

/* ============================================================ */

const COMANDOS = { check, create, verify, seed, cleanup };

(async () => {
    if (!TOKEN) {
        console.error('NOTION_TOKEN não definido no ambiente. Veja o cabeçalho deste arquivo.');
        process.exit(1);
    }

    const cmd = process.argv[2] || 'check';

    ALVO = process.argv[3] || null;
    if (ALVO && !SCHEMAS[ALVO]) {
        console.error(`Alvo desconhecido: ${ALVO}. Use ${Object.keys(SCHEMAS).join(' | ')}.`);
        process.exit(1);
    }
    if (ALVO) console.log(`(agindo só em "${SCHEMAS[ALVO].title}")`);

    if (cmd === 'all') {
        if (await check()) { await create(); await verify(); await seed(); }
        else console.log('\n  Acesso falhou — nada foi criado.');
    } else if (COMANDOS[cmd]) {
        await COMANDOS[cmd]();
    } else {
        console.error(`Comando desconhecido: ${cmd}. Use ${Object.keys(COMANDOS).join(' | ')} | all.`);
        process.exit(1);
    }

    console.log(falhas ? `\n${falhas} falha(s).\n` : '\nTudo certo.\n');
    process.exit(falhas ? 1 : 0);
})();
