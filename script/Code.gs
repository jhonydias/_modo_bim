/**
 * ============================================================
 *  _modo_bim — Backend Apps Script
 *  2026
 * ============================================================
 *  Recebe dois tipos de formulário (HTML hospedados no GitHub
 *  Pages) e armazena em abas separadas da mesma planilha,
 *  gerando protocolo único e disparando e-mails de confirmação.
 *
 *    tipo: 'cadastro'      → aba "Cadastros"      · MB-2026-NNNN
 *    tipo: 'lista-espera'  → aba "Lista de Espera" · LE-2026-NNNN
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
    SEND_ADMIN_EMAIL: true
};

/* ============================================================
 *  SCHEMAS — configuração por tipo de formulário
 * ============================================================ */
const FORMS = {
    'cadastro': {
        SHEET_NAME: 'Cadastros',
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
    }
};

/* ============================================================
 *  ENTRY POINTS — Web App
 * ============================================================ */

function doPost(e) {
    try {
        if (!e || !e.postData || !e.postData.contents) {
            return jsonResponse_({ success: false, error: 'Payload vazio' });
        }

        let data;
        try {
            data = JSON.parse(e.postData.contents);
        } catch (err) {
            return jsonResponse_({ success: false, error: 'JSON inválido' });
        }

        // Detecta tipo (default = cadastro p/ compatibilidade com versão antiga)
        const tipo = (data.tipo || 'cadastro').toString().trim();
        const formConfig = FORMS[tipo];
        if (!formConfig) {
            return jsonResponse_({ success: false, error: 'Tipo de formulário inválido' });
        }

        // Sanitização
        data = sanitizeData_(data);

        // Rate limiting
        const rateCheck = checkRateLimit_(data, tipo);
        if (!rateCheck.ok) {
            return jsonResponse_({
                success: false,
                error: 'Muitas tentativas. Aguarde alguns minutos.'
            });
        }

        // Validação server-side
        const validation = validatePayload_(data, formConfig);
        if (!validation.valid) {
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

        // Insere linha
        appendToSheet_(data, protocolo, formConfig);

        // E-mails (não bloqueante)
        try {
            if (CONFIG.SEND_ADMIN_EMAIL) sendAdminEmail_(data, protocolo, formConfig);
            if (CONFIG.SEND_CLIENT_EMAIL) sendClientEmail_(data, protocolo, formConfig);
        } catch (mailErr) {
            Logger.log('Falha no envio de e-mail: ' + mailErr);
        }

        return jsonResponse_({
            success: true,
            protocolo: protocolo,
            tipo: tipo,
            message: 'Recebido com sucesso'
        });

    } catch (err) {
        Logger.log('Erro em doPost: ' + err + '\n' + err.stack);
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

/* ============================================================
 *  SANITIZAÇÃO
 * ============================================================ */

function sanitizeData_(data) {
    const cleaned = {};
    Object.keys(data).forEach(key => {
        let value = data[key];
        if (typeof value === 'string') {
            value = value.trim();
            value = value.replace(/<[^>]*>/g, '');
            // Campo de texto livre (objetivo) precisa de mais espaço
            const maxLen = key === 'objetivo' ? 2000 : 500;
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
    const rows = (formConfig.PROTOCOL_PREFIX === 'MB')
        ? renderCadastroRows_(data)
        : renderListaEsperaRows_(data);

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

    const isWaitlist = formConfig.PROTOCOL_PREFIX === 'LE';
    const subject = isWaitlist
        ? `Você está na lista de espera · ${protocolo}`
        : `Recebemos seu cadastro · ${protocolo}`;

    const saudacao = escapeHtml_(
        isWaitlist
            ? (data.nomeCompleto || 'tudo bem')
            : (data.razaoSocial || 'cliente')
    );

    const titulo = isWaitlist ? 'Você está dentro.' : 'Recebido.';
    const corpo = isWaitlist
        ? `Olá, ${saudacao}. Sua vaga na lista de espera da próxima turma está garantida. Avisaremos você pelo e-mail e WhatsApp informados assim que abrirmos as inscrições.`
        : `Olá, ${saudacao}. Seja bem-vindo à _modo_bim, estamos muito felizes em trabalharmos juntos. Suas informações chegaram até nós com sucesso. Em breve, nossa equipe entrará em contato.`;

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
 *  HELPERS
 * ============================================================ */

function jsonResponse_(obj) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
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
 * Mantém compatibilidade com o nome antigo.
 */
function testeManual() {
    testeCadastro();
}
