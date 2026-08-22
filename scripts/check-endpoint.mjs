#!/usr/bin/env node
/**
 * Guarda de regressão da task 20.
 *
 * Falha se alguma página HTML voltar a ter a URL do Apps Script escrita
 * direto no arquivo. O endpoint tem um lugar só: js/config.js.
 *
 * Uso: npm run check:endpoint
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONTE_UNICA = 'js/config.js';
const PADRAO = /script\.google\.com\/macros/;

const htmls = readdirSync(RAIZ).filter((f) => f.endsWith('.html'));
const infratores = [];

for (const arquivo of htmls) {
    const linhas = readFileSync(join(RAIZ, arquivo), 'utf8').split(/\r?\n/);
    linhas.forEach((linha, i) => {
        if (PADRAO.test(linha)) infratores.push(`${arquivo}:${i + 1}  ${linha.trim()}`);
    });
}

// A fonte única precisa existir e conter o endpoint — se sumir, os
// formulários param de enviar sem que nada mais acuse.
let config = '';
try {
    config = readFileSync(join(RAIZ, FONTE_UNICA), 'utf8');
} catch {
    console.error(`✗ ${FONTE_UNICA} não existe. É a fonte única do endpoint.`);
    process.exit(1);
}
if (!PADRAO.test(config)) {
    console.error(`✗ ${FONTE_UNICA} não contém uma URL de Apps Script.`);
    process.exit(1);
}

if (infratores.length) {
    console.error('✗ URL do Apps Script hardcoded em HTML — deve vir de ' + FONTE_UNICA + ':\n');
    infratores.forEach((l) => console.error('  ' + l));
    console.error('\n  Ver tasks/20/task_text.md §03.');
    process.exit(1);
}

console.log(`✓ ${htmls.length} HTML sem endpoint hardcoded; ${FONTE_UNICA} é a fonte única.`);
