/* Task 24 — gera tests/fixtures/bcf/exemplo.bcfzip, o arquivo que o E2E do
 * conversor carrega.
 *
 * Fica versionado (é pequeno) para o teste não depender de rodar isto antes; o
 * script existe para o arquivo ser reprodutível e legível — dá para ver aqui o
 * que tem dentro em vez de abrir um zip.
 *
 *   node tests/fixtures/bcf/gerar.mjs
 *
 * Conteúdo: BCF 2.1, três issues, duas com snapshot PNG (uma delas com
 * transparência, que precisa virar fundo branco no JPEG), uma com comentário.
 * Usa o JSZip de js/vendor — o mesmo que a página usa. O PNG é montado à mão
 * com node:zlib: são 30 linhas e poupam uma dependência nativa só para isto.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import vm from 'node:vm';

/* O package.json do repo é "type": "module", então um require() do .js trata o
   UMD como ESM e ele não acha `module`. Rodar o arquivo num contexto com um
   `module` CommonJS falso devolve o construtor do jeito que o UMD espera. */
const modulo = { exports: {} };
vm.runInNewContext(readFileSync(new URL('../../../js/vendor/jszip-3.10.1.min.js', import.meta.url), 'utf8'), {
    module: modulo, exports: modulo.exports, setTimeout, clearTimeout, setImmediate, Uint8Array, ArrayBuffer, Buffer, Promise
});
const JSZip = modulo.exports;

/* PNG RGBA de cor sólida, no tamanho de um snapshot real (1920×1080). */
const CRC = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const bloco = (tipo, dados) => {
    const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length);
    const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo));
    return Buffer.concat([tam, corpo, crc]);
};
async function png({ r, g, b }, alpha = 1, largura = 1920, altura = 1080) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4);
    ihdr[8] = 8; ihdr[9] = 6;                                   // 8 bits, RGBA
    const linha = Buffer.alloc(1 + largura * 4);                // byte de filtro 0 + pixels
    for (let x = 0; x < largura; x++) linha.set([r, g, b, Math.round(alpha * 255)], 1 + x * 4);
    const cru = Buffer.concat(Array.from({ length: altura }, () => linha));
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        bloco('IHDR', ihdr), bloco('IDAT', deflateSync(cru)), bloco('IEND', Buffer.alloc(0))
    ]);
}

const markup = ({ guid, index, titulo, status, prioridade, responsavel, descricao, comentario, snapshot }) => `<?xml version="1.0" encoding="UTF-8"?>
<Markup xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Topic Guid="${guid}" TopicType="Clash" TopicStatus="${status}">
    <Title>${titulo}</Title>
    <Priority>${prioridade}</Priority>
    <Index>${index}</Index>
    <Labels>Estrutura</Labels>
    <CreationDate>2026-09-1${index}T10:00:00-03:00</CreationDate>
    <CreationAuthor>coordenacao@exemplo.com.br</CreationAuthor>
    <AssignedTo>${responsavel}</AssignedTo>
    <Description>${descricao}</Description>
  </Topic>${comentario ? `
  <Comment Guid="${guid}-c1">
    <Date>2026-09-2${index}T15:30:00-03:00</Date>
    <Author>${responsavel}</Author>
    <Comment>${comentario}</Comment>
  </Comment>` : ''}${snapshot ? `
  <Viewpoints Guid="${guid}-v1">
    <Viewpoint>viewpoint.bcfv</Viewpoint>
    <Snapshot>snapshot.png</Snapshot>
  </Viewpoints>` : ''}
</Markup>
`;

const ISSUES = [
    {
        guid: '0f1e2d3c-0001-4000-8000-000000000001', index: 1,
        titulo: 'Viga V12 atravessa o duto de ar-condicionado',
        status: 'Aberta', prioridade: 'Alta', responsavel: 'estrutura@exemplo.com.br',
        descricao: 'Conflito de 18 cm entre a viga e o duto no 3º pavimento.',
        comentario: 'Proposta: rebaixar o duto no trecho entre os eixos B e C.',
        snapshot: await png({ r: 129, g: 22, b: 30 })
    },
    {
        guid: '0f1e2d3c-0002-4000-8000-000000000002', index: 2,
        titulo: 'Pilar P7 fora do alinhamento da arquitetura',
        status: 'Em análise', prioridade: 'Média', responsavel: 'arquitetura@exemplo.com.br',
        descricao: 'Deslocamento de 5 cm em relação ao eixo 4.',
        comentario: '',
        snapshot: await png({ r: 95, g: 98, b: 69 }, 0.4)   // transparente de propósito
    },
    {
        guid: '0f1e2d3c-0003-4000-8000-000000000003', index: 3,
        titulo: 'Shaft hidráulico sem abertura na laje',
        status: 'Resolvida', prioridade: 'Baixa', responsavel: 'hidraulica@exemplo.com.br',
        descricao: 'Abertura prevista no projeto hidráulico não aparece na forma.',
        comentario: '',
        snapshot: null
    }
];

const zip = new JSZip();
zip.file('bcf.version', '<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="2.1"><DetailedVersion>2.1</DetailedVersion></Version>\n');
zip.file('project.bcfp', '<?xml version="1.0" encoding="UTF-8"?>\n<ProjectExtension><Project ProjectId="p-1"><Name>Residencial Exemplo</Name></Project></ProjectExtension>\n');
for (const issue of ISSUES) {
    zip.file(`${issue.guid}/markup.bcf`, markup(issue));
    if (issue.snapshot) {
        zip.file(`${issue.guid}/viewpoint.bcfv`, '<?xml version="1.0" encoding="UTF-8"?>\n<VisualizationInfo />\n');
        zip.file(`${issue.guid}/snapshot.png`, issue.snapshot);
    }
}

const destino = new URL('./exemplo.bcfzip', import.meta.url);
writeFileSync(destino, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('gerado:', destino.pathname);
