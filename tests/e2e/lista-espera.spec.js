/* Task 19 §5.5 — jornada da lista de espera (BIM Club). 3 etapas, protocolo LE. */
import { test, expect } from '@playwright/test';
import {
    dadosListaEspera, interceptarEnvio, esconderConfig,
    preencherCampos, marcarPilulas, comecar, avancar, etapaAtiva, registrarEnvio, MARCA
} from './helpers/suite.js';

async function preencherJornada(page, dados) {
    await comecar(page);
    await expect(page.locator('#stage-1')).toHaveClass(/active/);

    await preencherCampos(page, {
        nomeCompleto: dados.nomeCompleto, email: dados.email,
        cidade: dados.cidade, estado: dados.estado
    });
    await page.locator('[name="telefone"]').type(dados.telefone, { delay: 10 });
    await avancar(page);

    await preencherCampos(page, {
        empresa: dados.empresa, cargo: dados.cargo,
        softwareAtual: dados.softwareAtual, nivelBIM: dados.nivelBIM
    });
    await avancar(page);

    await marcarPilulas(page, 'softwareInteresse', ['Revit']);
    await preencherCampos(page, { objetivo: dados.objetivo, comoConheceu: dados.comoConheceu });
    await marcarPilulas(page, 'bimclub', ['Sim']);
    await expect(page.locator('#stage-3')).toHaveClass(/active/);
}

test.describe('jornada da lista de espera (interceptada)', () => {
    test.beforeEach(async ({ page }) => { await page.goto('/lista-espera.html'); });

    test('etapa vazia não avança e acusa os cinco obrigatórios', async ({ page }) => {
        await comecar(page);
        await avancar(page);

        await expect(page.locator('#error-1')).toHaveClass(/visible/);
        await expect(page.locator('#stage-1 .field.error')).toHaveCount(5);
        expect(await etapaAtiva(page)).toBe('stage-1');
    });

    /* bimclub é obrigatório no backend e no front só existe como pílula
       alimentando um hidden. Sem ele, o servidor recusa e nada no visual
       denuncia — por isso o teste é explícito. */
    test('sem escolher o BIM Club, a etapa 3 não envia', async ({ page }) => {
        const capturados = await interceptarEnvio(page);
        await comecar(page);
        await preencherCampos(page, {
            nomeCompleto: 'Ciclana', email: 'c@teste.com', cidade: 'Belém', estado: 'PA'
        });
        await page.locator('[name="telefone"]').type('9132221111', { delay: 10 });
        await avancar(page);
        await preencherCampos(page, {
            cargo: 'Arquiteta', softwareAtual: 'AutoCAD', nivelBIM: 'Iniciante'
        });
        await avancar(page);
        await marcarPilulas(page, 'softwareInteresse', ['Revit']);
        await preencherCampos(page, { objetivo: 'Sair do CAD' });

        await page.locator('#submitBtn').click();

        expect(capturados, 'enviou sem o bimclub').toHaveLength(0);
        await expect(page.locator('#error-3')).toHaveClass(/visible/);
        await expect(page.locator('[data-pill-group="bimclub"]')).toHaveClass(/error/);
    });

    test('envio bem-sucedido mostra o protocolo LE', async ({ page }) => {
        const capturados = await interceptarEnvio(page, { success: true, protocolo: 'LE-2026-9999' });
        await preencherJornada(page, dadosListaEspera());
        await page.locator('#submitBtn').click();

        await expect(page.locator('#stage-success')).toHaveClass(/active/);
        await expect(page.locator('#protocolNumber')).toHaveText('LE-2026-9999');

        expect(capturados).toHaveLength(1);
        expect(capturados[0].tipo).toBe('lista-espera');
        expect(capturados[0].bimclub).toBe('Sim');
        expect(capturados[0].comoConheceu).toBe('Instagram');
        expect(capturados[0]).not.toHaveProperty('website_url');
    });

    /* Antes do commit 066a774 esta página caía na tela de sucesso mesmo quando o
       servidor recusava: só tratava `if (result.success)`, sem ramo de falha. */
    test('recusa do servidor não mostra a tela de sucesso', async ({ page }) => {
        await interceptarEnvio(page, { success: false, errors: ['E-mail inválido'] });
        await preencherJornada(page, dadosListaEspera());
        await page.locator('#submitBtn').click();

        await expect(page.locator('#error-3')).toHaveText('E-mail inválido');
        await expect(page.locator('#stage-success')).not.toHaveClass(/active/);
    });

    test('js/config.js com 404 não produz sucesso falso', async ({ page }) => {
        await esconderConfig(page);
        await page.reload();

        const capturados = await interceptarEnvio(page);
        await preencherJornada(page, dadosListaEspera());
        await page.locator('#submitBtn').click();

        await expect(page.locator('#error-3'))
            .toHaveText('Configuração do site não carregou. Recarregue a página e tente de novo.');
        await expect(page.locator('#stage-success')).not.toHaveClass(/active/);
        expect(capturados).toHaveLength(0);
    });
});

test.describe('@live envio real da lista de espera', () => {
    test.describe.configure({ mode: 'serial', retries: 0 });

    test('@live uma inscrição real entra e volta com protocolo', async ({ page }) => {
        test.slow();
        const dados = dadosListaEspera({ live: true });

        await page.goto('/lista-espera.html');
        await preencherJornada(page, dados);
        await page.locator('#submitBtn').click();

        await expect(page.locator('#stage-success')).toHaveClass(/active/, { timeout: 30_000 });

        const protocolo = await page.locator('#protocolNumber').textContent();
        expect(protocolo).toMatch(/^LE-\d{4}-\d{4}$/);
        expect(protocolo).not.toContain('DEV');

        const arquivo = registrarEnvio({
            tipo: 'lista-espera', protocolo, email: dados.email, marca: MARCA
        });
        console.log(`[@live] ${protocolo} registrado em ${arquivo}`);
    });
});
