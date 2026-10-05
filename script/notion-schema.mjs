/* ============================================================
 *  notion-schema.mjs — o que cada database do Notion precisa ter
 * ============================================================
 *  Extraído de notion-bootstrap.mjs na task 22 por um motivo só:
 *  virar módulo importável. Enquanto os schemas moravam dentro do
 *  script de linha de comando, o teste não conseguia lê-los sem
 *  disparar o CLI (o arquivo termina com um IIFE que chama
 *  process.exit). Agora `tests/unit/notion.schema.test.js` importa
 *  daqui e compara com buildNotionProps_() do script/Code.gs.
 *
 *  Por que a comparação existe: o Code.gs roda no Google e não pode
 *  importar nada deste repo. Os dois lados são cópias que precisam
 *  bater EXATAMENTE, acento incluído — um "Nível BIM" digitado como
 *  "Nivel BIM" vira `400 ... is not a property that exists` só na
 *  hora em que um lead real chega. O teste é o que trava isso.
 *
 *  ⚠️ Mudou uma coluna aqui? Muda em buildNotionProps_() também
 *     (script/Code.gs) e rode `npm run test:unit`.
 * ============================================================ */

/* ============================================================
 *  PÁGINAS-MÃE — onde os databases vivem
 * ============================================================
 *  Sobrescreva por ambiente se o workspace mudar.
 * ============================================================ */
export const PAGES = {
    orcamentos:  process.env.NOTION_PAGE_ORCAMENTOS   || '3b05a5ea5c9d80f59024ddcf166bf571',  // "Cadastro de Orçamentos"
    cadastros:   process.env.NOTION_PAGE_CADASTROS    || '3b05a5ea5c9d808ab2a9dd725fa8164b',  // "Cadastro de Clientes"
    // Página nova, criada pelo cliente em 07/09/2026 (task 22). A anterior era
    // 3b05a5ea5c9d80f093dec884cc2221b6 — ver §02 de tasks/22/task_text.md.
    listaEspera: process.env.NOTION_PAGE_LISTA_ESPERA || '3d45a5ea5c9d809595a2d31dec9d5d30',  // "Lista de Espera"
    // Conversor BCF → PDF (task 24). Ainda sem página: o cliente cria uma e o id
    // entra aqui (ou em NOTION_PAGE_LEADS_BCF). Enquanto vazio, o bootstrap pula
    // este alvo e o Code.gs não espelha nada (FORMS['bcf-pdf'].NOTION_OPCIONAL).
    leadsBcf:    process.env.NOTION_PAGE_LEADS_BCF    || '',
};

/* ============================================================
 *  DATABASES já criados
 * ============================================================
 *  Usados por `seed`, `verify` e `cleanup` quando rodam sem um
 *  `create` antes. `listaEspera` está VAZIO de propósito: o
 *  database da página nova ainda não existe, e deixar apontando
 *  para o antigo (3b05a5ea5c9d813abeb9d8bc6e573d11, criado em
 *  02/08/2026 na página velha) faria `seed`/`verify` mexerem no
 *  lugar errado sem reclamar. Rode `create listaEspera` e cole o
 *  ID devolvido aqui e nas Propriedades do Apps Script.
 * ============================================================ */
export const DBS = {
    orcamentos:  process.env.NOTION_DB_ORCAMENTOS   || '3b05a5ea5c9d81cda679c6c9210f0de2',
    cadastros:   process.env.NOTION_DB_CADASTROS    || '3b05a5ea5c9d81bfa3f1c11b72552833',
    listaEspera: process.env.NOTION_DB_LISTA_ESPERA || '',
    leadsBcf:    process.env.NOTION_DB_LEADS_BCF    || '',
};

/* Nome da variável de ambiente de cada alvo — só para a mensagem de erro
 * apontar a variável certa (listaEspera ≠ LISTAESPERA). */
export const ENV_DB = {
    orcamentos:  'NOTION_DB_ORCAMENTOS',
    cadastros:   'NOTION_DB_CADASTROS',
    listaEspera: 'NOTION_DB_LISTA_ESPERA',
    leadsBcf:    'NOTION_DB_LEADS_BCF',
};

/* ============================================================
 *  SCHEMAS
 * ============================================================ */

const text = () => ({ rich_text: {} });
const select = (options = []) => ({ select: { options: options.map(name => ({ name })) } });
const multiSelect = (options = []) => ({ multi_select: { options: options.map(name => ({ name })) } });
const number = () => ({ number: { format: 'number' } });
const date = () => ({ date: {} });

export const UF = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export const STATUS = ['Novo', 'Contato feito', 'Proposta', 'Fechado', 'Perdido'];
const NIVEL_EQUIPE = ['Já possui conhecimento', 'Partirão do zero', 'Equipe mista'];

/* Opções dos selects da lista de espera: copiadas dos controles de
 * lista-espera.html. Não são decorativas — sem elas a coluna nasce
 * vazia e o Notion inventa a opção (com cor aleatória) no primeiro
 * lead, o que impede filtrar e agrupar antes do primeiro cadastro.
 * notion.schema.test.js lê o HTML e falha se divergirem. */
const LE_SOFTWARE_ATUAL     = ['Revit', 'Archicad', 'SketchUp', 'AutoCAD', 'Outro'];
const LE_NIVEL_BIM          = ['Iniciante', 'Intermediário', 'Avançado'];
const LE_SOFTWARE_INTERESSE = ['Archicad', 'Revit'];          // pílulas, escolha única
const LE_COMO_CONHECEU      = ['Instagram', 'Indicação', 'Google', 'Outro'];
const LE_BIMCLUB            = ['Sim', 'Não'];                 // pílulas, escolha única

/* Conversor BCF: exatamente os valores que finalizarBcfPdf_() e simNao_()
 * escrevem no Code.gs (BCF_ENVIO). */
const BCF_ENVIO = ['Pendente', 'Enviado', 'Cota esgotada', 'Falhou'];
const SIM_NAO   = ['Sim', 'Não'];

export const SCHEMAS = {
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
            'Recebido em':        date(),
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
            'Recebido em':           date(),
            'E-mail':                { email: {} },
            'Telefone':              { phone_number: {} },
            'Cidade':                text(),
            'Estado':                select(UF),
            'Empresa':               text(),
            'Cargo':                 text(),
            'Software Atual':        select(LE_SOFTWARE_ATUAL),
            'Nível BIM':             select(LE_NIVEL_BIM),
            'Software de Interesse': select(LE_SOFTWARE_INTERESSE),
            'Objetivo':              text(),
            'Como Conheceu':         select(LE_COMO_CONHECEU),
            'BIMClub':               select(LE_BIMCLUB),
            'Status':                select(STATUS),
            'User Agent':            text(),
        },
    },
    leadsBcf: {
        title: 'Leads · BCF → PDF',
        page: PAGES.leadsBcf,
        properties: {
            'Lead':             { title: {} },
            'Protocolo':        text(),
            'Recebido em':      date(),
            'E-mail':           { email: {} },
            'Aceita Conteúdos': select(SIM_NAO),
            'Projeto':          text(),
            'Issues':           number(),
            'Envio':            select(BCF_ENVIO),
            'Status':           select(STATUS),
            'User Agent':       text(),
        },
    },
};

/* ============================================================
 *  CONSTRUTORES DE PROPRIEDADE
 * ============================================================
 *  Espelham os n*_() de script/Code.gs. Ficam aqui para que a
 *  página [TESTE] do `seed` exercite o MESMO formato que um lead
 *  real vai exercitar — inclusive o tratamento da vírgula.
 * ============================================================ */

export const nTitle  = v => ({ title: [{ text: { content: v } }] });
export const nText   = v => ({ rich_text: v ? [{ text: { content: String(v).substring(0, 2000) } }] : [] });
// vírgula quebra o "select" do Notion em duas opções; troca por barra (igual a nSelect_ do Code.gs)
export const nSelect = v => ({ select: v ? { name: String(v).replace(/,/g, ' /').substring(0, 100) } : null });
// no multi-select a vírgula É o separador (igual a nMultiSelect_ do Code.gs)
export const nMultiSelect = v => ({ multi_select: String(v || '').split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name })) });
export const nNumber = v => ({ number: v === '' || v === undefined ? null : Number(v) });

/* ============================================================
 *  PÁGINAS DE TESTE
 * ============================================================
 *  Mesmo formato de payload de buildNotionProps_(). É este envio
 *  que valida a integração de verdade: nome de coluna, acentuação
 *  e os tipos email / phone_number / url / date.
 * ============================================================ */

export const SEEDS = {
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
        'Software de Interesse': nSelect('Revit'),
        'Objetivo':              nText('Migrar o escritório para BIM.'),
        'Como Conheceu':         nSelect('Instagram'),
        'BIMClub':               nSelect('Sim'),
        'Status':                nSelect('Novo'),
        'User Agent':            nText('notion-bootstrap/1.0'),
    }),
    leadsBcf: hoje => ({
        'Lead':             nTitle('[TESTE] Beltrana de Tal'),
        'Protocolo':        nText('BP-2026-9999'),
        'Recebido em':      { date: { start: hoje } },
        'E-mail':           { email: 'beltrana@exemplo.com.br' },
        'Aceita Conteúdos': nSelect('Sim'),
        'Projeto':          nText('Residencial Exemplo'),
        'Issues':           nNumber(12),
        'Envio':            nSelect('Enviado'),
        'Status':           nSelect('Novo'),
        'User Agent':       nText('notion-bootstrap/1.0'),
    }),
};
