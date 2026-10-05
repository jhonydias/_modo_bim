/* Task 24 — tipo 'bcf-pdf': o conversor gratuito que troca o PDF pelo e-mail.
 *
 * Três promessas a travar:
 *   1. o PDF chega anexado no e-mail de quem pediu, e só lá;
 *   2. o lead é gravado mesmo quando o e-mail não sai (e o front fica sabendo);
 *   3. o base64 do PDF nunca vai parar na planilha, na Fila Notion ou no log.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadGas, eventoPost, respostaJson } from './helpers/loadGas.js';
import { payloadBcfPdf, PDF_MINIMO, PDF_MINIMO_B64 } from './helpers/fixtures.js';

let gas;
beforeEach(() => { gas = loadGas(); });

const postar = (corpo) => respostaJson(gas.doPost(eventoPost(corpo)));
const aba = () => gas.__planilha.getSheetByName('BCF → PDF');
const coluna = (nome) => gas.FORMS['bcf-pdf'].COLUMNS.indexOf(nome);
const ultimaLinha = () => aba().dados[aba().dados.length - 1];

/** Tudo que foi gravado em qualquer aba, como texto — para caçar o base64. */
const tudoGravado = () => gas.__planilha.getSheets()
    .map((s) => JSON.stringify(s.dados)).join('\n');

describe('bcf-pdf — caminho feliz', () => {
    it('manda um e-mail para quem pediu, com o PDF anexado', () => {
        const r = postar(payloadBcfPdf());

        expect(r.success).toBe(true);
        expect(r.protocolo).toMatch(/^BP-\d{4}-0001$/);

        expect(gas.__chamadas.emails).toHaveLength(1);
        const email = gas.__chamadas.emails[0];
        expect(email.to).toBe('beltrana@teste.com.br');
        expect(email.subject).toBe('Seu relatório BCF em PDF · Residencial Teste');
        expect(email.attachments).toHaveLength(1);

        const anexo = email.attachments[0];
        expect(anexo.getContentType()).toBe('application/pdf');
        expect(anexo.getName()).toBe('Residencial_Teste_BCF.pdf');
        expect(Buffer.from(anexo.getBytes()).toString()).toBe(PDF_MINIMO);
    });

    /* Gmail gratuito: 100 destinatários/dia para o projeto inteiro. Um aviso por
       lead cortaria a capacidade da ferramenta pela metade (task 24 §03.5). */
    it('não manda aviso para o admin', () => {
        postar(payloadBcfPdf());
        expect(gas.__chamadas.emails.map((e) => e.to)).not.toContain(gas.CONFIG.ADMIN_EMAIL);
    });

    it('grava o lead com o tamanho do COLUMNS e o envio marcado', () => {
        postar(payloadBcfPdf());
        const linha = ultimaLinha();

        expect(linha).toHaveLength(gas.FORMS['bcf-pdf'].COLUMNS.length);
        expect(linha[coluna('E-mail')]).toBe('beltrana@teste.com.br');
        expect(linha[coluna('Nome')]).toBe('Beltrana de Teste');
        expect(linha[coluna('Aceita Conteúdos')]).toBe('Sim');
        expect(linha[coluna('Issues')]).toBe('3');
        expect(linha[coluna('PDF (KB)')]).toBe('1');
        expect(linha[coluna('Envio')]).toBe('Enviado');
    });

    it('opt-in desmarcado vira "Não"', () => {
        postar(payloadBcfPdf({ optin: false }));
        expect(ultimaLinha()[coluna('Aceita Conteúdos')]).toBe('Não');
    });

    it('nome é opcional', () => {
        const r = postar(payloadBcfPdf({ nome: '' }));
        expect(r.success).toBe(true);
        expect(gas.__chamadas.emails[0].htmlBody).toContain('Olá.');
    });

    it('o texto livre entra escapado no e-mail', () => {
        postar(payloadBcfPdf({ projeto: 'Torre "A" & B' }));
        expect(gas.__chamadas.emails[0].htmlBody).toContain('Torre &quot;A&quot; &amp; B');
    });
});

describe('bcf-pdf — o PDF não fica guardado', () => {
    it('nem na planilha', () => {
        postar(payloadBcfPdf());
        expect(tudoGravado()).not.toContain(PDF_MINIMO_B64);
    });

    it('nem na Fila Notion quando o Notion falha', () => {
        gas.__props.set('NOTION_DB_LEADS_BCF', 'db-leads');
        gas.__notion.lancar = 'timeout';
        postar(payloadBcfPdf());

        expect(gas.__planilha.getSheetByName('Fila Notion').getLastRow()).toBe(2);
        expect(tudoGravado()).not.toContain(PDF_MINIMO_B64);
    });

    it('nem no log quando a validação recusa', () => {
        postar(payloadBcfPdf({ email: 'invalido' }));
        expect(tudoGravado()).not.toContain(PDF_MINIMO_B64);
        expect(JSON.stringify(gas.__chamadas.console)).not.toContain(PDF_MINIMO_B64);
    });
});

describe('bcf-pdf — recusas (nada é gravado, nada é enviado)', () => {
    const recusas = [
        ['sem e-mail', { email: '' }, 'E-mail é obrigatório'],
        ['e-mail inválido', { email: 'a@b' }, 'E-mail inválido'],
        ['sem PDF', { pdfBase64: undefined }, 'PDF ausente'],
        ['base64 malformado', { pdfBase64: 'não é base64!' }, 'PDF inválido'],
        ['arquivo que não é PDF', { pdfBase64: Buffer.from('PK\u0003\u0004zip').toString('base64') }, 'não é um PDF'],
        ['quantidade de issues absurda', { qtdIssues: '-2' }, 'Quantidade de issues inválida']
    ];

    it.each(recusas)('%s', (_caso, extra, mensagem) => {
        const r = postar(payloadBcfPdf(extra));
        expect(r.success).toBe(false);
        expect(r.error).toBe('Dados inválidos');
        expect(r.errors.join(' ')).toContain(mensagem);
        expect(aba()).toBeNull();
        expect(gas.__chamadas.emails).toHaveLength(0);
    });

    it('PDF acima do teto é recusado sem decodificar', () => {
        let decodificou = false;
        const original = gas.Utilities.base64Decode;
        gas.Utilities.base64Decode = (s) => { decodificou = true; return original(s); };

        const grande = 'A'.repeat(Math.ceil(gas.CONFIG.BCF_PDF_MAX_BYTES * 4 / 3) + 8);
        const r = postar(payloadBcfPdf({ pdfBase64: grande }));

        expect(r.errors.join(' ')).toContain('PDF acima de 15 MB');
        expect(decodificou).toBe(false);
    });

    it('aceita o prefixo data: que o navegador às vezes deixa', () => {
        const r = postar(payloadBcfPdf({ pdfBase64: 'data:application/pdf;base64,' + PDF_MINIMO_B64 }));
        expect(r.success).toBe(true);
    });
});

/* O lead é gravado antes do e-mail: se o envio falhar, ele já está salvo e o
   front oferece o download como plano B (code ENVIO_FALHOU). */
describe('bcf-pdf — e-mail que não sai', () => {
    it('cota diária zerada: não tenta, grava e avisa o front', () => {
        gas.__mail.cota = 0;
        const r = postar(payloadBcfPdf());

        expect(r).toMatchObject({ success: false, code: 'ENVIO_FALHOU' });
        expect(r.protocolo).toMatch(/^BP-/);
        expect(gas.__chamadas.emails).toHaveLength(0);
        expect(ultimaLinha()[coluna('Envio')]).toBe('Cota esgotada');
    });

    it('MailApp lançando: grava, marca "Falhou" e registra AVISO', () => {
        gas.__mail.lancar = 'Service invoked too many times';
        const r = postar(payloadBcfPdf());

        expect(r).toMatchObject({ success: false, code: 'ENVIO_FALHOU' });
        expect(ultimaLinha()[coluna('Envio')]).toBe('Falhou');
        const log = gas.__planilha.getSheetByName('Log de Erros');
        expect(log.dados.some((l) => l[1] === 'AVISO' && l[2] === 'bcf-pdf')).toBe(true);
    });

    it('teto global por hora: o 31º envio vira ENVIO_FALHOU mesmo para e-mail novo', () => {
        for (let i = 0; i < gas.CONFIG.BCF_MAX_ENVIOS_HORA; i++) {
            expect(postar(payloadBcfPdf({ email: `lead${i}@teste.com` })).success).toBe(true);
        }
        const r = postar(payloadBcfPdf({ email: 'mais-um@teste.com' }));
        expect(r.code).toBe('ENVIO_FALHOU');
        expect(gas.__chamadas.emails).toHaveLength(gas.CONFIG.BCF_MAX_ENVIOS_HORA);
        expect(ultimaLinha()[coluna('E-mail')]).toBe('mais-um@teste.com');
    });
});

describe('bcf-pdf — Notion opcional', () => {
    it('sem database configurado, pula o Notion e não enfileira', () => {
        postar(payloadBcfPdf());
        expect(gas.__chamadas.notion).toHaveLength(0);
        expect(gas.__planilha.getSheetByName('Fila Notion')).toBeNull();
    });

    it('com database configurado, espelha com o status do envio', () => {
        gas.__props.set('NOTION_DB_LEADS_BCF', 'db-leads');
        postar(payloadBcfPdf());

        expect(gas.__chamadas.notion).toHaveLength(1);
        const { payload } = gas.__chamadas.notion[0];
        expect(payload.parent.database_id).toBe('db-leads');
        expect(payload.properties['Envio']).toEqual({ select: { name: 'Enviado' } });
        expect(payload.properties['Lead'].title[0].text.content).toBe('Beltrana de Teste');
    });

    /* Os outros formulários continuam enfileirando sem database: lá a falta de
       configuração é erro, não escolha. */
    it('não muda o comportamento dos outros formulários', () => {
        gas.__props.delete('NOTION_DB_LISTA_ESPERA');
        expect(gas.notionAtivo_(gas.FORMS['lista-espera'])).toBe(true);
    });
});

describe('bcf-pdf — rate limit e nome do anexo', () => {
    it('o 4º envio do mesmo e-mail em 5 minutos é barrado', () => {
        for (let i = 0; i < 3; i++) expect(postar(payloadBcfPdf()).success).toBe(true);
        expect(postar(payloadBcfPdf()).error).toBe('Muitas tentativas. Aguarde alguns minutos.');
    });

    it.each([
        ['Obra São João / Bloco 2.pdf', 'Obra_Sao_Joao_Bloco_2.pdf'],
        ['../../etc/passwd', 'etc_passwd.pdf'],
        ['', 'issues_BCF.pdf'],
        ['x'.repeat(200), 'x'.repeat(76) + '.pdf']
    ])('nomeArquivoPdf_(%j) → %s', (entrada, saida) => {
        expect(gas.nomeArquivoPdf_(entrada)).toBe(saida);
    });
});
