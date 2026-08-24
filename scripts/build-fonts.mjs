#!/usr/bin/env node
/**
 * Gera as versões subset das fontes self-hosted. Rodar com: npm run build:fonts
 *
 * Por que existe (task 21 · T4): os .woff2 originais do Fontshare vêm com o charset
 * inteiro — ~24 KB por peso, cinco pesos, 122 KB só de Sentient. O orçamento do §2.3
 * da task é 90 KB de fonte no primeiro paint. Cortar para o repertório que o site
 * realmente escreve resolve sem tocar no design.
 *
 * O conjunto retido NÃO é adivinhado: é a união de
 *   (a) todo caractere que aparece nos cinco HTMLs publicados, e
 *   (b) uma margem fixa — ASCII, Latin-1 completo, Latin Extended-A e a pontuação
 *       tipográfica/símbolos que o site usa (→, travessão, aspas curvas, ×, ©…).
 * A margem existe para que um texto novo em português não caia no fallback sem
 * ninguém perceber. Ao acrescentar conteúdo com repertório novo (grego, cirílico,
 * emoji tipográfico), rode este script de novo.
 *
 * Entrada:  fonts/<nome>.woff2         (arquivos originais, versionados)
 * Saída:    fonts/<nome>.subset.woff2  (o que o CSS realmente referencia)
 */
import subsetFont from 'subset-font';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';

const HTMLS = ['index.html', 'cadastro.html', 'contrato.html', 'lista-espera.html', 'produtos.html', '404.html'];

/**
 * Faixas sempre retidas, independentemente do conteúdo atual das páginas.
 *
 * Latin Extended-A (U+0100–U+017F) ficou de fora depois de medido: custa 16,5 KB
 * somados nos seis arquivos e cobre repertório (Š, ő, ū) que o site não escreve.
 * Medição dos três cenários, em 23/08/2026:
 *   só o que os HTMLs escrevem hoje ...... 127 chars →  87,1 KB  (frágil: texto novo
 *                                                                cai no fallback)
 *   + ASCII + Latin-1 + avulsos (este) ... 230 chars → 117,3 KB
 *   + Latin Extended-A ................... 358 chars → 133,8 KB
 */
const FAIXAS = [
  [0x0020, 0x007e], // ASCII imprimível
  [0x00a0, 0x00ff], // Latin-1: todos os acentos do português
];
const AVULSOS = '‐‑‒–—―‖‘’‚‛“”„†‡•…‰′″‹›⁄€™©®°±×÷−∕·→←↑↓↔⌀№§¶';

function repertorio() {
  const chars = new Set();
  for (const [ini, fim] of FAIXAS) {
    for (let c = ini; c <= fim; c++) chars.add(String.fromCodePoint(c));
  }
  for (const c of AVULSOS) chars.add(c);
  for (const arquivo of HTMLS) {
    for (const c of readFileSync(arquivo, 'utf8')) chars.add(c);
  }
  chars.delete('\n'); chars.delete('\r'); chars.delete('\t');
  return [...chars].join('');
}

const texto = repertorio();
console.log(`repertório retido: ${[...texto].length} caracteres\n`);

const originais = readdirSync('fonts')
  .filter(f => f.endsWith('.woff2') && !f.endsWith('.subset.woff2'))
  .sort();

let antes = 0, depois = 0;
for (const arquivo of originais) {
  const entrada = `fonts/${arquivo}`;
  const saida = entrada.replace(/\.woff2$/, '.subset.woff2');
  const buf = await subsetFont(readFileSync(entrada), texto, { targetFormat: 'woff2' });
  writeFileSync(saida, buf);
  const de = statSync(entrada).size, para = buf.length;
  antes += de; depois += para;
  console.log(`  ${arquivo.padEnd(30)} ${(de / 1024).toFixed(1).padStart(6)} KB → ${(para / 1024).toFixed(1).padStart(6)} KB  (−${Math.round((1 - para / de) * 100)}%)`);
}
console.log(`\n  ${'TOTAL'.padEnd(30)} ${(antes / 1024).toFixed(1).padStart(6)} KB → ${(depois / 1024).toFixed(1).padStart(6)} KB  (−${Math.round((1 - depois / antes) * 100)}%)`);
console.log(`\n  Orçamento do §2.3 da task 21: 90 KB no primeiro paint. ${depois / 1024 <= 90 ? 'OK.' : 'ESTOURADO.'}`);
