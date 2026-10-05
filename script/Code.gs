/**
 * ============================================================
 *  _modo_bim — Backend Apps Script
 *  2026
 * ============================================================
 *  Recebe quatro tipos de envio (HTML hospedados no GitHub
 *  Pages) e armazena em abas separadas da mesma planilha,
 *  gerando protocolo único e disparando e-mails de confirmação.
 *
 *    tipo: 'orcamento'     → aba "Orçamentos"      · OR-2026-NNNN
 *    tipo: 'cadastro'      → aba "Cadastros"       · MB-2026-NNNN
 *    tipo: 'lista-espera'  → aba "Lista de Espera" · LE-2026-NNNN
 *    tipo: 'bcf-pdf'       → aba "BCF → PDF"       · BP-2026-NNNN
 *
 *  'bcf-pdf' é a ferramenta gratuita bcf-para-pdf.html (task 24):
 *  o PDF é gerado no navegador e chega aqui em base64 só para ser
 *  anexado ao e-mail de quem pediu. O e-mail é o lead. O PDF nunca
 *  é gravado em planilha, fila ou log — ver extrairAnexo_().
 *
 *  'orcamento' é o funil de entrada (cadastro.html, linkado na landing):
 *  diagnóstico do cenário + agendamento da reunião de alinhamento.
 *  'cadastro' são os dados contratuais (contrato.html, enviado por URL
 *  direta só quando o cliente vai fechar) — por isso ele não aparece
 *  em nenhum link público.
 *
 *  Cada envio também é espelhado no Notion (software oficial da
 *  _modo_bim) via API. A planilha permanece como backup e fonte
 *  do protocolo; o Notion é onde o time opera.
 *  Setup: tasks/08/notion-integracao.md
 * ============================================================
 */

/* ============================================================
 *  CONFIGURAÇÃO GERAL
 * ============================================================ */
const CONFIG = {
    ADMIN_EMAIL: 'modobimcontato@gmail.com',
    COMPANY_NAME: '_modo_bim',

    // Rate limit por e-mail
    RATE_LIMIT_MAX: 3,
    RATE_LIMIT_WINDOW_MIN: 5,

    SEND_CLIENT_EMAIL: true,
    SEND_ADMIN_EMAIL: true,

    // Espelha cada envio para o Notion (software oficial da _modo_bim).
    // A planilha continua como registro de segurança e fonte do protocolo.
    SEND_TO_NOTION: true,

    // Teto do PDF do conversor BCF (bytes decodificados). O anexo do
    // MailApp vai até 25 MB por mensagem; 15 deixa margem para o MIME
    // e mantém o upload aceitável no celular. O front confere o mesmo
    // número antes de enviar (bcf-para-pdf.html · PDF_MAX_BYTES).
    BCF_PDF_MAX_BYTES: 15 * 1024 * 1024,

    // Teto GLOBAL de e-mails do conversor por hora. O rate limit comum é
    // por destinatário; sem este, alguém poderia usar o endpoint para
    // disparar PDFs arbitrários, em nome da _modo_bim, para uma lista de
    // endereços — e ainda queimar a cota diária (100) do site inteiro.
    // Acima do teto o lead é gravado e o front oferece o download.
    BCF_MAX_ENVIOS_HORA: 30
};

/* ============================================================
 *  NOTION — configuração
 * ============================================================
 *  Segredos NÃO ficam no código. Cadastre em
 *  Extensões › Apps Script › Configurações do projeto › Propriedades do script:
 *
 *    NOTION_TOKEN            → secret da integração interna (ntn_...)
 *    NOTION_DB_ORCAMENTOS    → ID do database "Orçamentos"
 *    NOTION_DB_CADASTROS     → ID do database "Cadastros"
 *    NOTION_DB_LISTA_ESPERA  → ID do database "Lista de Espera"
 *    NOTION_DB_LEADS_BCF     → ID do database "Leads · BCF → PDF"
 *                              (opcional: sem ele o lead fica só na planilha)
 *
 *  Passo a passo completo em tasks/08/notion-integracao.md
 * ============================================================ */
const NOTION = {
    API: 'https://api.notion.com/v1/pages',
    VERSION: '2022-06-28',
    RETRY_QUEUE_SHEET: 'Fila Notion',   // envios que falharam, reprocessados por gatilho
    MAX_RETRIES: 5
};

/* ============================================================
 *  LOG DE ERROS
 * ============================================================
 *  Toda falha de envio (validação, rate limit, JSON inválido,
 *  exceção) grava uma linha durável na aba "Log de Erros" da
 *  própria planilha. É o rastro que faltava: rejeições dão
 *  `return` normal, não lançam exceção, então não apareciam em
 *  lugar nenhum. Cada envio também é ecoado no Cloud Logging
 *  (console.*), visível no painel Execuções do editor.
 * ============================================================ */
const LOG = {
    SHEET_NAME: 'Log de Erros',
    MAX_DETAIL: 4000    // trava o tamanho do detalhe por célula
};

/* ============================================================
 *  SCHEMAS — configuração por tipo de formulário
 * ============================================================ */
const FORMS = {
    'orcamento': {
        SHEET_NAME: 'Orçamentos',
        NOTION_DB_KEY: 'NOTION_DB_ORCAMENTOS',
        PROTOCOL_PREFIX: 'OR',
        LABEL: 'Orçamento',
        COLUMNS: [
            'Timestamp', 'Protocolo',
            'Nome Completo', 'Empresa / Escritório', 'E-mail', 'Telefone / WhatsApp',
            'Produtos e Serviços', 'Gargalo Atual', 'Expectativa com BIM',
            'Pessoas no Treinamento', 'Software de Interesse', 'Nível da Equipe',
            'Reunião (1ª opção)', 'Reunião (2ª opção)', 'Observações',
            'User Agent'
        ],
        REQUIRED: {
            nomeCompleto: 'Nome completo',
            empresa: 'Empresa / Escritório',
            email: 'E-mail de contato',
            telefone: 'Telefone / WhatsApp',
            produtosServicos: 'Produtos ou serviços',
            gargalo: 'Maior problema ou gargalo',
            objetivoBIM: 'Expectativa com o BIM',
            qtdPessoas: 'Quantidade de pessoas no treinamento',
            softwareInteresse: 'Software de interesse',
            nivelEquipe: 'Nível da equipe'
            // reuniao1/reuniao2 saíram do formulário na task 18 (agendamento
            // migrou para o Calendly na tela de sucesso). As colunas e as
            // propriedades do Notion continuam existindo — só chegam vazias.
        }
    },
    'cadastro': {
        SHEET_NAME: 'Cadastros',
        NOTION_DB_KEY: 'NOTION_DB_CADASTROS',
        PROTOCOL_PREFIX: 'MB',
        LABEL: 'Cadastro',
        COLUMNS: [
            'Timestamp', 'Protocolo',
            'Razão Social', 'Nome Fantasia', 'CNPJ', 'Inscrição Estadual',
            'Ramo de Atividade', 'CPF Representante', 'Cargo / Função',
            'E-mail Corporativo', 'Telefone / WhatsApp', 'Site',
            'CEP', 'Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'Estado',
            'User Agent'
        ],
        REQUIRED: {
            razaoSocial: 'Razão Social',
            cnpj: 'CNPJ',
            ramoAtividade: 'Ramo de Atividade',
            cpfRepresentante: 'CPF do Representante',
            cargo: 'Cargo / Função',
            email: 'E-mail Corporativo',
            cep: 'CEP',
            logradouro: 'Logradouro',
            estado: 'Estado / UF'
        }
    },
    'lista-espera': {
        SHEET_NAME: 'Lista de Espera',
        NOTION_DB_KEY: 'NOTION_DB_LISTA_ESPERA',
        PROTOCOL_PREFIX: 'LE',
        LABEL: 'Lista de Espera',
        COLUMNS: [
            'Timestamp', 'Protocolo',
            'Nome Completo', 'E-mail', 'Telefone / WhatsApp', 'Cidade', 'Estado',
            'Empresa / Escritório', 'Cargo / Função',
            'Software Atual', 'Nível BIM',
            'Software de Interesse', 'Objetivo / Dificuldade',
            'Como Conheceu', 'BIMClub',
            'User Agent'
        ],
        REQUIRED: {
            nomeCompleto: 'Nome Completo',
            email: 'E-mail',
            telefone: 'Telefone / WhatsApp',
            cidade: 'Cidade',
            estado: 'Estado / UF',
            cargo: 'Cargo / Função',
            softwareAtual: 'Software Atual',
            nivelBIM: 'Nível BIM',
            softwareInteresse: 'Software de Interesse',
            objetivo: 'Objetivo / Dificuldade',
            bimclub: 'BIMClub'
        }
    },
    'bcf-pdf': {
        SHEET_NAME: 'BCF → PDF',
        NOTION_DB_KEY: 'NOTION_DB_LEADS_BCF',
        // Sem database configurado, pula o Notion em vez de enfileirar: a
        // fila receberia um item por lead, tentado 5 vezes cada. Configurar
        // a Propriedade do script liga o espelhamento sem deploy.
        NOTION_OPCIONAL: true,
        PROTOCOL_PREFIX: 'BP',
        LABEL: 'Conversor BCF → PDF',
        // Fluxo próprio: e-mail com o PDF anexado, sem aviso ao admin
        // (ver finalizarBcfPdf_).
        ANEXO_PDF: true,
        COLUMNS: [
            'Timestamp', 'Protocolo',
            'E-mail', 'Nome', 'Aceita Conteúdos',
            'Projeto', 'Título do Relatório', 'Issues', 'Arquivo BCF', 'PDF (KB)',
            'Envio',
            'User Agent'
        ],
        // O e-mail é o único preço da ferramenta (task 24 §01).
        REQUIRED: {
            email: 'E-mail'
        }
    }
};

/* ============================================================
 *  ENTRY POINTS — Web App
 * ============================================================ */

function doPost(e) {
    try {
        if (!e || !e.postData || !e.postData.contents) {
            logEvent_('ERRO', '', '', 'Payload vazio', null);
            return jsonResponse_({ success: false, error: 'Payload vazio' });
        }

        let data;
        try {
            data = JSON.parse(e.postData.contents);
        } catch (err) {
            logEvent_('ERRO', '', '', 'JSON inválido', String(e.postData.contents).substring(0, 500));
            return jsonResponse_({ success: false, error: 'JSON inválido' });
        }

        // Detecta tipo (default = cadastro p/ compatibilidade com versão antiga)
        const tipo = (data.tipo || 'cadastro').toString().trim();
        const formConfig = FORMS[tipo];
        if (!formConfig) {
            logEvent_('ERRO', tipo, '', 'Tipo de formulário inválido', { tipoRecebido: tipo });
            return jsonResponse_({ success: false, error: 'Tipo de formulário inválido' });
        }

        // O PDF do conversor sai do payload ANTES da sanitização: ela corta
        // toda string em 500 caracteres, e daqui em diante `data` pode ir
        // inteiro para a Fila Notion e para o log.
        const anexo = extrairAnexo_(data);

        // Sanitização
        data = sanitizeData_(data);

        // Rate limiting
        const rateCheck = checkRateLimit_(data, tipo);
        if (!rateCheck.ok) {
            logEvent_('BLOQUEIO', tipo, '', 'Rate limit excedido', { email: data.email || '' });
            return jsonResponse_({
                success: false,
                error: 'Muitas tentativas. Aguarde alguns minutos.'
            });
        }

        // Validação server-side
        const validation = validatePayload_(data, formConfig);
        let pdf = null;
        if (formConfig.ANEXO_PDF) {
            pdf = validarAnexoPdf_(anexo);
            if (!pdf.ok) {
                validation.valid = false;
                validation.errors.push(pdf.error);
            }
        }
        if (!validation.valid) {
            logEvent_('VALIDAÇÃO', tipo, '', 'Dados inválidos', {
                email: data.email || '',
                errors: validation.errors,
                camposRecebidos: Object.keys(data)
            });
            return jsonResponse_({
                success: false,
                error: 'Dados inválidos',
                errors: validation.errors
            });
        }

        // Garante aba e cabeçalho
        ensureSheetExists_(formConfig);

        // Protocolo
        const protocolo = generateProtocol_(formConfig);

        // Conversor BCF: grava, manda o PDF e responde por conta própria
        if (formConfig.ANEXO_PDF) {
            return jsonResponse_(finalizarBcfPdf_(data, pdf, protocolo, formConfig, tipo));
        }

        // Insere linha
        appendToSheet_(data, protocolo, formConfig);

        // Notion (não bloqueante: falha vai para a fila de reenvio)
        if (notionAtivo_(formConfig)) {
            sendToNotion_(data, protocolo, formConfig);
        }

        // E-mails (não bloqueante)
        try {
            if (CONFIG.SEND_ADMIN_EMAIL) sendAdminEmail_(data, protocolo, formConfig);
            if (CONFIG.SEND_CLIENT_EMAIL) sendClientEmail_(data, protocolo, formConfig);
        } catch (mailErr) {
            logEvent_('AVISO', tipo, protocolo, 'Falha no envio de e-mail', String(mailErr));
        }

        return jsonResponse_({
            success: true,
            protocolo: protocolo,
            tipo: tipo,
            message: 'Recebido com sucesso'
        });

    } catch (err) {
        logEvent_('EXCEÇÃO', '', '', String(err), err && err.stack ? err.stack.substring(0, 1500) : '');
        return jsonResponse_({
            success: false,
            error: 'Erro interno. Tente novamente.'
        });
    }
}

function doGet(e) {
    return jsonResponse_({
        status: 'ok',
        service: '_modo_bim',
        forms: Object.keys(FORMS),
        timestamp: new Date().toISOString()
    });
}

/* ============================================================
 *  PLANILHA
 * ============================================================ */

function ensureSheetExists_(formConfig) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(formConfig.SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(formConfig.SHEET_NAME);
    }

    const cols = formConfig.COLUMNS;
    const firstRow = sheet.getRange(1, 1, 1, cols.length).getValues()[0];
    const hasHeader = firstRow[0] === cols[0];

    if (!hasHeader) {
        sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
        const headerRange = sheet.getRange(1, 1, 1, cols.length);
        headerRange.setBackground('#81161E');
        headerRange.setFontColor('#EFEEE9');
        headerRange.setFontWeight('bold');
        headerRange.setFontFamily('Inter');
        headerRange.setVerticalAlignment('middle');
        sheet.setFrozenRows(1);
        sheet.setRowHeight(1, 36);

        // Larguras razoáveis (genéricas)
        sheet.setColumnWidth(1, 160); // Timestamp
        sheet.setColumnWidth(2, 130); // Protocolo
        sheet.setColumnWidth(3, 240); // Primeiro campo de identidade
        sheet.setColumnWidth(cols.length, 280); // User Agent
    }

    return sheet;
}

function appendToSheet_(data, protocolo, formConfig) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(formConfig.SHEET_NAME);
    const tz = Session.getScriptTimeZone() || 'America/Belem';
    const timestamp = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');

    const row = buildRow_(data, timestamp, protocolo, formConfig);
    sheet.appendRow(row);
}

/**
 * Constrói a linha respeitando a ordem das colunas de cada schema.
 */
function buildRow_(d, timestamp, protocolo, formConfig) {
    if (formConfig.PROTOCOL_PREFIX === 'OR') {
        return [
            timestamp, protocolo,
            d.nomeCompleto || '', d.empresa || '', d.email || '', d.telefone || '',
            d.produtosServicos || '', d.gargalo || '', d.objetivoBIM || '',
            d.qtdPessoas || '', d.softwareInteresse || '', d.nivelEquipe || '',
            formatDataHora_(d.reuniao1), formatDataHora_(d.reuniao2), d.observacoes || '',
            d.userAgent || ''
        ];
    }
    if (formConfig.PROTOCOL_PREFIX === 'MB') {
        return [
            timestamp, protocolo,
            d.razaoSocial || '', d.nomeFantasia || '', d.cnpj || '', d.inscricaoEstadual || '',
            d.ramoAtividade || '', d.cpfRepresentante || '', d.cargo || '',
            d.email || '', d.telefone || '', d.site || '',
            d.cep || '', d.logradouro || '', d.numero || '', d.complemento || '',
            d.bairro || '', d.cidade || '', d.estado || '',
            d.userAgent || ''
        ];
    }
    if (formConfig.PROTOCOL_PREFIX === 'BP') {
        return [
            timestamp, protocolo,
            d.email || '', d.nome || '', simNao_(d.optin),
            d.projeto || '', d.titulo || '', d.qtdIssues || '', d.arquivoBcf || '', d.pdfKB || '',
            d.envio || '',
            d.userAgent || ''
        ];
    }
    // Lista de espera
    return [
        timestamp, protocolo,
        d.nomeCompleto || '', d.email || '', d.telefone || '', d.cidade || '', d.estado || '',
        d.empresa || '', d.cargo || '',
        d.softwareAtual || '', d.nivelBIM || '',
        d.softwareInteresse || '', d.objetivo || '',
        d.comoConheceu || '', d.bimclub || '',
        d.userAgent || ''
    ];
}

/* ============================================================
 *  NOTION
 * ============================================================
 *  Estratégia: dual-write. A planilha continua sendo gravada
 *  primeiro (é dela que sai o protocolo e é o backup em caso de
 *  problema na API), e logo em seguida o mesmo registro vira uma
 *  página no database correspondente do Notion.
 *
 *  Se a chamada falhar, o envio NÃO é perdido: vai para a aba
 *  "Fila Notion" e é reprocessado por retryNotionQueue(), que
 *  roda em um gatilho de tempo (ver criarGatilhoNotion).
 * ============================================================ */

/**
 * Espelha um envio no Notion. Nunca lança — em caso de falha,
 * enfileira para reenvio automático.
 */
function sendToNotion_(data, protocolo, formConfig) {
    try {
        const res = pushNotionPage_(data, protocolo, formConfig);
        if (!res.ok) {
            queueNotionRetry_(data, protocolo, formConfig, res.error);
        }
        return res;
    } catch (err) {
        queueNotionRetry_(data, protocolo, formConfig, String(err));
        return { ok: false, error: String(err) };
    }
}

/**
 * Espelhar no Notion? Sempre, exceto quando o formulário é NOTION_OPCIONAL e
 * o database dele ainda não foi configurado nas Propriedades do script.
 */
function notionAtivo_(formConfig) {
    if (!CONFIG.SEND_TO_NOTION) return false;
    if (!formConfig.NOTION_OPCIONAL) return true;
    return Boolean(PropertiesService.getScriptProperties().getProperty(formConfig.NOTION_DB_KEY));
}

/**
 * Faz a chamada real à API do Notion. Retorna { ok, error?, pageId? }.
 */
function pushNotionPage_(data, protocolo, formConfig) {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('NOTION_TOKEN');
    const dbId = props.getProperty(formConfig.NOTION_DB_KEY);

    if (!token || !dbId) {
        return { ok: false, error: 'NOTION_TOKEN ou ' + formConfig.NOTION_DB_KEY + ' não configurado nas Propriedades do script' };
    }

    const payload = {
        parent: { database_id: dbId },
        properties: buildNotionProps_(data, protocolo, formConfig)
    };

    const response = UrlFetchApp.fetch(NOTION.API, {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Notion-Version': NOTION.VERSION
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const body = response.getContentText();

    if (code >= 200 && code < 300) {
        let pageId = '';
        try { pageId = JSON.parse(body).id || ''; } catch (e) { /* resposta ok, id irrelevante */ }
        return { ok: true, pageId: pageId };
    }

    return { ok: false, error: 'HTTP ' + code + ' — ' + body.substring(0, 500) };
}

/**
 * Traduz o payload do formulário para as propriedades do database.
 * Os NOMES aqui precisam bater exatamente com os nomes das colunas
 * no Notion (ver tasks/08/notion-integracao.md).
 */
function buildNotionProps_(d, protocolo, formConfig) {
    const recebidoEm = notionDate_(new Date());

    if (formConfig.PROTOCOL_PREFIX === 'OR') {
        return {
            'Nome Completo':          nTitle_(d.nomeCompleto),
            'Protocolo':              nText_(protocolo),
            'Recebido em':            nDate_(recebidoEm),
            'Empresa':                nText_(d.empresa),
            'E-mail':                 nEmail_(d.email),
            'Telefone':               nPhone_(d.telefone),
            'Produtos e Serviços':    nText_(d.produtosServicos),
            'Gargalo Atual':          nText_(d.gargalo),
            'Expectativa com BIM':    nText_(d.objetivoBIM),
            'Pessoas no Treinamento': nNumber_(d.qtdPessoas),
            'Software de Interesse':  nMultiSelect_(d.softwareInteresse),
            'Nível da Equipe':        nSelect_(d.nivelEquipe),
            'Reunião (1ª opção)':     nDate_(notionDataHora_(d.reuniao1)),
            'Reunião (2ª opção)':     nDate_(notionDataHora_(d.reuniao2)),
            'Observações':            nText_(d.observacoes),
            'Status':                 nSelect_('Novo'),
            'User Agent':             nText_(d.userAgent)
        };
    }

    if (formConfig.PROTOCOL_PREFIX === 'MB') {
        return {
            'Razão Social':        nTitle_(d.razaoSocial),
            'Protocolo':           nText_(protocolo),
            'Recebido em':         nDate_(recebidoEm),
            'Nome Fantasia':       nText_(d.nomeFantasia),
            'CNPJ':                nText_(d.cnpj),
            'Inscrição Estadual':  nText_(d.inscricaoEstadual),
            'Ramo de Atividade':   nSelect_(d.ramoAtividade),
            'CPF Representante':   nText_(d.cpfRepresentante),
            'Cargo':               nText_(d.cargo),
            'E-mail':              nEmail_(d.email),
            'Telefone':            nPhone_(d.telefone),
            'Site':                nUrl_(d.site),
            'CEP':                 nText_(d.cep),
            'Endereço':            nText_(formatEndereco_(d)),
            'Cidade':              nText_(d.cidade),
            'Estado':              nSelect_(d.estado),
            'Status':              nSelect_('Novo'),
            'User Agent':          nText_(d.userAgent)
        };
    }

    if (formConfig.PROTOCOL_PREFIX === 'BP') {
        return {
            // nome é opcional no formulário: sem ele, o título da página é o e-mail
            'Lead':               nTitle_(d.nome || d.email),
            'Protocolo':          nText_(protocolo),
            'Recebido em':        nDate_(recebidoEm),
            'E-mail':             nEmail_(d.email),
            'Aceita Conteúdos':   nSelect_(simNao_(d.optin)),
            'Projeto':            nText_(d.projeto),
            'Issues':             nNumber_(d.qtdIssues),
            'Envio':              nSelect_(d.envio),
            'Status':             nSelect_('Novo'),
            'User Agent':         nText_(d.userAgent)
        };
    }

    return {
        'Nome Completo':          nTitle_(d.nomeCompleto),
        'Protocolo':              nText_(protocolo),
        'Recebido em':            nDate_(recebidoEm),
        'E-mail':                 nEmail_(d.email),
        'Telefone':               nPhone_(d.telefone),
        'Cidade':                 nText_(d.cidade),
        'Estado':                 nSelect_(d.estado),
        'Empresa':                nText_(d.empresa),
        'Cargo':                  nText_(d.cargo),
        'Software Atual':         nSelect_(d.softwareAtual),
        'Nível BIM':              nSelect_(d.nivelBIM),
        'Software de Interesse':  nSelect_(d.softwareInteresse),
        'Objetivo':               nText_(d.objetivo),
        'Como Conheceu':          nSelect_(d.comoConheceu),
        'BIMClub':                nSelect_(d.bimclub),
        'Status':                 nSelect_('Novo'),
        'User Agent':             nText_(d.userAgent)
    };
}

/* --- Construtores de propriedade (formato exigido pela API do Notion) --- */

function nTitle_(v) {
    return { title: [{ text: { content: notionStr_(v) || '(sem nome)' } }] };
}

function nText_(v) {
    const s = notionStr_(v);
    return { rich_text: s ? [{ text: { content: s.substring(0, 2000) } }] : [] };
}

function nSelect_(v) {
    const s = notionStr_(v);
    // vírgula quebra o "select" do Notion; troca por barra
    return { select: s ? { name: s.replace(/,/g, ' /').substring(0, 100) } : null };
}

/**
 * Multi-select: o formulário manda os valores separados por ", ".
 * Aqui a vírgula é o separador de verdade — ao contrário de nSelect_,
 * onde ela quebraria uma opção só em duas.
 */
function nMultiSelect_(v) {
    const s = notionStr_(v);
    if (!s) return { multi_select: [] };
    const nomes = s.split(',')
        .map(x => x.trim().substring(0, 100))
        .filter(Boolean);
    return { multi_select: nomes.map(name => ({ name: name })) };
}

function nNumber_(v) {
    const n = Number(notionStr_(v));
    return { number: isNaN(n) || notionStr_(v) === '' ? null : n };
}

function nEmail_(v) {
    const s = notionStr_(v);
    return { email: (s && validarEmail_(s)) ? s : null };
}

function nPhone_(v) {
    const s = notionStr_(v);
    return { phone_number: s || null };
}

function nUrl_(v) {
    let s = notionStr_(v);
    if (!s) return { url: null };
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return { url: s };
}

function nDate_(iso) {
    return { date: iso ? { start: iso } : null };
}

function notionStr_(v) {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

function notionDate_(dateObj) {
    const tz = Session.getScriptTimeZone() || 'America/Belem';
    return Utilities.formatDate(dateObj, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * `datetime-local` chega como "2026-08-10T14:30" — sem fuso. A API do
 * Notion aceita, mas guarda como horário sem timezone e o app exibe no
 * fuso de quem lê; carimbar o fuso do script mantém o horário que a
 * pessoa escolheu. Formato só validado, nunca reinterpretado por Date():
 * `new Date("2026-08-10T14:30")` mudaria de significado conforme o
 * servidor que rodar o script.
 */
function notionDataHora_(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(notionStr_(v));
    if (!m) return '';
    const tz = Session.getScriptTimeZone() || 'America/Belem';
    const offset = Utilities.formatDate(new Date(), tz, 'XXX');   // ex.: -03:00
    return m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':00' + offset;
}

/**
 * Mesma string, agora legível na planilha e no e-mail: 10/08/2026 14:30.
 */
function formatDataHora_(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(notionStr_(v));
    if (!m) return notionStr_(v);
    return m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5];
}

/* --- Fila de reenvio ------------------------------------------------- */

/**
 * Nome do tipo a partir do schema — é ele que a fila de reenvio grava e
 * usa depois para achar o FORMS de volta. Derivado, não escrito à mão:
 * um tipo novo entrava na fila com o rótulo errado.
 */
function tipoDoForm_(formConfig) {
    const tipo = Object.keys(FORMS).filter(k => FORMS[k].PROTOCOL_PREFIX === formConfig.PROTOCOL_PREFIX)[0];
    return tipo || '';
}

function queueNotionRetry_(data, protocolo, formConfig, error) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(NOTION.RETRY_QUEUE_SHEET);
        if (!sheet) {
            sheet = ss.insertSheet(NOTION.RETRY_QUEUE_SHEET);
            sheet.getRange(1, 1, 1, 6)
                .setValues([['Timestamp', 'Protocolo', 'Tipo', 'Tentativas', 'Último erro', 'Payload']])
                .setFontWeight('bold');
            sheet.setFrozenRows(1);
        }
        const tz = Session.getScriptTimeZone() || 'America/Belem';
        sheet.appendRow([
            Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss'),
            protocolo,
            tipoDoForm_(formConfig),
            0,
            String(error).substring(0, 500),
            JSON.stringify(data).substring(0, 45000)
        ]);
        Logger.log('Notion falhou, enfileirado: ' + protocolo + ' — ' + error);
    } catch (err) {
        // último recurso: registro só no log de execução
        Logger.log('Falha ao enfileirar reenvio Notion (' + protocolo + '): ' + err);
    }
}

/**
 * Reprocessa a fila. Instale um gatilho de tempo apontando para esta função
 * (ver criarGatilhoNotion). Linhas resolvidas são removidas; após
 * NOTION.MAX_RETRIES tentativas a linha permanece para inspeção manual.
 */
function retryNotionQueue() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(NOTION.RETRY_QUEUE_SHEET);
    if (!sheet || sheet.getLastRow() < 2) return;

    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    const resolved = [];

    rows.forEach((row, i) => {
        const rowNumber = i + 2;
        const protocolo = row[1];
        const tipo = row[2];
        const attempts = Number(row[3]) || 0;
        if (attempts >= NOTION.MAX_RETRIES) return;

        const formConfig = FORMS[tipo];
        if (!formConfig) return;

        let data;
        try { data = JSON.parse(row[5]); } catch (e) { return; }

        const res = pushNotionPage_(data, protocolo, formConfig);
        if (res.ok) {
            resolved.push(rowNumber);
        } else {
            sheet.getRange(rowNumber, 4).setValue(attempts + 1);
            sheet.getRange(rowNumber, 5).setValue(String(res.error).substring(0, 500));
        }
    });

    // remove de baixo para cima para não bagunçar os índices
    resolved.sort((a, b) => b - a).forEach(r => sheet.deleteRow(r));
    Logger.log('retryNotionQueue: ' + resolved.length + ' reenviado(s) com sucesso.');
}

/**
 * Cria (uma única vez) o gatilho de reenvio a cada 15 minutos.
 */
function criarGatilhoNotion() {
    const exists = ScriptApp.getProjectTriggers()
        .some(t => t.getHandlerFunction() === 'retryNotionQueue');
    if (exists) {
        Logger.log('Gatilho de reenvio já existe.');
        return;
    }
    ScriptApp.newTrigger('retryNotionQueue').timeBased().everyMinutes(15).create();
    Logger.log('✅ Gatilho de reenvio criado (a cada 15 min).');
}

/* ============================================================
 *  PROTOCOLO
 * ============================================================ */

function generateProtocol_(formConfig) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(formConfig.SHEET_NAME);
    const lastRow = sheet.getLastRow();
    const year = new Date().getFullYear();

    let countThisYear = 0;
    if (lastRow > 1) {
        const protocols = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
        const yearPrefix = `${formConfig.PROTOCOL_PREFIX}-${year}-`;
        countThisYear = protocols.filter(p => String(p[0]).startsWith(yearPrefix)).length;
    }

    const sequential = String(countThisYear + 1).padStart(4, '0');
    return `${formConfig.PROTOCOL_PREFIX}-${year}-${sequential}`;
}

/* ============================================================
 *  VALIDAÇÃO
 * ============================================================ */

function validatePayload_(data, formConfig) {
    const errors = [];

    Object.keys(formConfig.REQUIRED).forEach(key => {
        if (!data[key] || String(data[key]).trim() === '') {
            errors.push(`${formConfig.REQUIRED[key]} é obrigatório`);
        }
    });

    // Validações específicas por tipo
    if (formConfig.PROTOCOL_PREFIX === 'MB') {
        if (data.cnpj && !validarCNPJ_(data.cnpj)) errors.push('CNPJ inválido');
        if (data.cpfRepresentante && !validarCPF_(data.cpfRepresentante)) errors.push('CPF inválido');
        if (data.cep && data.cep.replace(/\D/g, '').length !== 8) errors.push('CEP inválido');
    } else if (formConfig.PROTOCOL_PREFIX === 'OR') {
        if (data.telefone && !validarTelefone_(data.telefone)) errors.push('Telefone inválido');
        if (data.qtdPessoas && !validarQuantidade_(data.qtdPessoas)) errors.push('Quantidade de pessoas inválida');
        if (data.reuniao1 && !validarDataHora_(data.reuniao1)) errors.push('1ª opção de reunião inválida');
        if (data.reuniao2 && !validarDataHora_(data.reuniao2)) errors.push('2ª opção de reunião inválida');
    } else if (formConfig.PROTOCOL_PREFIX === 'BP') {
        // O anexo é validado à parte (validarAnexoPdf_): ele já saiu de `data`.
        if (data.qtdIssues && !validarQuantidade_(data.qtdIssues)) errors.push('Quantidade de issues inválida');
    } else {
        // Lista de espera
        if (data.telefone && !validarTelefone_(data.telefone)) errors.push('Telefone inválido');
    }

    // Comum aos dois
    if (data.email && !validarEmail_(data.email)) errors.push('E-mail inválido');

    return { valid: errors.length === 0, errors: errors };
}

function validarCNPJ_(cnpj) {
    cnpj = String(cnpj).replace(/\D/g, '');
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    let t = cnpj.length - 2, d = cnpj.substring(t), n = cnpj.substring(0, t), s = 0, p = t - 7;
    for (let i = t; i >= 1; i--) { s += n.charAt(t - i) * p--; if (p < 2) p = 9; }
    let r = s % 11 < 2 ? 0 : 11 - s % 11;
    if (r !== parseInt(d.charAt(0))) return false;
    t += 1; n = cnpj.substring(0, t); s = 0; p = t - 7;
    for (let i = t; i >= 1; i--) { s += n.charAt(t - i) * p--; if (p < 2) p = 9; }
    r = s % 11 < 2 ? 0 : 11 - s % 11;
    return r === parseInt(d.charAt(1));
}

function validarCPF_(cpf) {
    cpf = String(cpf).replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(cpf.charAt(i)) * (10 - i);
    let r = 11 - (s % 11); if (r >= 10) r = 0;
    if (r !== parseInt(cpf.charAt(9))) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(cpf.charAt(i)) * (11 - i);
    r = 11 - (s % 11); if (r >= 10) r = 0;
    return r === parseInt(cpf.charAt(10));
}

function validarEmail_(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function validarTelefone_(tel) {
    const digits = String(tel).replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
}

function validarQuantidade_(v) {
    const n = Number(v);
    return !isNaN(n) && n >= 1 && n <= 999 && n === Math.floor(n);
}

/**
 * Aceita só o formato do `datetime-local` ("2026-08-10T14:30", com
 * segundos opcionais). Não checa se a data é futura: o navegador já
 * faz isso e um relógio adiantado do cliente não deve derrubar o envio.
 */
function validarDataHora_(v) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(String(v).trim());
}

/* ============================================================
 *  SANITIZAÇÃO
 * ============================================================ */

/* Campos de texto livre — cabem uma resposta, não um nome próprio. */
const CAMPOS_LONGOS = ['objetivo', 'produtosServicos', 'gargalo', 'objetivoBIM', 'observacoes'];

function sanitizeData_(data) {
    const cleaned = {};
    Object.keys(data).forEach(key => {
        let value = data[key];
        if (typeof value === 'string') {
            value = value.trim();
            value = value.replace(/<[^>]*>/g, '');
            const maxLen = CAMPOS_LONGOS.indexOf(key) !== -1 ? 2000 : 500;
            if (value.length > maxLen) value = value.substring(0, maxLen);
        }
        cleaned[key] = value;
    });
    return cleaned;
}

/* ============================================================
 *  RATE LIMITING
 * ============================================================ */

function checkRateLimit_(data, tipo) {
    const cache = CacheService.getScriptCache();
    const key = 'rl_' + tipo + '_' + (data.email || 'anon').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const windowSec = CONFIG.RATE_LIMIT_WINDOW_MIN * 60;

    const current = parseInt(cache.get(key) || '0');
    if (current >= CONFIG.RATE_LIMIT_MAX) {
        return { ok: false };
    }

    cache.put(key, String(current + 1), windowSec);
    return { ok: true };
}

/* ============================================================
 *  E-MAILS
 * ============================================================ */

function sendAdminEmail_(data, protocolo, formConfig) {
    const subject = `[${CONFIG.COMPANY_NAME}] ${formConfig.LABEL} · ${protocolo}`;
    const renderers = {
        'OR': renderOrcamentoRows_,
        'MB': renderCadastroRows_,
        'LE': renderListaEsperaRows_
    };
    const rows = renderers[formConfig.PROTOCOL_PREFIX](data);

    const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #EFEEE9; padding: 0;">
        <div style="background: #81161E; color: #EFEEE9; padding: 32px 40px;">
            <div style="font-size: 14px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.7;">${escapeHtml_(formConfig.LABEL)}</div>
            <div style="font-family: Georgia, serif; font-size: 36px; margin-top: 8px;">_modo_bim</div>
        </div>
        <div style="padding: 32px 40px; color: #470000;">
            <p style="font-size: 14px; color: #470000; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 4px;">Protocolo</p>
            <p style="font-family: Georgia, serif; font-size: 28px; margin: 0 0 32px; color: #81161E;">${escapeHtml_(protocolo)}</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                ${rows}
            </table>
        </div>
        <div style="background: #470000; color: #EFEEE9; padding: 16px 40px; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.8;">
            ${CONFIG.COMPANY_NAME}
        </div>
    </div>
    `;

    MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: subject,
        htmlBody: html,
        name: CONFIG.COMPANY_NAME
    });
}

function renderOrcamentoRows_(d) {
    return `
        ${renderRow_('Nome', d.nomeCompleto)}
        ${renderRow_('Empresa / Escritório', d.empresa)}
        ${renderRow_('E-mail', d.email)}
        ${renderRow_('Telefone', d.telefone)}
        ${renderRow_('Produtos e serviços', d.produtosServicos)}
        ${renderRow_('Gargalo hoje', d.gargalo)}
        ${renderRow_('Expectativa com BIM', d.objetivoBIM)}
        ${renderRow_('Pessoas no treinamento', d.qtdPessoas)}
        ${renderRow_('Software de interesse', d.softwareInteresse)}
        ${renderRow_('Nível da equipe', d.nivelEquipe)}
        ${renderRow_('Reunião — 1ª opção', formatDataHora_(d.reuniao1))}
        ${renderRow_('Reunião — 2ª opção', formatDataHora_(d.reuniao2))}
        ${renderRow_('Observações', d.observacoes)}
    `;
}

function renderCadastroRows_(d) {
    return `
        ${renderRow_('Razão Social', d.razaoSocial)}
        ${renderRow_('Nome Fantasia', d.nomeFantasia)}
        ${renderRow_('CNPJ', d.cnpj)}
        ${renderRow_('Inscrição Estadual', d.inscricaoEstadual)}
        ${renderRow_('Ramo de Atividade', d.ramoAtividade)}
        ${renderRow_('Representante', (d.cpfRepresentante || '') + ' · ' + (d.cargo || ''))}
        ${renderRow_('E-mail', d.email)}
        ${renderRow_('Telefone', d.telefone)}
        ${renderRow_('Site', d.site)}
        ${renderRow_('Endereço', formatEndereco_(d))}
        ${renderRow_('Cidade / UF', (d.cidade || '') + ' / ' + (d.estado || ''))}
    `;
}

function renderListaEsperaRows_(d) {
    return `
        ${renderRow_('Nome', d.nomeCompleto)}
        ${renderRow_('E-mail', d.email)}
        ${renderRow_('Telefone', d.telefone)}
        ${renderRow_('Cidade / UF', (d.cidade || '') + ' / ' + (d.estado || ''))}
        ${renderRow_('Empresa', d.empresa)}
        ${renderRow_('Cargo / Função', d.cargo)}
        ${renderRow_('Software Atual', d.softwareAtual)}
        ${renderRow_('Nível BIM', d.nivelBIM)}
        ${renderRow_('Software de Interesse', d.softwareInteresse)}
        ${renderRow_('Objetivo', d.objetivo)}
        ${renderRow_('Como Conheceu', d.comoConheceu)}
        ${renderRow_('BIMClub', d.bimclub)}
    `;
}

function sendClientEmail_(data, protocolo, formConfig) {
    if (!data.email || !validarEmail_(data.email)) return;

    const prefix = formConfig.PROTOCOL_PREFIX;
    const saudacao = escapeHtml_(
        prefix === 'MB'
            ? (data.razaoSocial || 'cliente')
            : (data.nomeCompleto || 'tudo bem')
    );

    const textos = {
        'OR': {
            subject: `Recebemos sua solicitação · ${protocolo}`,
            titulo: 'Recebido.',
            corpo: `Olá, ${saudacao}. Sua solicitação de orçamento chegou até nós. Vamos analisar o cenário que você descreveu e confirmar por este e-mail uma das duas opções de horário que você indicou para a reunião de alinhamento.`
        },
        'MB': {
            subject: `Recebemos seu cadastro · ${protocolo}`,
            titulo: 'Recebido.',
            corpo: `Olá, ${saudacao}. Seja bem-vindo à _modo_bim, estamos muito felizes em trabalharmos juntos. Suas informações chegaram até nós com sucesso. Em breve, nossa equipe entrará em contato.`
        },
        'LE': {
            subject: `Você está na lista de espera · ${protocolo}`,
            titulo: 'Você está dentro.',
            corpo: `Olá, ${saudacao}. Sua vaga na lista de espera da próxima turma está garantida. Avisaremos você pelo e-mail e WhatsApp informados assim que abrirmos as inscrições.`
        }
    }[prefix];

    const subject = textos.subject;
    const titulo = textos.titulo;
    const corpo = textos.corpo;

    const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #EFEEE9;">
        <div style="background: #81161E; color: #EFEEE9; padding: 56px 40px; text-align: center;">
            <div style="font-family: Georgia, serif; font-size: 42px; letter-spacing: 0.02em;">_modo_bim</div>
        </div>
        <div style="padding: 56px 40px; color: #470000; text-align: center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 32px;">
                <tr>
                    <td width="64" height="64" align="center" valign="middle" style="width: 64px; height: 64px; border: 1px solid #81161E; border-radius: 32px; color: #81161E; font-size: 28px; line-height: 64px; font-family: Arial, sans-serif;">
                        &#10003;
                    </td>
                </tr>
            </table>
            <h1 style="font-family: Georgia, serif; font-style: italic; font-size: 42px; color: #81161E; margin: 0 0 16px; font-weight: 400;">${titulo}</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #470000; max-width: 380px; margin: 0 auto 40px;">
                ${corpo}
            </p>
            <div style="border-top: 1px solid rgba(71,0,0,0.2); border-bottom: 1px solid rgba(71,0,0,0.2); padding: 20px; display: inline-block;">
                <div style="font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #470000; margin-bottom: 6px;">Protocolo</div>
                <div style="font-family: Georgia, serif; font-size: 24px; color: #81161E;">${escapeHtml_(protocolo)}</div>
            </div>
        </div>
        <div style="background: #470000; color: #EFEEE9; padding: 20px 40px; text-align: center; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">
            ${CONFIG.COMPANY_NAME}
        </div>
    </div>
    `;

    MailApp.sendEmail({
        to: data.email,
        subject: subject,
        htmlBody: html,
        name: CONFIG.COMPANY_NAME
    });
}

/* ============================================================
 *  CONVERSOR BCF → PDF (task 24)
 * ============================================================
 *  O PDF é gerado no navegador (bcf-para-pdf.html) e chega em
 *  `pdfBase64`. Ele existe aqui só para virar anexo: é tirado do
 *  payload antes da sanitização e nunca é gravado em planilha,
 *  fila do Notion ou log.
 *
 *  Ordem: valida → grava a linha (Envio = Pendente) → manda o
 *  e-mail → marca o Envio → Notion → responde. A linha é gravada
 *  ANTES do e-mail de propósito: se o envio falhar, o lead já está
 *  salvo e o front oferece o download como plano B.
 * ============================================================ */

const BCF_ENVIO = {
    PENDENTE: 'Pendente',
    ENVIADO: 'Enviado',
    COTA: 'Cota esgotada',
    FALHOU: 'Falhou'
};

/** Tira o PDF do payload (mutando `data`) e devolve o base64 cru. */
function extrairAnexo_(data) {
    const b64 = data && typeof data.pdfBase64 === 'string' ? data.pdfBase64 : '';
    if (data) delete data.pdfBase64;
    return b64;
}

/**
 * Decodifica e confere o anexo: base64 válido, começa com "%PDF-" e cabe
 * no teto. Devolve { ok, bytes } ou { ok:false, error }.
 */
function validarAnexoPdf_(b64) {
    const maxMB = Math.round(CONFIG.BCF_PDF_MAX_BYTES / 1024 / 1024);
    const limpo = String(b64 || '').replace(/^data:application\/pdf;base64,/, '').replace(/\s+/g, '');
    if (!limpo) return { ok: false, error: 'PDF ausente' };

    // conta barata antes de decodificar: 4 caracteres base64 = 3 bytes
    if (Math.floor(limpo.length * 3 / 4) > CONFIG.BCF_PDF_MAX_BYTES + 2) {
        return { ok: false, error: 'PDF acima de ' + maxMB + ' MB' };
    }

    let bytes;
    try {
        bytes = Utilities.base64Decode(limpo);
    } catch (err) {
        return { ok: false, error: 'PDF inválido' };
    }

    // "%PDF-" = 37 80 68 70 45
    const assinatura = [37, 80, 68, 70, 45];
    if (!bytes || bytes.length < assinatura.length || assinatura.some((b, i) => bytes[i] !== b)) {
        return { ok: false, error: 'O arquivo enviado não é um PDF' };
    }
    if (bytes.length > CONFIG.BCF_PDF_MAX_BYTES) {
        return { ok: false, error: 'PDF acima de ' + maxMB + ' MB' };
    }
    return { ok: true, bytes: bytes };
}

/** Nome de anexo seguro: sem acento, sem barra, até 80 caracteres, termina em .pdf. */
function nomeArquivoPdf_(nome) {
    const base = String(nome || '')
        .replace(/\.pdf$/i, '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^\w\-.]+/g, '_')
        .replace(/^[_.]+|[_.]+$/g, '')
        .substring(0, 76);
    return (base || 'issues_BCF') + '.pdf';
}

/** Checkbox do front → texto legível na planilha e no Notion. */
function simNao_(v) {
    return (v === true || v === 'true' || v === 'Sim' || v === 'sim') ? 'Sim' : 'Não';
}

/**
 * Grava o lead, tenta o e-mail com o anexo e devolve o objeto de resposta.
 * Nunca lança por causa do e-mail: falha vira code 'ENVIO_FALHOU'.
 */
function finalizarBcfPdf_(data, pdf, protocolo, formConfig, tipo) {
    data.pdfKB = String(Math.max(1, Math.round(pdf.bytes.length / 1024)));
    data.envio = BCF_ENVIO.PENDENTE;
    appendToSheet_(data, protocolo, formConfig);
    const linha = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(formConfig.SHEET_NAME).getLastRow();

    let detalhe = null;
    try {
        // A cota do Gmail gratuito é do projeto inteiro (100/dia). Conferir antes
        // evita uma exceção e deixa a causa registrada com o nome certo.
        if (MailApp.getRemainingDailyQuota() < 1 || !reservarEnvioBcf_()) {
            data.envio = BCF_ENVIO.COTA;
        } else {
            sendBcfPdfEmail_(data, pdf, protocolo);
            data.envio = BCF_ENVIO.ENVIADO;
        }
    } catch (mailErr) {
        data.envio = BCF_ENVIO.FALHOU;
        detalhe = String(mailErr);
    }

    marcarEnvio_(formConfig, linha, data.envio);
    if (data.envio !== BCF_ENVIO.ENVIADO) {
        logEvent_('AVISO', tipo, protocolo, 'PDF do conversor não enviado: ' + data.envio,
            { email: data.email, erro: detalhe });
    }

    if (notionAtivo_(formConfig)) {
        sendToNotion_(data, protocolo, formConfig);
    }

    if (data.envio === BCF_ENVIO.ENVIADO) {
        return { success: true, protocolo: protocolo, tipo: tipo, message: 'PDF enviado por e-mail' };
    }
    return {
        success: false,
        code: 'ENVIO_FALHOU',
        protocolo: protocolo,
        tipo: tipo,
        error: 'Não conseguimos enviar o e-mail agora.'
    };
}

/**
 * Conta um envio no balde da hora corrente. false quando o teto global
 * (CONFIG.BCF_MAX_ENVIOS_HORA) já foi atingido.
 */
function reservarEnvioBcf_() {
    const cache = CacheService.getScriptCache();
    const key = 'bcf_envios_' + Math.floor(Date.now() / 3600000);
    const atual = parseInt(cache.get(key) || '0');
    if (atual >= CONFIG.BCF_MAX_ENVIOS_HORA) return false;
    cache.put(key, String(atual + 1), 3600);
    return true;
}

/** Atualiza a célula "Envio" da linha recém-gravada. Nunca lança. */
function marcarEnvio_(formConfig, linha, valor) {
    try {
        const col = formConfig.COLUMNS.indexOf('Envio') + 1;
        SpreadsheetApp.getActiveSpreadsheet().getSheetByName(formConfig.SHEET_NAME)
            .getRange(linha, col).setValue(valor);
    } catch (err) {
        Logger.log('Falha ao marcar envio (linha ' + linha + '): ' + err);
    }
}

function sendBcfPdfEmail_(data, pdf, protocolo) {
    // texto livre vindo do front entra curto no e-mail (ver BCF_MAX_ENVIOS_HORA)
    const projeto = String(data.projeto || '').substring(0, 120);
    const nome = String(data.nome || '').substring(0, 80);
    const n = Number(data.qtdIssues) || 0;
    const issues = n ? (n + (n === 1 ? ' issue' : ' issues')) : 'as issues selecionadas';
    const saudacao = nome ? 'Olá, ' + escapeHtml_(nome) + '.' : 'Olá.';
    const nomeAnexo = nomeArquivoPdf_(data.pdfNome || (projeto ? projeto + '_BCF' : ''));

    const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #EFEEE9;">
        <div style="background: #81161E; color: #EFEEE9; padding: 56px 40px; text-align: center;">
            <div style="font-family: Georgia, serif; font-size: 42px; letter-spacing: 0.02em;">_modo_bim</div>
            <div style="font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; opacity: 0.75; margin-top: 10px;">conversor BCF → PDF</div>
        </div>
        <div style="padding: 56px 40px 40px; color: #470000; text-align: center;">
            <h1 style="font-family: Georgia, serif; font-style: italic; font-size: 42px; color: #81161E; margin: 0 0 16px; font-weight: 400;">Seu PDF chegou.</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #470000; max-width: 400px; margin: 0 auto 32px;">
                ${saudacao} Em anexo está o relatório com ${escapeHtml_(issues)}${projeto ? ' de <strong>' + escapeHtml_(projeto) + '</strong>' : ''}, pronto para encaminhar à equipe ou levar para a reunião de coordenação.
            </p>
            <div style="border-top: 1px solid rgba(71,0,0,0.2); border-bottom: 1px solid rgba(71,0,0,0.2); padding: 18px; display: inline-block; margin-bottom: 40px;">
                <div style="font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #470000; margin-bottom: 6px;">Protocolo</div>
                <div style="font-family: Georgia, serif; font-size: 22px; color: #81161E;">${escapeHtml_(protocolo)}</div>
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #470000; max-width: 420px; margin: 0 auto 8px;">
                Issue boa começa num projeto bem combinado. O <a href="https://modobim.com.br/kit.html" style="color: #81161E;">Kit de Projeto BIM</a> reúne o que precisa ser definido antes de modelar. E no <a href="https://chat.whatsapp.com/DPEoInYVkh6J0Af3Xw2A3Q" style="color: #81161E;">BIM Club</a> a conversa continua.
            </p>
        </div>
        <div style="padding: 0 40px 32px; color: #470000; text-align: center; font-size: 12px; line-height: 1.6; opacity: 0.75;">
            Você recebeu este e-mail porque pediu o relatório em modobim.com.br/bcf-para-pdf.html.
        </div>
        <div style="background: #470000; color: #EFEEE9; padding: 20px 40px; text-align: center; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">
            ${CONFIG.COMPANY_NAME}
        </div>
    </div>
    `;

    MailApp.sendEmail({
        to: data.email,
        subject: 'Seu relatório BCF em PDF · ' + (projeto || protocolo),
        htmlBody: html,
        name: CONFIG.COMPANY_NAME,
        attachments: [Utilities.newBlob(pdf.bytes, 'application/pdf', nomeAnexo)]
    });
}

/* ============================================================
 *  HELPERS
 * ============================================================ */

function jsonResponse_(obj) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Registra um evento na aba "Log de Erros" (durável) e no Cloud Logging.
 * Nunca lança: um problema ao logar jamais pode derrubar o envio.
 *
 *   level   — 'ERRO' | 'VALIDAÇÃO' | 'BLOQUEIO' | 'EXCEÇÃO' | 'AVISO'
 *   tipo    — tipo do formulário, quando conhecido
 *   proto   — protocolo, quando já gerado
 *   message — resumo curto
 *   detail  — objeto/string com o contexto (errors, e-mail, stack...)
 */
function logEvent_(level, tipo, proto, message, detail) {
    try {
        let det = detail == null ? ''
            : (typeof detail === 'string' ? detail : JSON.stringify(detail));
        if (det.length > LOG.MAX_DETAIL) det = det.substring(0, LOG.MAX_DETAIL);

        // Cloud Logging (painel Execuções do editor) — sempre, mesmo se a aba falhar
        console.error('[' + level + '] ' + (tipo || '-') + ' ' + message + ' ' + det);

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(LOG.SHEET_NAME);
        if (!sheet) {
            sheet = ss.insertSheet(LOG.SHEET_NAME);
            sheet.getRange(1, 1, 1, 6)
                .setValues([['Timestamp', 'Nível', 'Tipo', 'Protocolo', 'Mensagem', 'Detalhe']])
                .setFontWeight('bold');
            sheet.setFrozenRows(1);
            sheet.setColumnWidth(1, 150);
            sheet.setColumnWidth(5, 240);
            sheet.setColumnWidth(6, 480);
        }
        const tz = Session.getScriptTimeZone() || 'America/Belem';
        sheet.appendRow([
            Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss'),
            level || '', tipo || '', proto || '',
            String(message).substring(0, 500), det
        ]);
    } catch (err) {
        // último recurso: registro de execução
        Logger.log('Falha ao registrar log (' + message + '): ' + err);
    }
}

function renderRow_(label, value) {
    if (!value) return '';
    return `
        <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid rgba(71,0,0,0.12); font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #470000; width: 180px; vertical-align: top;">${escapeHtml_(label)}</td>
            <td style="padding: 10px 0; border-bottom: 1px solid rgba(71,0,0,0.12); color: #470000;">${escapeHtml_(value)}</td>
        </tr>
    `;
}

function formatEndereco_(d) {
    const parts = [d.logradouro, d.numero, d.complemento, d.bairro, d.cep].filter(Boolean);
    return parts.join(', ');
}

function escapeHtml_(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ============================================================
 *  TESTES — execute no editor para validar permissões
 * ============================================================ */

function testeOrcamento() {
    const fakeData = {
        tipo: 'orcamento',
        nomeCompleto: 'Maria das Graças',
        empresa: 'Glimmerock Arquitetura',
        email: 'jhonymarlon@gmail.com',
        telefone: '(91) 99999-9999',
        produtosServicos: 'Projetos de arquitetura residencial e gerenciamento de obras.',
        gargalo: 'Retrabalho e incompatibilidade entre os projetos complementares.',
        objetivoBIM: 'Reduzir erros em obra e padronizar as entregas do escritório.',
        qtdPessoas: '8',
        softwareInteresse: 'Revit, Navisworks',
        nivelEquipe: 'Equipe mista',
        reuniao1: '2026-09-10T14:30',
        reuniao2: '2026-09-12T09:00',
        observacoes: 'Preferência por reunião online.',
        userAgent: 'Teste manual via editor'
    };

    const formConfig = FORMS['orcamento'];
    ensureSheetExists_(formConfig);
    const protocolo = generateProtocol_(formConfig);
    appendToSheet_(fakeData, protocolo, formConfig);
    Logger.log('✅ Orçamento OK — Protocolo: ' + protocolo);
}

function testeCadastro() {
    const fakeData = {
        tipo: 'cadastro',
        razaoSocial: 'Glimmerock Arquitetura LTDA',
        nomeFantasia: 'Glimmerock',
        cnpj: '11.222.333/0001-81',
        inscricaoEstadual: '123456789',
        ramoAtividade: 'Arquitetura',
        cpfRepresentante: '111.444.777-35',
        cargo: 'Sócia-Diretora',
        email: 'jhonymarlon@gmail.com',
        telefone: '(91) 99999-9999',
        site: 'www.glimmerock.com.br',
        cep: '66000-000',
        logradouro: 'Av. Presidente Vargas',
        numero: '100',
        complemento: 'Sala 501',
        bairro: 'Campina',
        cidade: 'Belém',
        estado: 'PA',
        userAgent: 'Teste manual via editor'
    };

    const formConfig = FORMS['cadastro'];
    ensureSheetExists_(formConfig);
    const protocolo = generateProtocol_(formConfig);
    appendToSheet_(fakeData, protocolo, formConfig);
    Logger.log('✅ Cadastro OK — Protocolo: ' + protocolo);
}

function testeListaEspera() {
    const fakeData = {
        tipo: 'lista-espera',
        nomeCompleto: 'Maria das Graças',
        email: 'jhonymarlon@gmail.com',
        telefone: '(91) 98888-7777',
        cidade: 'Belém',
        estado: 'PA',
        empresa: 'Glimmerock Arquitetura',
        cargo: 'Arquiteta',
        softwareAtual: 'AutoCAD',
        nivelBIM: 'Iniciante',
        softwareInteresse: 'Archicad',
        objetivo: 'Quero aprender BIM do zero para aplicar no escritório.',
        comoConheceu: 'Instagram',
        bimclub: 'Sim',
        userAgent: 'Teste manual via editor'
    };

    const formConfig = FORMS['lista-espera'];
    ensureSheetExists_(formConfig);
    const protocolo = generateProtocol_(formConfig);
    appendToSheet_(fakeData, protocolo, formConfig);
    Logger.log('✅ Lista de Espera OK — Protocolo: ' + protocolo);
}

/**
 * Conversor BCF: grava uma linha de teste e manda um PDF de verdade para o
 * ADMIN_EMAIL. Serve para autorizar o escopo de anexo e conferir o e-mail.
 */
function testeBcfPdf() {
    const pdf = Utilities.newBlob('<h1>Teste do conversor BCF</h1>', 'text/html').getAs('application/pdf');
    const fakeData = {
        tipo: 'bcf-pdf',
        email: CONFIG.ADMIN_EMAIL,
        nome: '[TESTE] Maria das Graças',
        optin: true,
        projeto: 'Residencial Glimmerock',
        titulo: 'Relatório de issues',
        qtdIssues: '3',
        arquivoBcf: 'teste.bcfzip',
        pdfNome: 'Residencial_Glimmerock_BCF.pdf',
        userAgent: 'Teste manual via editor'
    };
    const formConfig = FORMS['bcf-pdf'];
    ensureSheetExists_(formConfig);
    const protocolo = generateProtocol_(formConfig);
    const r = finalizarBcfPdf_(fakeData, { ok: true, bytes: pdf.getBytes() }, protocolo, formConfig, 'bcf-pdf');
    Logger.log((r.success ? '✅ ' : '❌ ') + 'BCF → PDF: ' + JSON.stringify(r));
}

/**
 * Mantém compatibilidade com o nome antigo.
 */
function testeManual() {
    testeCadastro();
}

/**
 * Valida a integração com o Notion sem gravar na planilha:
 * cria uma página de teste em cada database configurado.
 */
function testeNotion() {
    const fakes = {
        'orcamento': {
            nomeCompleto: '[TESTE] Maria das Graças', empresa: 'Glimmerock Arquitetura',
            email: 'jhonymarlon@gmail.com', telefone: '(91) 99999-9999',
            produtosServicos: 'Projetos de arquitetura residencial e gerenciamento de obras.',
            gargalo: 'Retrabalho e incompatibilidade entre os complementares.',
            objetivoBIM: 'Reduzir erros em obra e padronizar as entregas.',
            qtdPessoas: '8',
            // com vírgula de propósito: exercita a quebra do nMultiSelect_()
            softwareInteresse: 'Revit, Navisworks',
            nivelEquipe: 'Equipe mista',
            reuniao1: '2026-09-10T14:30', reuniao2: '2026-09-12T09:00',
            observacoes: 'Preferência por reunião online.', userAgent: 'testeNotion()'
        },
        'cadastro': {
            razaoSocial: '[TESTE] Glimmerock Arquitetura LTDA', nomeFantasia: 'Glimmerock',
            cnpj: '11.222.333/0001-81', ramoAtividade: 'Arquitetura',
            cpfRepresentante: '111.444.777-35', cargo: 'Sócia-Diretora',
            email: 'jhonymarlon@gmail.com', telefone: '(91) 99999-9999',
            site: 'www.glimmerock.com.br', cep: '66000-000',
            logradouro: 'Av. Presidente Vargas', numero: '100', bairro: 'Campina',
            cidade: 'Belém', estado: 'PA', userAgent: 'testeNotion()'
        },
        'lista-espera': {
            nomeCompleto: '[TESTE] Maria das Graças', email: 'jhonymarlon@gmail.com',
            telefone: '(91) 98888-7777', cidade: 'Belém', estado: 'PA',
            empresa: 'Glimmerock Arquitetura', cargo: 'Arquiteta',
            softwareAtual: 'AutoCAD', nivelBIM: 'Iniciante', softwareInteresse: 'Archicad',
            objetivo: 'Quero aprender BIM do zero para aplicar no escritório.',
            comoConheceu: 'Instagram', bimclub: 'Sim', userAgent: 'testeNotion()'
        }
    };

    Object.keys(fakes).forEach(tipo => {
        const formConfig = FORMS[tipo];
        const dbId = PropertiesService.getScriptProperties().getProperty(formConfig.NOTION_DB_KEY);
        if (!dbId) {
            Logger.log('⚠️  ' + formConfig.NOTION_DB_KEY + ' não configurado — pulando ' + tipo);
            return;
        }
        const res = pushNotionPage_(fakes[tipo], formConfig.PROTOCOL_PREFIX + '-TESTE-0000', formConfig);
        Logger.log((res.ok ? '✅ ' : '❌ ') + tipo + ' → ' + (res.ok ? res.pageId : res.error));
    });
}
