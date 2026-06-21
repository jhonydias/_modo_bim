# Changelog

Histórico de modificações do site **_modo_bim**.
Formato: data (mais recente no topo) → o que mudou e em quais arquivos.

---

## 2026-06-21

### Correções de responsividade no mobile — `index.html`
- **Menu mobile / botão "faça um diagnóstico":** corrigido bug de especificidade CSS — `.nav-links a` (`width:100%; padding:12px 0`) sobrescrevia o `.nav-cta` e zerava o padding horizontal, cortando o texto. Agora usa `.nav-links a.nav-cta` com `width:max-content` e padding adequado.
- **Headline do hero ("Um novo modo_ de projetar"):** aumentado o gutter mínimo (`--gutter` de 22px → 26px) e reduzida a fonte do título no mobile (≤520px).
- **Hero colado na borda esquerda (mobile):** a regra `.hero-grid` usava o shorthand `padding: clamp(...) 0`, que zerava o padding horizontal e sobrescrevia o gutter lateral do `.wrap`. Trocado por `padding-top`/`padding-bottom` (só vertical), preservando o espaçamento lateral como nas demais seções.
- **Galeria "a _modo_bim acontecendo":** o posicionamento explícito do grid com alturas fixas fazia o depoimento estourar a célula e sobrepor as fotos, além de cortar imagens. Reescrito o layout mobile: grade simples de 2 colunas de fotos (proporção 3/4) + bloco de depoimento em largura total abaixo, com altura automática.

### Rodapé da landing — `index.html`
- Rodapé alterado de cereja-escuro para **Cloud Dancer `#EFEEE9`** (creme), com wordmark/links em cereja. Resolve a transição "escuro sobre escuro" entre a seção CTA e o rodapé.

### Cor de texto → paleta oficial (sem preto)
- Substituído o preto/quase-preto dos textos por **Cereja escuro `#470000`** (única cor principal escura o suficiente; preto não está na paleta). Aplicado em `index.html` (token `--ink` e derivados) e nos e-mails/planilha de `script/Code.gs` (`#3D3232` → `#470000`).
- Token `--militar` dos formulários corrigido de `#3D3232` (fora da paleta, sem uso) para o Militar real `#5F6245`.

### Paleta de cores oficial
- Vermelho atualizado para **Cereja `#81161E`** e **Cereja escuro `#470000`** (antes `#8B1D1D`/`#6F1515`) em: `index.html`, `lista-espera.html`, `cadastro.html`, `test.html`, `favicon.svg` e templates de e-mail/planilha em `script/Code.gs`.

### Tipografia
- Sistema de fontes oficial aplicado: **Sentient** (títulos) / **Inter** (texto) / **Neue Haas Grotesk** (detalhe, com fallback Helvetica/Arial) em `index.html`, `lista-espera.html` e `cadastro.html` (antes Montserrat).

### Nova landing page — `index.html`
- Construída página única (scroll) a partir do template do Canva (design `DAHNNfR9pSU`): hero, posicionamento, implementações, treinamentos, quem somos + bios, galeria, FAQ (accordion) e CTA final. Inclui nav fixa com menu mobile e animações de scroll-reveal.
- CTAs ligados: "orçamento/diagnóstico" → `cadastro.html`; "lista de espera/BIM Club" → `lista-espera.html`.
- O `index.html` anterior (formulário de cadastro/orçamento) foi preservado como **`cadastro.html`** (com OG tags e endpoint de produção intactos).
- Fotos extraídas do template do Canva e recortadas para `img/`: `hero.jpg`, `founders.jpg`, `joene.jpg`, `dayana.jpg`, `proj1–4.jpg`.

### `cadastro.html`
- Alinhado ao padrão do `lista-espera.html`: fontes Sentient/Inter/Neue Haas, logo `img/logo.png` no topo e rodapé, e remoção do fundo quadriculado (grid).

### `lista-espera.html`
- Adicionada a logo `img/logo.png` no header e rodapé; removido o fundo de linhas quadriculadas.

### Infra
- `.gitignore`: ignorada a pasta `contexts/` (PDF de branding ~135MB, acima do limite do GitHub) e `tasks/`.
