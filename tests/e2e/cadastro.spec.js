/* Task 19 §5.4 — jornada da proposta.
 *
 * A jornada roda interceptada em toda rodada de `npm test`. O envio real vive no
 * bloco @live, que só roda em `npm run test:e2e:live` — ato deliberado, uma vez.
 */
import { test, expect } from '@playwright/test';
import {
    dadosProposta, interceptarEnvio, derrubarRede, esconderConfig,
    preencherCampos, marcarPilulas, comecar, avancar, voltar, etapaAtiva,
    registrarEnvio, MARCA
} from './helpers/suite.js';

/** Capa → etapa 4, deixando tudo pronto para o clique de envio. */
async function preencherJornada(page, dados) {
    await comecar(page);
    await expect(page.locator('#stage-1')).toHaveClass(/active/);

    await preencherCampos(page, {
        nomeCompleto: dados.nomeCompleto, empresa: dados.empresa, email: dados.email
    });
    await page.locator('[name="telefone"]').type(dados.telefone, { delay: 10 });
    await avancar(page);

    await preencherCampos(page, {
        produtosServicos: dados.produtosServicos,
        gargalo: dados.gargalo,
        objetivoBIM: dados.objetivoBIM
    });
    await avancar(page);

    await preencherCampos(page, { qtdPessoas: dados.qtdPessoas });
    await marcarPilulas(page, 'softwareInteresse', ['Revit', 'Archicad']);
    await marcarPilulas(page, 'nivelEquipe', ['Equipe mista']);
    await avancar(page);

    await preencherCampos(page, { observacoes: dados.observacoes });
    await expect(page.locator('#stage-4')).toHaveClass(/active/);
}

test.describe('jornada da proposta (interceptada)', () => {
    test.beforeEach(async ({ page }) => { await page.goto('/cadastro.html'); });

    test('etapa vazia não avança e acusa os obrigatórios', async ({ page }) => {
        await comecar(page);
        await avancar(page);

        await expect(page.locator('#error-1')).toHaveClass(/visible/);
        await expect(page.locator('#stage-1 .field.error')).toHaveCount(4);
        expect(await etapaAtiva(page)).toBe('stage-1');
    });

    test('o telefone sai mascarado ao ser digitado', async ({ page }) => {
        await comecar(page);
        await page.locator('[name="telefone"]').type('91988887777', { delay: 10 });
        await expect(page.locator('[name="telefone"]')).toHaveValue('(91) 98888-7777');
    });

    test('marcar "Outro" revela o campo e passa a exigi-lo', async ({ page }) => {
        await preencherJornada(page, dadosProposta());
        await voltar(page);

        await marcarPilulas(page, 'softwareInteresse', ['Outro']);
        await expect(page.locator('.field-reveal')).toHaveClass(/open/);

        await avancar(page);
        expect(await etapaAtiva(page), 'avançou sem dizer qual software').toBe('stage-3');

        await preencherCampos(page, { softwareOutro: 'Solibri' });
        await avancar(page);
        expect(await etapaAtiva(page)).toBe('stage-4');
    });

    test('qtdPessoas 0 reprova e 5 passa', async ({ page }) => {
        await comecar(page);
        await preencherCampos(page, dadosCompletosEtapa1());
        await avancar(page);
        await preencherCampos(page, dadosCompletosEtapa2());
        await avancar(page);

        await preencherCampos(page, { qtdPessoas: '0' });
        await marcarPilulas(page, 'softwareInteresse', ['Revit']);
        await marcarPilulas(page, 'nivelEquipe', ['Equipe mista']);
        await avancar(page);
        expect(await etapaAtiva(page)).toBe('stage-3');
        await expect(page.locator('#stage-3 .field.error .field-error').first())
            .toHaveText('Informe um número de 1 a 999');

        await preencherCampos(page, { qtdPessoas: '5' });
        await avancar(page);
        expect(await etapaAtiva(page)).toBe('stage-4');
    });

    /* Achado da implementação da task 19, reproduzido em Chromium e WebKit.
     *
     * O validador visual roda no blur e revela a mensagem de erro do campo, que
     * empurra ~12px tudo que está abaixo. Quem digita um valor inválido e clica
     * direto no próximo controle tem o clique engolido: o mousedown sai num
     * elemento e o mouseup em outro. Precisa clicar duas vezes.
     *
     * Só acontece no caminho de erro — o estado válido usa ::after posicionado,
     * que não desloca nada. O teste congela o comportamento atual; se for
     * corrigido (reservando a altura da mensagem), ele falha e avisa. */
    test('o primeiro clique depois de um valor inválido é engolido pelo deslocamento', async ({ page }) => {
        await comecar(page);
        await preencherCampos(page, dadosCompletosEtapa1());
        await avancar(page);
        await preencherCampos(page, dadosCompletosEtapa2());
        await avancar(page);

        const pilula = page.locator('[data-pill-group="softwareInteresse"] .pill').first();
        // coordenada de documento: o clique rola a página, e boundingBox é relativo à viewport
        const topoNoDocumento = () =>
            pilula.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

        const campo = page.locator('[name="qtdPessoas"]');
        await campo.click();
        const antes = await topoNoDocumento();
        await campo.type('0', { delay: 20 });

        await pilula.click();
        const depois = await topoNoDocumento();

        expect(depois - antes, 'a mensagem de erro deslocou o conteúdo').toBeGreaterThan(5);
        await expect(pilula, 'o primeiro clique se perdeu').not.toHaveClass(/selected/);

        await pilula.click();
        await expect(pilula, 'o segundo clique funciona').toHaveClass(/selected/);
    });

    test('Voltar preserva o que já foi digitado', async ({ page }) => {
        const dados = dadosProposta();
        await preencherJornada(page, dados);

        for (let i = 0; i < 3; i++) await voltar(page);
        expect(await etapaAtiva(page)).toBe('stage-1');
        await expect(page.locator('[name="nomeCompleto"]')).toHaveValue(dados.nomeCompleto);
    });

    test('envio bem-sucedido mostra o protocolo e a tela de sucesso', async ({ page }) => {
        const capturados = await interceptarEnvio(page, { success: true, protocolo: 'OR-2026-9999' });
        await preencherJornada(page, dadosProposta());
        await page.locator('#submitBtn').click();

        await expect(page.locator('#stage-success')).toHaveClass(/active/);
        await expect(page.locator('#protocolNumber')).toHaveText('OR-2026-9999');

        expect(capturados).toHaveLength(1);
        expect(capturados[0].tipo).toBe('orcamento');
        expect(capturados[0].softwareInteresse).toBe('Revit, Archicad');
        expect(capturados[0]).not.toHaveProperty('website_url');
    });

    test('o botão do Calendly aponta para a agenda certa, em nova aba', async ({ page }) => {
        await interceptarEnvio(page);
        await preencherJornada(page, dadosProposta());
        await page.locator('#submitBtn').click();
        await expect(page.locator('#stage-success')).toHaveClass(/active/);

        const botao = page.locator('.success-cta-btn');
        // URL corrigida no commit 3f0ae4b: a anterior (propos_bim) responde 404
        await expect(botao).toHaveAttribute('href', 'https://calendly.com/modobim/proposta');
        await expect(botao).toHaveAttribute('target', '_blank');
        await expect(botao).toHaveAttribute('rel', /noopener/);
    });

    test('recusa do servidor mostra o motivo real e não perde os dados', async ({ page }) => {
        await interceptarEnvio(page, {
            success: false, error: 'Dados inválidos', errors: ['E-mail inválido', 'Telefone inválido']
        });
        const dados = dadosProposta();
        await preencherJornada(page, dados);
        await page.locator('#submitBtn').click();

        await expect(page.locator('#error-4')).toHaveClass(/visible/);
        await expect(page.locator('#error-4')).toHaveText('E-mail inválido · Telefone inválido');
        expect(await etapaAtiva(page)).toBe('stage-4');
        await expect(page.locator('[name="observacoes"]')).toHaveValue(dados.observacoes);
    });

    test('sem rede, a mensagem é de conexão e não há tela de sucesso', async ({ page }) => {
        await derrubarRede(page);
        await preencherJornada(page, dadosProposta());
        await page.locator('#submitBtn').click();

        await expect(page.locator('#error-4'))
            .toHaveText('Erro ao enviar. Verifique sua conexão e tente novamente.');
        await expect(page.locator('#stage-success')).not.toHaveClass(/active/);
    });

    /* A regressão que a task 20 quase introduziu, travada no browser real. */
    test('js/config.js com 404 não produz sucesso falso', async ({ page }) => {
        await esconderConfig(page);
        await page.reload();

        const capturados = await interceptarEnvio(page);
        await preencherJornada(page, dadosProposta());
        await page.locator('#submitBtn').click();

        await expect(page.locator('#error-4'))
            .toHaveText('Configuração do site não carregou. Recarregue a página e tente de novo.');
        await expect(page.locator('#stage-success')).not.toHaveClass(/active/);
        await expect(page.locator('#protocolNumber')).not.toHaveText('OR-2026-DEV');
        expect(capturados, 'chegou a postar sem configuração').toHaveLength(0);
    });
});

/* ============================================================
 *  @live — envio real. Roda só em `npm run test:e2e:live`.
 * ============================================================
 *  Grava linha na planilha de produção, cria página no Notion e dispara dois
 *  e-mails. Um envio por rodada; o protocolo fica em test-results/enviados.json
 *  para a faxina.
 */
test.describe('@live envio real da proposta', () => {
    test.describe.configure({ mode: 'serial', retries: 0 });

    test('@live uma proposta real entra e volta com protocolo', async ({ page }) => {
        test.slow(); // Apps Script + Notion + 2 e-mails levam alguns segundos
        const dados = dadosProposta({ live: true });

        await page.goto('/cadastro.html');
        await preencherJornada(page, dados);
        await page.locator('#submitBtn').click();

        await expect(page.locator('#stage-success')).toHaveClass(/active/, { timeout: 30_000 });

        const protocolo = await page.locator('#protocolNumber').textContent();
        expect(protocolo).toMatch(/^OR-\d{4}-\d{4}$/);
        expect(protocolo, 'veio DEV: o config não carregou ou DEV_MODE está ligado')
            .not.toContain('DEV');

        const arquivo = registrarEnvio({
            tipo: 'orcamento', protocolo, email: dados.email, marca: MARCA
        });
        console.log(`[@live] ${protocolo} registrado em ${arquivo}`);
    });
});

function dadosCompletosEtapa1() {
    const d = dadosProposta();
    return { nomeCompleto: d.nomeCompleto, empresa: d.empresa, email: d.email, telefone: d.telefone };
}

function dadosCompletosEtapa2() {
    const d = dadosProposta();
    return { produtosServicos: d.produtosServicos, gargalo: d.gargalo, objetivoBIM: d.objetivoBIM };
}
