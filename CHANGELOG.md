# Changelog

Histórico de modificações do site **_modo_bim**.
Formato: data (mais recente no topo) → o que mudou e em quais arquivos.

---

## 2026-07-26

### Regra de cor da proposta comercial (task 08 · Canva ref. 1) — `index.html`
- **Fundo claro → texto em verde, destaques em vermelho.** Os tokens `--ink`, `--ink-soft`, `--ink-muted` e `--line` deixaram de ser cereja escuro (`#470000`) e passaram a derivar do **verde militar** (`#4C4F37`). Corpo de texto, leads e divisores agora são verdes.
- **Títulos e ênfases em cereja:** `h1/h2/h3` ganharam `color: var(--cereja)` por padrão; `strong` dentro dos parágrafos (statement e treinamentos), `legend` do quiz e o `h3` do resultado também. O resultado é a combinação "verde com vermelho" da proposta.
- **Fundo cereja → texto branco:** overrides explícitos para `.about`, `.cta-final` e `.gallery-quote`, que continuam em Cloud Dancer. Contraste conferido (texto verde sobre creme ≈ 7,3:1).

### Novo tópico "nossos serviços" (task 08 · Canva ref. 2, pág. 5) — `index.html`
- Novo painel `#nossos-servicos` **entre "nosso modo" e "implementações"**, dentro do bloco de scroll horizontal. Título e copy vindos direto do Canva: *"Para cada momento, tem um modo_"*.
- **Seis serviços** em duas colunas (01 Consultoria BIM · 02 Projetos em BIM · 03 Criação de Templates · 04 Criação de Bibliotecas · 05 Coordenação BIM · 06 Treinamento BIM), cada um com número, nome em cereja e descrição em verde; borda superior que acende no hover.
- Link adicionado ao **selecionador de seção**, ao **menu hambúrguer** e ao **rodapé**. O scrollspy e o cálculo do track horizontal derivam do DOM, então passaram a lidar com 4 painéis sem alteração de lógica. Em telas `< 900px` a lista vira coluna única; no painel horizontal os espaçamentos são compactados para os 6 itens + CTA caberem na altura.

### Movimento e cor no estilo Responsive Cities (task 08) — `index.html`
- **Texto que se monta palavra a palavra** na primeira vez que entra em cena (`.rt`): o JS quebra o conteúdo em `<span class="rt-w"><i>palavra</i></span>` preservando `<em>`, `<span>` e `<br>`, e cada palavra sobe de dentro da linha com atraso escalonado (44 ms). Aplicado no H1 do hero, no statement, em nossos serviços, implementações, treinamentos, galeria e CTA final.
- **A galeria da marca virou uma faixa de prova com duas colunas em movimento** (`.proof-band` + `.vmarquee`), como as imagens ao lado de "Cidades são sistemas de agentes" na referência: o antigo mosaico `.gallery-grid` deu lugar a duas colunas verticais full-bleed — uma desce, a outra sobe — com as 6 peças da marca (crachá, copos, sacola · mousepad, notebook, bottons) em loop de 46 s, duplicadas para o loop não ter emenda. As colunas pausam no hover.
- **A prova social ficou no meio das imagens**, e o card marrom saiu: era a única peça em Marrom da página e destoava. Agora é um bloco **cereja com texto branco** (a regra de cor da marca) entre as duas colunas — a única mancha de cor no meio das peças em preto e branco. No mobile a ordem se mantém: coluna de peças · prova · coluna de peças.
- **Imagens em preto e branco que ganham cor** — igual à referência, a cor é resposta ao visitante, não algo que acontece sozinho: as peças ficam permanentemente em `grayscale(1)` e coloreiam **no hover** (0,7 s + leve zoom). A imagem do hero mantém a passagem P&B → cor na entrada em cena (`.bw`), agora lenta (2,2 s) para ser vista acontecendo.
- **Brilho que percorre o Pattern:** onda de luz atravessando o `.modo-tex` a cada 6 s (máscara em gradiente). Opacidade do Pattern subiu de 0,1 para 0,2 para o brilho ser perceptível.
- **Assinatura de fechamento com onda letra a letra** (`.rt.rl`): a CTA final ganhou o wordmark `_modo_bim` em escala grande (até 168 px, creme sobre cereja) em que cada letra sobe em sequência a cada 26 ms — a mecânica do "data matters, meaning too" da referência, que lá é letra a letra. O `splitReveal()` passou a quebrar por palavra (`.rt`) ou por letra (`.rl`). O bloco é `aria-hidden`, já que o wordmark de verdade está no rodapé logo abaixo.
- **Painéis horizontais:** como o track é transladado, o `IntersectionObserver` não os alcança — o conteúdo de cada painel passa a ser revelado quando ele entra em cena (`revealPanel`). Tudo respeita `prefers-reduced-motion` (sem split, sem grayscale, sem shimmer).

### Envio automático dos formulários para o Notion (task 08) — `script/Code.gs`, `tasks/08/notion-integracao.md`
- **Dual-write:** a planilha continua sendo gravada (é dela que sai o protocolo e ela vira o backup) e, no mesmo request, o registro é espelhado como página em um database do Notion via API (`UrlFetchApp` + `Notion-Version: 2022-06-28`).
- **Segredos fora do código:** `NOTION_TOKEN`, `NOTION_DB_CADASTROS` e `NOTION_DB_LISTA_ESPERA` ficam nas Propriedades do script.
- **Nada se perde:** falha na API não derruba o envio — o lead vai para a aba **"Fila Notion"** e é reprocessado por `retryNotionQueue()` num gatilho de 15 em 15 minutos (até 5 tentativas). `criarGatilhoNotion()` instala o gatilho; `testeNotion()` valida a configuração.
- Mapeamento de campos → propriedades do Notion em `buildNotionProps_()`, com construtores tipados (title, rich_text, select, email, phone, url, date). Passo a passo de setup, tabela de colunas e erros comuns em `tasks/08/notion-integracao.md`.

---

## 2026-06-28

### Pattern da marca como espinha visual da jornada (task 04) — `index.html`
- **Pattern oficial recriado como ativo vetorial leve** (SVG inline, sem `.png` pesado nem libs): um `<symbol id="modoPattern">` com blocos de linhas horizontais que **sobem em degraus diagonais** — esparsas embaixo/à esquerda (bagunça), densas e alinhadas em cima/à direita (autonomia). A cor vem de `currentColor`, então o mesmo vetor serve em **creme sobre cereja** e **oliva sobre creme** (2+ variantes).
- **Uso primário (textura de fundo, ~10%):** `.about` (#equipe) e `.cta-final` agora têm o Pattern em creme, bem sutil, **atrás do conteúdo** (`z-index`, `.wrap` acima) e sangrando para fora das bordas — faixa lateral à direita no #equipe; cantos opostos (topo-esq. espelhado + base-dir.) na CTA final. Não passa atrás do wordmark e não prejudica a leitura de nenhum texto.
- **Uso secundário (passos 01–04):** as antigas `.step-bars` (barrinhas verticais improvisadas) foram **substituídas pela linguagem do Pattern**: cada passo mostra um swatch que cresce em altura/densidade do 01 ao 04 (01 = dois traços soltos; 04 = degrau completo e denso), reforçando "da bagunça à autonomia". Números (01–04) e nomes preservados; cabe no `.hpanel` horizontal sem cortar.
- **Restrições respeitadas:** nenhum novo efeito de scroll (a ideia do "divisor que se constrói no scroll" foi descartada para não concorrer com o scroll horizontal); só cores da paleta (creme/oliva), sem preto; vetor leve, sem requisições extras. **Mobile (`< 520px`):** densidade simplificada (oculta a banda mais esparsa e os traços `.den`, reduz o tamanho da textura). Sem overflow horizontal em nenhuma largura.

### Seções "nosso modo / implementações / treinamentos" com scroll horizontal — `index.html`
- As três seções agora **deslizam lateralmente** conforme o scroll vertical: rolar para baixo avança para a direita, rolar para cima volta para a esquerda. Ficam **pinadas** (sticky) enquanto o track horizontal é dirigido pelo scroll, com deslize suavizado (lerp) para uma transição gradual e bonita.
- O **selecionador** acompanha automaticamente o painel ativo e, ao clicar num item (ou em qualquer link interno para essas seções), a página rola suavemente até o painel correspondente.
- **Fallback:** em telas `< 768px` e com *prefers-reduced-motion*, as três seções voltam a empilhar verticalmente (sem pin), preservando acessibilidade. Estrutura via `display:contents` para não afetar o layout no fallback.
- Os passos 01–04 dentro de "implementações" voltaram ao **grid normal** (a versão anterior, que rolava só os 4 passos, foi descartada conforme o esclarecimento).

### Auditoria UX/UI v2 (revisada pós scroll horizontal) — `tasks/03`–`tasks/07`
- **`tasks/03/analise_ux_ui.md` atualizado para v2:** reanálise após a entrada do scroll horizontal pinado. O **alinhamento ao Termômetro subiu de ~73% para ≈ 78%** (o scroll horizontal cobriu boa parte dos furos Ousada/Criativa); furos restantes concentrados em **Humana** e **Artesanal/Orgânica** (placeholders de prova + ausência do Pattern/textura). Inclui §1 sobre o impacto (e o risco de scroll-jacking) da nova interação e §6 com o veredito por task.
- **Tasks ajustadas ao estado atual do site:**
  - `tasks/04` (Pattern) — **mantida, revisada:** cortado o "divisor que se constrói no scroll" (concorreria com o scroll horizontal); foco em textura nas seções cereja + linguagem dos passos 01–04, adaptada ao painel horizontal de altura limitada.
  - `tasks/05` (Termômetro de Maturidade — quiz) — **mantida, recolocada:** sai de dentro de `#nosso-modo`/painéis horizontais (scroll sequestrado) para fora do bloco `.hsections`.
  - `tasks/06` (Prova real) — **mantida, prioridade nº1:** ficou mais urgente (forma sofisticada × prova vazia).
  - `tasks/07` — **repaginada:** o "momento Ousada" full-bleed virou redundante (o scroll horizontal já é o pico ousado); novo foco em **converter** o scroll horizontal (affordance anti scroll-jacking + CTA de fechamento) e no calor **Bege/Marrom**.

### Selecionador de seção aparece só ao rolar — `index.html`
- O selecionador (nosso modo / implementações / treinamentos) **não aparece mais ao abrir o site**: agora surge gradualmente (fade + slide) depois de rolar para baixo (~60% da viewport) e some ao voltar ao topo.
- A barra do selecionador virou um elemento **flutuante** abaixo do header (`position:absolute`, fora do fluxo), evitando qualquer pulo de layout ao aparecer/desaparecer. Token `--bar-h` (60px, só a barra do topo) separado de `--nav-h` (header completo); o hero passa a usar `--bar-h`.

### Correções no selecionador de seção — `index.html`
- **Mobile:** o texto "treinamentos" ficava cortado porque os três itens (384px) não cabiam na largura disponível (323px). Reduzida a fonte (`clamp(13px, 3.6vw, 16px)`) e o gap no mobile para caberem todos; o item ativo também é mantido visível via `scrollLeft` quando há rolagem horizontal.
- **Selecionador "preso" em treinamentos:** ao rolar para além da última seção mapeada (quem somos, galeria, FAQ, CTA), o selecionador continuava marcando "treinamentos" para sempre. Agora, ao passar do fim da seção treinamentos, nenhum item fica selecionado e o indicador some (fade-out); volta a marcar ao retornar a uma das seções.

### Seção "quem somos" interativa — `index.html`
- A antiga seção **about + bios** (foto das fundadoras + dois cards fixos) virou uma **apresentação interativa de painel único** (`#equipe`).
- **Visualização default:** foto das fundadoras, "Profundidade acadêmica + vivência real de mercado" e os nomes **Joene Louchard** / **Dayana Ramos** como itens clicáveis.
- **Selecionador no hover:** ao passar o mouse sobre os nomes aparece a mesma marca do selecionador da task 01 (`‾‾ _ ‾‾`, em cloud para contraste no fundo cereja), sinalizando que são clicáveis.
- **Clique:** substitui foto + título + função + bio pela apresentação da pessoa; o slot da pessoa ativa passa a exibir **_modo_bim** para voltar ao default. Transição com fade.
- **Rolagem não troca de sessão** (ao contrário da task 01): as sub-visualizações só aparecem por clique; ao rolar para fora da seção, ela volta sozinha ao default.

### Navegação por seção + menu hambúrguer universal — `index.html`
- **Hambúrguer sempre visível** no canto superior direito, em qualquer viewport (desktop/tablet/mobile). Os links de navegação (implementações, treinamentos, quem somos, dúvidas, faça um diagnóstico) ficam escondidos atrás dele e aparecem como um *dropdown card* ao clicar. Fecha ao clicar fora, ao escolher um link ou com `Esc`.
- **Selecionador de seção personalizado:** nova barra abaixo do header com "nosso modo / implementações / treinamentos" e uma marca olive deslizante no estilo da marca (`‾‾ _ ‾‾`) que indica a seção visível.
- **Scrollspy:** ao rolar a página, a seção ativa é detectada (linha de referência a 35% da viewport) e o selecionador se move automaticamente. Clicar em um item rola suavemente até a seção correspondente.
- Adicionado `id="nosso-modo"` à seção de posicionamento; tokens `--nav-h` (altura do header) e `scroll-padding-top` para os âncoras pararem abaixo do header fixo. Hero e coluna sticky de treinamentos passam a usar `--nav-h`.

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
