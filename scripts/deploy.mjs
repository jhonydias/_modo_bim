#!/usr/bin/env node
/**
 * Publica script/Code.gs no Apps Script — sempre na MESMA implantação.
 *
 * É isto que mantém a URL do Web App estável: `clasp deploy -i <id>` cria
 * uma versão nova DENTRO da implantação existente, em vez de criar uma
 * implantação nova (que geraria URL nova e obrigaria a mexer no front).
 *
 * Nunca use `clasp deploy` sem `-i`, nem "Implantar → Nova implantação"
 * no editor. Ver tasks/20/task_text.md §00.
 *
 * Uso: npm run deploy
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ID da implantação de produção. Confirmável em Implantar → Gerenciar
// implantações; é o mesmo trecho AKfyc... da URL em js/config.js.
const DEPLOYMENT_ID = 'AKfycbyRHztm-hPx5A_k4-BCxOQje0Stq-ifz_VGU4u3Z7fbOy2_rAmfWB8vQ0lfvIdbZso';

function clasp(...args) {
    console.log('\n$ clasp ' + args.join(' '));
    try {
        return execFileSync('npx', ['--no-install', 'clasp', ...args], {
            cwd: RAIZ,
            encoding: 'utf8',
            stdio: ['inherit', 'pipe', 'inherit'],
            shell: process.platform === 'win32'
        });
    } catch {
        // O clasp já imprimiu o próprio erro em stderr. Aqui só traduzimos os
        // dois tropeços de setup, para não devolver stack trace de Node.
        console.error('\n✗ O comando `clasp ' + args[0] + '` falhou. Checklist de setup:\n');
        console.error('  1. npm install');
        console.error('  2. Apps Script API ligada em https://script.google.com/home/usersettings');
        console.error('  3. npx clasp login');
        console.error('  4. .clasp.json na raiz, com o scriptId e "rootDir": "script"\n');
        console.error('  Detalhes em tasks/20/task_text.md §02.');
        process.exit(1);
    }
}

// A URL que o front usa hoje. Depois do deploy ela tem que continuar igual.
const config = readFileSync(join(RAIZ, 'js', 'config.js'), 'utf8');
const urlAtual = (config.match(/https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/) || [])[0];
if (!urlAtual) {
    console.error('✗ Não achei a URL do endpoint em js/config.js.');
    process.exit(1);
}
if (!urlAtual.includes(DEPLOYMENT_ID)) {
    console.error('✗ O DEPLOYMENT_ID deste script não bate com a URL de js/config.js.');
    console.error('  config.js: ' + urlAtual);
    console.error('  deploy.mjs: ' + DEPLOYMENT_ID);
    console.error('  Reconcilie os dois antes de publicar (tasks/20 §02.1).');
    process.exit(1);
}

console.log('Implantação alvo: ' + DEPLOYMENT_ID);

clasp('push', '--force');

const carimbo = new Date().toISOString().slice(0, 16).replace('T', ' ');
const saida = clasp('deploy', '-i', DEPLOYMENT_ID, '-d', `deploy ${carimbo}`);
console.log(saida);

// Verificação: o clasp ecoa o ID da implantação publicada. Se vier outro,
// uma implantação nova foi criada e o front está apontando para a antiga.
if (saida.includes(DEPLOYMENT_ID)) {
    console.log('\n✓ Publicado na mesma implantação. A URL não mudou:');
    console.log('  ' + urlAtual);
    console.log('  Nenhum HTML precisa ser tocado.');
} else {
    console.error('\n⚠ O clasp não confirmou o ID esperado na saída acima.');
    console.error('  Confira em Implantar → Gerenciar implantações se a URL continua ' + urlAtual);
    process.exit(1);
}
