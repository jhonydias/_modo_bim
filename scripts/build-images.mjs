#!/usr/bin/env node
/**
 * Gera AVIF + WebP das imagens do site. Rodar com: npm run build:images
 *
 * O GitHub Pages não tem build: as derivadas são geradas aqui, na máquina, e
 * commitadas. Saída em img/opt/, espelhando a estrutura de img/.
 *
 * As larguras NÃO foram estimadas. Foram medidas com o Chrome real, rolando a
 * página inteira em três viewports (task 21 · T5/T6, 23/08/2026):
 *
 *   elemento          360 CSS px      676 CSS px      567 CSS px    maior necessidade
 *   hero              mobile 412      tablet 768      desktop 1440    940 px @2x
 *   teamImg           360             676             567            1134 px @2x
 *   faixa (figure)    340             340             340             680 px @2x
 *
 * A faixa tem largura fixa de 340 px em qualquer viewport — por isso `sizes="340px"`
 * no HTML e uma única largura de saída por arquivo.
 *
 * Onde a origem é menor que a largura pedida, o arquivo é pulado: upscale não cria
 * detalhe, só bytes. É o caso do hero (793 px nativos contra 940 px de necessidade
 * no desktop retina) — dívida registrada, o original em resolução maior não existe
 * no repositório nem em img/modobimreal/.
 */
import sharp from 'sharp';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * [origem, larguras]
 * A maior largura nunca deve passar da largura nativa do arquivo — o script
 * verifica e avisa quando isso acontece, em vez de gerar upscale silencioso.
 */
const FONTES = [
  // Hero: nativo 793x706. 400 serve o mobile 1x, 793 serve o resto até onde dá.
  ['img/hero.jpg', [400, 793]],

  // Seção "quem somos". A foto é trocada por JS entre as três, na mesma caixa.
  ['img/founders.jpg', [800, 1200]],
  ['img/joene.jpg', [800, 1200]],
  ['img/dayana.jpg', [800, 1200]],

  // Faixa "no mundo real" — fotos (nativo 1080x1920, exceto foto-12 em 720x1280).
  ['img/real/foto-01.jpg', [680, 1020]],
  ['img/real/foto-02.jpg', [680, 1020]],
  ['img/real/foto-03.jpg', [680, 1020]],
  ['img/real/foto-04.jpg', [680, 1020]],
  ['img/real/foto-12.jpg', [680]],

  // Pôsteres dos vídeos da faixa. O atributo poster= aceita um único URL, sem
  // negociação de formato: só o WebP destes é usado no HTML (suporte universal
  // desde 2020). O AVIF é gerado junto porque não custa e serve de referência.
  ['img/real/clip-06.jpg', [680]],
  ['img/real/clip-07.jpg', [640]],
  ['img/real/clip-08.jpg', [640]],
  ['img/real/clip-09.jpg', [640]],
  ['img/real/clip-10.jpg', [640]],
  ['img/real/clip-11.jpg', [640]],
  ['img/real/clip-13.jpg', [576]],

  // Logo das três páginas de formulário. Não é um <img>: entra como background-image
  // em caixas de 132x32 (header) e 84x21 (footer), com background-size de 320 e 205 px.
  // Fundo de background não negocia formato nem densidade sem image-set(), então o CSS
  // usa uma única saída — a de 500 px, que é o nativo e cobre 1,5x no header e 2,4x no
  // footer. O PNG original fica: é ele que o JSON-LD declara como logo da organização,
  // e crawler de schema não negocia formato.
  ['img/logo.png', [320, 500]],
];

const QUALIDADE = { avif: 52, webp: 78 };

let totalAntes = 0, totalDepois = 0;
const avisos = [];

for (const [origem, larguras] of FONTES) {
  const base = path.basename(origem, path.extname(origem));
  const destino = path.join('img/opt', path.dirname(origem).replace(/^img\/?/, ''));
  await mkdir(destino, { recursive: true });

  const meta = await sharp(origem).metadata();
  const bytesOrigem = (await stat(origem)).size;
  totalAntes += bytesOrigem;
  console.log(`\n${origem}  (${meta.width}x${meta.height}, ${(bytesOrigem / 1024).toFixed(1)} KB)`);

  for (const w of larguras) {
    if (w > meta.width) {
      avisos.push(`${origem}: pedido ${w}px, nativo ${meta.width}px — pulado (não fazemos upscale)`);
      console.log(`  ! ${w}px > nativo ${meta.width}px — pulado`);
      continue;
    }
    for (const fmt of ['avif', 'webp']) {
      const saida = path.join(destino, `${base}-${w}.${fmt}`);
      const info = await sharp(origem)
        .resize({ width: w, withoutEnlargement: true })
        .toFormat(fmt, { quality: QUALIDADE[fmt] })
        .toFile(saida);
      // Só a maior largura entra na conta do total: é a que substitui o original.
      if (w === Math.max(...larguras.filter(x => x <= meta.width)) && fmt === 'avif') totalDepois += info.size;
      const marca = info.size >= bytesOrigem ? '  <- MAIOR QUE O ORIGINAL' : '';
      if (marca) avisos.push(`${saida} (${(info.size / 1024).toFixed(1)} KB) ficou maior que ${origem} (${(bytesOrigem / 1024).toFixed(1)} KB) — baixar a qualidade ou manter em JPEG`);
      console.log(`    ${path.basename(saida).padEnd(28)} ${(info.size / 1024).toFixed(1).padStart(7)} KB${marca}`);
    }
  }
}

/**
 * og-image.png fica em PNG, de propósito. O WhatsApp e vários crawlers de preview não
 * negociam formato: um og:image em AVIF quebra a prévia do link, que é justamente o
 * canal de aquisição do site. Aqui só se aperta a compressão, sem trocar de formato.
 */
{
  const antes = (await stat('og-image.png')).size;
  const buf = await sharp('og-image.png').png({ compressionLevel: 9, palette: true }).toBuffer();
  if (buf.length < antes) {
    // writeFile, e NÃO sharp(buf).toFile(): passar o buffer de volta pelo sharp o
    // reencoda com as opções padrão e joga fora o ganho da compressão acima.
    await writeFile('og-image.png', buf);
    console.log(`\nog-image.png  ${(antes / 1024).toFixed(1)} KB → ${(buf.length / 1024).toFixed(1)} KB (−${Math.round((1 - buf.length / antes) * 100)}%, continua PNG)`);
  } else {
    console.log(`\nog-image.png  já está no melhor tamanho (${(antes / 1024).toFixed(1)} KB) — não mexido`);
  }
}

console.log(`\n${'='.repeat(70)}`);
console.log(`Originais somados:            ${(totalAntes / 1024).toFixed(1).padStart(8)} KB`);
console.log(`AVIF na maior largura:        ${(totalDepois / 1024).toFixed(1).padStart(8)} KB   (−${Math.round((1 - totalDepois / totalAntes) * 100)}%)`);
if (avisos.length) {
  console.log(`\nAvisos (${avisos.length}):`);
  avisos.forEach(a => console.log(`  ! ${a}`));
} else {
  console.log('\nSem avisos.');
}
