import { defineConfig, devices } from '@playwright/test';

/* Task 19 §01 e §05.
 *
 * Dois modos, um código:
 *   npm run test:e2e       → --grep-invert @live : nada toca em produção
 *   npm run test:e2e:live  → --grep @live        : envio real, ato deliberado
 *
 * O site é HTML estático servido da raiz. file:// não serve: a origem `null`
 * invalida o fetch cross-origin para o Apps Script. Por isso o webServer.
 */
export default defineConfig({
    testDir: './tests/e2e',
    /* Envio real grava linha na planilha de produção: um retry é um cadastro
       duplicado. Por isso o default é 0 e `test:e2e:live` nunca o altera.
       `npm run test:e2e` passa --retries=1 na linha de comando: o WebKit no
       Windows derruba a página de vez em quando no index.html (7 vídeos +
       animações), com falhas que mudam de lugar a cada rodada e passam quando
       rodadas sozinhas. O retry cobre o engine, não o site — e como só vale para
       a rodada interceptada, nada em produção é tocado duas vezes. */
    retries: 0,
    timeout: 45_000,
    /* generateProtocol_ lê getLastRow() e grava em seguida, sem LockService:
       envios simultâneos podem gerar protocolo duplicado. §05.2. */
    workers: 1,
    fullyParallel: false,
    reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],

    use: {
        baseURL: 'http://localhost:4173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },

    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } }
    ],

    webServer: {
        command: 'npm run serve',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000
    }
});
