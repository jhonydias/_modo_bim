/* Task 19 §3.6 — js/config.js é a fonte única do endpoint desde a task 20.
 *
 * O pior cenário do site inteiro cabe numa linha deste arquivo: DEV_MODE ligado
 * em produção faz todo visitante ver "solicitação enviada" com protocolo -DEV
 * sem que nada seja salvo. Por isso este arquivo de teste existe sozinho.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const raiz = (p) => new URL(`../../${p}`, import.meta.url);
const ler = (p) => readFileSync(raiz(p), 'utf8');

/** Avalia js/config.js num objeto window mínimo e devolve o MODOBIM_CONFIG. */
function lerConfig() {
    const janela = {};
    new Function('window', ler('js/config.js'))(janela);
    return janela.MODOBIM_CONFIG;
}

const PAGINAS_COM_FORMULARIO = ['cadastro.html', 'lista-espera.html', 'contrato.html'];

describe('js/config.js', () => {
    it('DEV_MODE está desligado no arquivo que vai para o ar', () => {
        expect(lerConfig().DEV_MODE).toBe(false);
    });

    it('ENDPOINT_URL é uma URL de web app publicado do Apps Script', () => {
        expect(lerConfig().ENDPOINT_URL).toMatch(
            /^https:\/\/script\.google\.com\/macros\/s\/AKfyc[\w-]+\/exec$/
        );
    });

    it('ENDPOINT_URL termina em /exec, nunca /dev', () => {
        // /dev é a URL do @HEAD: exige login e responde HTML, não JSON.
        const url = lerConfig().ENDPOINT_URL;
        expect(url.endsWith('/exec')).toBe(true);
        expect(url).not.toContain('/dev');
    });

    it('a URL bate com o DEPLOYMENT_ID de scripts/deploy.mjs', () => {
        // O deploy.mjs se recusa a rodar quando diverge; aqui a descoberta é antecipada.
        const deploy = ler('scripts/deploy.mjs');
        const id = deploy.match(/const DEPLOYMENT_ID = '([^']+)'/)?.[1];
        expect(id, 'DEPLOYMENT_ID não encontrado em scripts/deploy.mjs').toBeTruthy();
        expect(lerConfig().ENDPOINT_URL).toContain(id);
    });
});

describe('ordem de carregamento nas páginas com formulário', () => {
    it.each(PAGINAS_COM_FORMULARIO)('%s carrega js/config.js antes do script inline', (pagina) => {
        const html = ler(pagina);
        const posConfig = html.indexOf('<script src="js/config.js"></script>');
        const posInline = html.indexOf('const CONFIG = window.MODOBIM_CONFIG');

        expect(posConfig, `${pagina} não carrega js/config.js`).toBeGreaterThan(-1);
        expect(posInline, `${pagina} não lê window.MODOBIM_CONFIG`).toBeGreaterThan(-1);
        // Invertido, CONFIG sairia vazio e o formulário cairia no erro de configuração.
        expect(posConfig).toBeLessThan(posInline);
    });

    it.each(PAGINAS_COM_FORMULARIO)('%s não tem endpoint hardcoded', (pagina) => {
        expect(ler(pagina)).not.toMatch(/script\.google\.com\/macros/);
    });
});
