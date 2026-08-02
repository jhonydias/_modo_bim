#!/usr/bin/env node
/* ============================================================
 *  notion-bootstrap.mjs — setup dos databases do Notion (task 08)
 * ============================================================
 *  Faz por API o que os passos 2, 4 e 6 de tasks/08/notion-integracao.md
 *  descrevem na mão: cria os três databases com os nomes e tipos de
 *  coluna que buildNotionProps_() (script/Code.gs) espera, grava uma
 *  página [TESTE] em cada um e devolve os IDs para as Propriedades
 *  do script do Apps Script.
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
 *    node script/notion-bootstrap.mjs create    # cria os três databases
 *    node script/notion-bootstrap.mjs seed      # grava uma página [TESTE] em cada
 *    node script/notion-bootstrap.mjs cleanup   # arquiva as páginas [TESTE]
 *    node script/notion-bootstrap.mjs all       # check + create + seed
 *
 *  Todos aceitam um alvo opcional — `orcamentos`, `cadastros` ou
 *  `listaEspera` — para agir em um só database. Sem ele, agem nos três:
 *
 *    node script/notion-bootstrap.mjs all orcamentos
 *
 *  Antes de qualquer coisa: conecte a integração às três páginas
 *  (••• › Connections › Connect to). Sem isso a API responde
 *  404 object_not_found mesmo para páginas que existem.
 * ============================================================ */

const TOKEN = process.env.NOTION_TOKEN;
const API = 'https://api.notion.com/v1/';
const VERSION = '2022-06-28';   // mesma de NOTION.VERSION em Code.gs

/* Páginas-mãe onde os databases vivem. Sobrescreva por ambiente se
 * o workspace mudar: NOTION_PAGE_ORCAMENTOS / NOTION_PAGE_CADASTROS /
 * NOTION_PAGE_LISTA_ESPERA. */
const PAGES = {
    orcamentos:  process.env.NOTION_PAGE_ORCAMENTOS   || '3b05a5ea5c9d80f59024ddcf166bf571',  // "Cadastro de Orçamentos"
    cadastros:   process.env.NOTION_PAGE_CADASTROS    || '3b05a5ea5c9d808ab2a9dd725fa8164b',  // "Cadastro de Clientes"
    listaEspera: process.env.NOTION_PAGE_LISTA_ESPERA || '3b05a5ea5c9d80f093dec884cc2221b6',  // "Lista de Espera"
};

/* Databases já criados (Cadastros e Lista de Espera em 02/08/2026;
 * Orçamentos no mesmo dia, task 10). Usados por `seed` e `cleanup`
 * quando rodam sem um `create` antes. */
const DBS = {
    orcamentos:  process.env.NOTION_DB_ORCAMENTOS   || '3b05a5ea5c9d81cda679c6c9210f0de2',
    cadastros:   process.env.NOTION_DB_CADASTROS    || '3b05a5ea5c9d81bfa3f1c11b72552833',
    listaEspera: process.env.NOTION_DB_LISTA_ESPERA || '3b05a5ea5c9d813abeb9d8bc6e573d11',
};

/* Nome da variável de ambiente de cada alvo — só para a mensagem de erro
 * apontar a variável certa (listaEspera ≠ LISTAESPERA). */
const ENV_DB = {
    orcamentos:  'NOTION_DB_ORCAMENTOS',
    cadastros:   'NOTION_DB_CADASTROS',
    listaEspera: 'NOTION_DB_LISTA_ESPERA',
};

/* ============================================================
 *  SCHEMAS
 * ============================================================
 *  Os nomes precisam bater EXATAMENTE com os de buildNotionProps_()
 *  em script/Code.gs — acentos incluídos. Mudou lá, muda aqui.
 * ============================================================ */

const text = () => ({ rich_text: {} });
const select = (options = []) => ({ select: { options: options.map(name => ({ name })) } });
const multiSelect = (options = []) => ({ multi_select: { options: options.map(name => ({ name })) } });
const number = () => ({ number: { format: 'number' } });
const date = () => ({ date: {} });

const UF = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const STATUS = ['Novo', 'Contato feito', 'Proposta', 'Fechado', 'Perdido'];
const NIVEL_EQUIPE = ['Já possui conhecimento', 'Partirão do zero', 'Equipe mista'];

/* Selects sem opções pré-carregadas são intencionais: a API cria a
 * opção sozinha no primeiro lead que chegar, então listar aqui só
 * criaria divergência com o que o formulário de fato manda. */
const SCHEMAS = {
    orcamentos: {
        title: 'Orçamentos',
        page: PAGES.orcamentos,
        properties: {
            'Nome Completo':          { title: {} },
            'Protocolo':              text(),
            'Recebido em':            date(),
            'Empresa':                text(),
            'E-mail':                 { email: {} },
            'Telefone':               { phone_number: {} },
            'Produtos e Serviços':    text(),
            'Gargalo Atual':          text(),
            'Expectativa com BIM':    text(),
            'Pessoas no Treinamento': number(),
            // multi-select: "Qual(is) software(s)" aceita mais de um
            'Software de Interesse':  multiSelect(['Revit', 'Archicad', 'Navisworks']),
            'Nível da Equipe':        select(NIVEL_EQUIPE),
            'Reunião (1ª opção)':     date(),
            'Reunião (2ª opção)':     date(),
            'Observações':            text(),
            'Status':                 select(STATUS),
            'User Agent':             text(),
        },
    },
    cadastros: {
        title: 'Cadastros',
        page: PAGES.cadastros,
        properties: {
            'Razão Social':       { title: {} },
            'Protocolo':          text(),
            'Recebido em':        { date: {} },
            'Nome Fantasia':      text(),
            'CNPJ':               text(),
            'Inscrição Estadual': text(),
            'Ramo de Atividade':  select(['Arquitetura', 'Engenharia', 'Construtora', 'Incorporadora', 'Instalações', 'Consultoria', 'Outro']),
            'CPF Representante':  text(),
            'Cargo':              text(),
            'E-mail':             { email: {} },
            'Telefone':           { phone_number: {} },
            'Site':               { url: {} },
            'CEP':                text(),
            'Endereço':           text(),
            'Cidade':             text(),
            'Estado':             select(UF),
            'Status':             select(STATUS),
            'User Agent':         text(),
        },
    },
    listaEspera: {
        title: 'Lista de Espera',
        page: PAGES.listaEspera,
        properties: {
            'Nome Completo':         { title: {} },
            'Protocolo':             text(),
            'Recebido em':           { date: {} },
            'E-mail':                { email: {} },
            'Telefone':              { phone_number: {} },
            'Cidade':                text(),
            'Estado':                select(UF),
            'Empresa':               text(),
            'Cargo':                 text(),
            'Software Atual':        select(),
            'Nível BIM':             select(),
            'Software de Interesse': select(),
            'Objetivo':              text(),
            'Como Conheceu':         select(),
            'BIMClub':               select(['Sim', 'Não']),
            'Status':                select(STATUS),
            'User Agent':            text(),
        },
    },
};

/* ============================================================
 *  PÁGINAS DE TESTE
 * ============================================================
 *  Mesmo formato de payload de buildNotionProps_(). É este envio
 *  que valida a integração de verdade: nome de coluna, acentuação
 *  e os tipos email / phone_number / url / date.
 * ============================================================ */

const nTitle  = v => ({ title: [{ text: { content: v } }] });
const nText   = v => ({ rich_text: v ? [{ text: { content: String(v).substring(0, 2000) } }] : [] });
// vírgula quebra o "select" do Notion em duas opções; troca por barra (igual a nSelect_ do Code.gs)
const nSelect = v => ({ select: v ? { name: String(v).replace(/,/g, ' /').substring(0, 100) } : null });
// no multi-select a vírgula É o separador (igual a nMultiSelect_ do Code.gs)
const nMultiSelect = v => ({ multi_select: String(v || '').split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name })) });
const nNumber = v => ({ number: v === '' || v === undefined ? null : Number(v) });

const SEEDS = {
    orcamentos: hoje => ({
        'Nome Completo':          nTitle('[TESTE] Maria das Graças'),
        'Protocolo':              nText('OR-2026-9999'),
        'Recebido em':            { date: { start: hoje } },
        'Empresa':                nText('Glimmerock Arquitetura'),
        'E-mail':                 { email: 'teste@exemplo.com.br' },
        'Telefone':               { phone_number: '(91) 99999-0000' },
        'Produtos e Serviços':    nText('Projetos de arquitetura residencial e gerenciamento de obras.'),
        'Gargalo Atual':          nText('Retrabalho e incompatibilidade entre os complementares.'),
        'Expectativa com BIM':    nText('Reduzir erros em obra e padronizar as entregas.'),
        'Pessoas no Treinamento': nNumber(8),
        // com vírgula de propósito: exercita a quebra em duas opções
        'Software de Interesse':  nMultiSelect('Revit, Navisworks'),
        'Nível da Equipe':        nSelect('Equipe mista'),
        'Reunião (1ª opção)':     { date: { start: '2026-09-10T14:30:00-03:00' } },
        'Reunião (2ª opção)':     { date: { start: '2026-09-12T09:00:00-03:00' } },
        'Observações':            nText('Preferência por reunião online.'),
        'Status':                 nSelect('Novo'),
        'User Agent':             nText('notion-bootstrap/1.0'),
    }),
    cadastros: hoje => ({
        'Razão Social':       nTitle('[TESTE] Construtora Exemplo LTDA'),
        'Protocolo':          nText('MB-2026-9999'),
        'Recebido em':        { date: { start: hoje } },
        'Nome Fantasia':      nText('Exemplo Engenharia'),
        'CNPJ':               nText('12.345.678/0001-90'),
        'Inscrição Estadual': nText('ISENTO'),
        'Ramo de Atividade':  nSelect('Construtora'),
        'CPF Representante':  nText('123.456.789-00'),
        'Cargo':              nText('Diretor Técnico'),
        'E-mail':             { email: 'teste@exemplo.com.br' },
        'Telefone':           { phone_number: '(11) 99999-0000' },
        'Site':               { url: 'https://exemplo.com.br' },
        'CEP':                nText('01310-100'),
        'Endereço':           nText('Av. Paulista, 1000, Sala 12 - Bela Vista'),
        'Cidade':             nText('São Paulo'),
        'Estado':             nSelect('SP'),
        'Status':             nSelect('Novo'),
        'User Agent':         nText('notion-bootstrap/1.0'),
    }),
    listaEspera: hoje => ({
        'Nome Completo':         nTitle('[TESTE] Fulano de Tal'),
        'Protocolo':             nText('LE-2026-9999'),
        'Recebido em':           { date: { start: hoje } },
        'E-mail':                { email: 'fulano@exemplo.com.br' },
        'Telefone':              { phone_number: '(31) 98888-0000' },
        'Cidade':                nText('Belo Horizonte'),
        'Estado':                nSelect('MG'),
        'Empresa':               nText('Escritório Exemplo'),
        'Cargo':                 nText('Arquiteta'),
        'Software Atual':        nSelect('AutoCAD'),
        'Nível BIM':             nSelect('Iniciante'),
        // com vírgula de propósito: exercita a troca por barra do nSelect_()
        'Software de Interesse': nSelect('Revit, Navisworks'),
        'Objetivo':              nText('Migrar o escritório para BIM.'),
        'Como Conheceu':         nSelect('Instagram'),
        'BIMClub':               nSelect('Sim'),
        'Status':                nSelect('Novo'),
        'User Agent':            nText('notion-bootstrap/1.0'),
    }),
};

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
        }
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

const COMANDOS = { check, create, seed, cleanup };

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
        if (await check()) { await create(); await seed(); }
        else console.log('\n  Acesso falhou — nada foi criado.');
    } else if (COMANDOS[cmd]) {
        await COMANDOS[cmd]();
    } else {
        console.error(`Comando desconhecido: ${cmd}. Use check | create | seed | cleanup | all.`);
        process.exit(1);
    }

    console.log(falhas ? `\n${falhas} falha(s).\n` : '\nTudo certo.\n');
    process.exit(falhas ? 1 : 0);
})();
