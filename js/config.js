/* ============================================================
 *  _modo_bim — configuração do front
 * ============================================================
 *  Fonte única do endpoint do backend (Apps Script).
 *  Carregado por cadastro.html, contrato.html e lista-espera.html
 *  antes do <script> inline de cada página.
 *
 *  ⚠️ ENDPOINT_URL não muda em deploy normal do backend.
 *     `npm run deploy` republica sempre a MESMA implantação, então
 *     a URL é estável. Só troque esta linha ao mudar de PROJETO
 *     Apps Script (conta nova, script recriado). Ver tasks/20.
 *
 *  DEV_MODE: quando true, os formulários não enviam nada — logam o
 *  payload no console e mostram um protocolo fictício (…-DEV).
 *  Serve para mexer no layout sem sujar a planilha. Deixe SEMPRE
 *  false no que vai para o ar.
 * ============================================================ */
window.MODOBIM_CONFIG = {
    ENDPOINT_URL: 'https://script.google.com/macros/s/AKfycbyRHztm-hPx5A_k4-BCxOQje0Stq-ifz_VGU4u3Z7fbOy2_rAmfWB8vQ0lfvIdbZso/exec',
    DEV_MODE: false
};
