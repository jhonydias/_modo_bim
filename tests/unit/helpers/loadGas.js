/* Task 19 §2.2 — rodar script/Code.gs em node:vm com os globais do Apps Script dublados.
 *
 * Os stubs REGISTRAM chamadas, não só devolvem valor: é assim que se afirma
 * "o e-mail do cliente saiu uma vez" e "a linha gravada tem 16 colunas na ordem
 * do COLUMNS". A planilha é um array em memória.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const CODE_GS = new URL('../../../script/Code.gs', import.meta.url);

/* ============================================================
 *  Planilha em memória
 * ============================================================ */
class FakeRange {
    constructor(sheet, linha, coluna, nLinhas, nColunas) {
        this.sheet = sheet;
        this.linha = linha;
        this.coluna = coluna;
        this.nLinhas = nLinhas;
        this.nColunas = nColunas;
    }
    getValues() {
        const out = [];
        for (let i = 0; i < this.nLinhas; i++) {
            const linha = this.sheet.dados[this.linha - 1 + i] || [];
            const fatia = [];
            for (let j = 0; j < this.nColunas; j++) {
                const v = linha[this.coluna - 1 + j];
                fatia.push(v === undefined ? '' : v);
            }
            out.push(fatia);
        }
        return out;
    }
    setValues(valores) {
        valores.forEach((linha, i) => {
            const alvo = this.linha - 1 + i;
            if (!this.sheet.dados[alvo]) this.sheet.dados[alvo] = [];
            linha.forEach((v, j) => { this.sheet.dados[alvo][this.coluna - 1 + j] = v; });
        });
        return this;
    }
    setValue(valor) {
        return this.setValues([[valor]]);
    }
    /* Formatação: registrada, sem efeito nos dados. */
    setBackground() { return this; }
    setFontColor() { return this; }
    setFontWeight() { return this; }
    setFontFamily() { return this; }
    setVerticalAlignment() { return this; }
    setWrap() { return this; }
    setHorizontalAlignment() { return this; }
    setBorder() { return this; }
    setNumberFormat() { return this; }
}

class FakeSheet {
    constructor(nome) {
        this.nome = nome;
        this.dados = [];
        this.larguras = {};
        this.linhasCongeladas = 0;
    }
    getName() { return this.nome; }
    getLastRow() { return this.dados.length; }
    getLastColumn() { return this.dados.reduce((m, l) => Math.max(m, l.length), 0); }
    getRange(linha, coluna, nLinhas = 1, nColunas = 1) {
        return new FakeRange(this, linha, coluna, nLinhas, nColunas);
    }
    appendRow(valores) { this.dados.push([...valores]); return this; }
    deleteRow(n) { this.dados.splice(n - 1, 1); return this; }
    setFrozenRows(n) { this.linhasCongeladas = n; return this; }
    setColumnWidth(c, w) { this.larguras[c] = w; return this; }
    setRowHeight() { return this; }
    autoResizeColumn() { return this; }
    getDataRange() { return this.getRange(1, 1, Math.max(this.dados.length, 1), Math.max(this.getLastColumn(), 1)); }
}

class FakeSpreadsheet {
    constructor() {
        this.abas = new Map();
        /* Ligue para simular cota/permissão estourando na criação de aba (§04.9). */
        this.insertSheetLanca = null;
    }
    getSheetByName(nome) { return this.abas.get(nome) || null; }
    insertSheet(nome) {
        if (this.insertSheetLanca) throw new Error(this.insertSheetLanca);
        const s = new FakeSheet(nome);
        this.abas.set(nome, s);
        return s;
    }
    getSheets() { return [...this.abas.values()]; }
    /* Atalho de teste: cria a aba já com linhas. */
    semear(nome, linhas) {
        const s = this.abas.get(nome) || new FakeSheet(nome);
        s.dados = linhas.map((l) => [...l]);
        this.abas.set(nome, s);
        return s;
    }
}

/* ============================================================
 *  Sandbox
 * ============================================================ */
export function loadGas(overrides = {}) {
    const planilha = new FakeSpreadsheet();
    const cache = new Map();
    const propriedades = new Map([
        ['NOTION_TOKEN', 'ntn_teste'],
        ['NOTION_DB_ORCAMENTOS', 'db-orcamentos'],
        ['NOTION_DB_CADASTROS', 'db-cadastros'],
        ['NOTION_DB_LISTA_ESPERA', 'db-lista-espera']
    ]);

    const chamadas = {
        emails: [],
        notion: [],
        logger: [],
        console: [],
        triggers: []
    };

    /* Resposta padrão do Notion: 200. Troque com sandbox.__notion.responder = ... */
    const notion = {
        responder: () => ({ codigo: 200, corpo: JSON.stringify({ id: 'pagina-fake' }) }),
        lancar: null
    };

    const base = {
        console: {
            log: (...a) => chamadas.console.push(['log', ...a]),
            error: (...a) => chamadas.console.push(['error', ...a]),
            warn: (...a) => chamadas.console.push(['warn', ...a]),
            info: (...a) => chamadas.console.push(['info', ...a])
        },
        Logger: { log: (m) => chamadas.logger.push(String(m)) },

        SpreadsheetApp: { getActiveSpreadsheet: () => planilha },

        Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },

        Utilities: {
            /* Só o suficiente para os formatos usados no Code.gs:
               'dd/MM/yyyy HH:mm:ss' e 'dd/MM/yyyy HH:mm'. */
            formatDate(data, _tz, formato) {
                const p = (n) => String(n).padStart(2, '0');
                return formato
                    .replace('dd', p(data.getDate()))
                    .replace('MM', p(data.getMonth() + 1))
                    .replace('yyyy', data.getFullYear())
                    .replace('HH', p(data.getHours()))
                    .replace('mm', p(data.getMinutes()))
                    .replace('ss', p(data.getSeconds()));
            },
            sleep() {}
        },

        ContentService: {
            MimeType: { JSON: 'application/json' },
            createTextOutput(texto) {
                return {
                    texto,
                    mime: null,
                    setMimeType(m) { this.mime = m; return this; },
                    getContent() { return this.texto; }
                };
            }
        },

        MailApp: {
            sendEmail(opts) {
                if (base.MailApp.lancar) throw new Error(base.MailApp.lancar);
                chamadas.emails.push(opts);
            },
            lancar: null
        },

        PropertiesService: {
            getScriptProperties: () => ({
                getProperty: (k) => (propriedades.has(k) ? propriedades.get(k) : null),
                setProperty: (k, v) => propriedades.set(k, v),
                deleteProperty: (k) => propriedades.delete(k)
            })
        },

        ScriptApp: {
            getProjectTriggers: () => chamadas.triggers,
            newTrigger(nome) {
                const t = { nome, handler: nome, getHandlerFunction: () => nome };
                const encadeia = {
                    timeBased: () => encadeia,
                    everyMinutes: () => encadeia,
                    create: () => { chamadas.triggers.push(t); return t; }
                };
                return encadeia;
            }
        },

        CacheService: {
            getScriptCache: () => ({
                get: (k) => (cache.has(k) ? cache.get(k) : null),
                put: (k, v) => cache.set(k, String(v)),
                remove: (k) => cache.delete(k)
            })
        },

        UrlFetchApp: {
            fetch(url, opts) {
                chamadas.notion.push({ url, opts, payload: JSON.parse(opts.payload || '{}') });
                if (notion.lancar) throw new Error(notion.lancar);
                const r = notion.responder();
                return {
                    getResponseCode: () => r.codigo,
                    getContentText: () => r.corpo
                };
            }
        }
    };

    const sandbox = { ...base, ...overrides };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(CODE_GS, 'utf8'), sandbox, { filename: 'Code.gs' });

    /* `function` declarada no topo vira propriedade do global — por isso
       sandbox.doPost e sandbox.validarCNPJ_ já existem. `const` não: CONFIG,
       FORMS, NOTION e LOG vivem no escopo léxico do contexto e precisam ser
       lidos por avaliação. Sem isto, gas.FORMS seria undefined. */
    Object.assign(sandbox, vm.runInContext('({ CONFIG, FORMS, NOTION, LOG })', sandbox));
    sandbox.avaliar = (expr) => vm.runInContext(expr, sandbox);

    /* Ferramentas do teste, fora do namespace do Code.gs. */
    sandbox.__planilha = planilha;
    sandbox.__cache = cache;
    sandbox.__props = propriedades;
    sandbox.__chamadas = chamadas;
    sandbox.__notion = notion;
    sandbox.__mail = base.MailApp;

    return sandbox;
}

/** Monta o objeto `e` que o Apps Script entrega ao doPost. */
export function eventoPost(corpo) {
    const contents = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
    return { postData: { contents, type: 'text/plain' } };
}

/** Lê o JSON que o doPost devolveu (é um TextOutput dublado). */
export function respostaJson(saida) {
    return JSON.parse(saida.getContent());
}
