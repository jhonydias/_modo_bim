# Changelog

Histórico de modificações do site **_modo_bim**.
Formato: data (mais recente no topo) → o que mudou e em quais arquivos.

---

## 2026-08-02

### Prova social com depoimentos reais (task 11) — `index.html`
- Entraram os **três depoimentos coletados** no lugar do bloco provisório da task 06, que dizia que os relatos ainda estavam sendo colhidos. A regra de "não inventar depoimento" cumpriu o papel até aqui e sai junto com o bloco.
- **O vermelho deixou de ser o fundo e virou o balão.** O `.gallery-quote` passou a claro, e o depoimento fica num balão cereja com rabicho — quem fala ali é o cliente, não a página. Aspas duplas grandes em creme translúcido no canto superior deixam isso explícito de saída.
- **Troca suave entre os três**, com giro automático a cada 7 s. Para enquanto a pessoa está lendo (`mouseenter`/`focusin`) e enquanto o bloco não está em cena; com `prefers-reduced-motion` não gira, e os pontinhos fazem a troca manual. `aria-pressed` acompanha o ponto ativo; os depoimentos ocultos ficam `visibility: hidden`, fora da árvore de acessibilidade.
- **A altura não oscila na troca.** Os três ficam empilhados na mesma célula de grid, então o bloco reserva a altura do maior; cada balão usa `align-self: center` e fica do tamanho do próprio texto — esticado, o depoimento curto viraria um retângulo vermelho quase vazio. Medido: 545 px nos três estados.
- `.gallery-quote` saiu do seletor que força `color: var(--cloud)` em títulos sobre fundo cereja — o bloco não é mais escuro.

### Faixa "A _modo_bim no mundo real" com material real — `index.html`, `img/real/`
- As seis fotos de peças da marca eram provisórias e saíram. Entraram **4 fotos e 6 vídeos** de treinamentos e equipes trabalhando, cinco por coluna, alternando foto e clipe. O título da seção passou de "Uma marca que você pega na mão" para **"A _modo_bim acontecendo"**, que é o que o material novo mostra.
- **Os tiles viraram retrato** (`aspect-ratio: 3 / 4`), porque as fotos e cinco dos seis clipes foram feitos em pé; `.mq-wide` (`16 / 9`) é a exceção deitada. A largura ganhou teto de 340 px: na largura cheia da coluna, um tile retrato fica mais alto que a faixa inteira e só caberia um de cada vez. A faixa subiu para `clamp(460px, 70vh, 740px)` no desktop e `clamp(380px, 56vh, 520px)` no mobile.
- **Vídeos mudos, em loop, com `preload="none"` e pôster.** Nada é baixado até o clipe entrar em cena, e um `IntersectionObserver` toca só os visíveis, pausando o resto — sem isso seriam doze elementos decodificando ao mesmo tempo. Medido no navegador: 2 tocando, 10 pausados. Com `prefers-reduced-motion` nenhum toca e fica o pôster, coerente com a faixa, que também para de rolar nesse modo. Os clipes mantêm o preto e branco que ganha cor no hover, igual às fotos.
- **Transcodificação: 209 MB → 7,2 MB**, pôsteres incluídos. Vídeos em H.264 progressivo (640 px de largura nos verticais, 854 nos deitados, CRF 33, 30 fps, sem trilha de áudio, `faststart`) e fotos em 1080 px mozjpeg. Os originais seguem em `img/modobimreal/`, fora do site.
- `05.mp4` ficou de fora: 42 minutos e 162 MB em 640×368 — gravação integral de uma aula, não peça de vitrine.
- As seis `img/brand-*.jpg` deixaram de ser referenciadas por qualquer página.

### Databases do Notion criados e integração validada (task 08) — `tasks/08/notion-integracao.md`
- Os dois databases do passo 2 do doc foram **criados via API** dentro das páginas "Cadastro de Clientes" e "Lista de Espera", com os nomes e tipos de coluna exatamente como `buildNotionProps_()` espera (`script/Code.gs:358`) — `Cadastros` (18 propriedades) e `Lista de Espera` (17). `Status` (Novo · Contato feito · Proposta · Fechado · Perdido), `Estado` (27 UFs) e `Ramo de Atividade` já vêm com as opções carregadas; os demais *selects* se preenchem sozinhos conforme os leads chegam.
- **Integração testada de ponta a ponta** com um token temporário: uma página `[TESTE]` gravada em cada base com o mesmo payload do Apps Script e lida de volta pela API. Confirmou o que a tabela de "erros comuns" prevê: nomes acentuados batendo (`Razão Social`, `Inscrição Estadual`, `Endereço`, `Nível BIM`), tipos `email`/`phone_number`/`url`/`date` aceitos, e a troca de vírgula por barra do `nSelect_()` funcionando (`Revit, Navisworks` → `Revit / Navisworks`) — vírgula quebraria a opção do select em duas.
- IDs dos databases registrados no passo 4 do doc, prontos para `NOTION_DB_CADASTROS` e `NOTION_DB_LISTA_ESPERA`. Nenhum token foi versionado.
- **Novo `script/notion-bootstrap.mjs`** — o setup que era manual (passos 2, 4 e 6 do doc) virou script: `check` valida token e acesso, `create` cria os databases, `seed` grava as páginas `[TESTE]`, `cleanup` as arquiva. Todos aceitam um alvo opcional (`cadastros` / `listaEspera`) para mexer em uma base só — sem isso, recriar uma das duas duplicaria a outra. Node 18+, sem dependências, token lido de `NOTION_TOKEN` no ambiente. Existe para o caso de os databases precisarem ser **recriados** (outro workspace, schema alterado) — recriar 35 colunas na mão, com acento, é justamente onde nasce o `400 ... is not a property that exists` da tabela de erros. Os schemas ficam lado a lado com os de `buildNotionProps_()`, então divergência entre os dois é visível numa leitura.

### Seção "quem somos" refeita a partir do Canva (task 09 · proposta comercial, pág. 3) — `index.html`
- **Split de duas cores no lugar do bloco cereja cheio.** A seção deixou de ter fundo único e virou uma grade `1fr 1fr` sangrada: painel **cereja à esquerda** com a foto ocupando a metade inteira (sem `.wrap`, sem `border-radius`) e painel **Cloud Dancer à direita** com o texto. A regra de cor da task 08 passou a valer por painel — por isso `.about` saiu do override `color: var(--cloud)` de `h1/h2/h3` e o texto do painel claro é militar com destaques em cereja. O `padding-right` do painel claro usa `max(--gutter, calc(50vw - --maxw/2 + --gutter))` para a borda direita do texto alinhar com o conteúdo do resto da página.
- **Título e copy vindos da referência:** `_quem somos` + **"Por trás da _modo_bim"** (wordmark em cereja). O parágrafo único deu lugar aos **três movimentos do argumento** do Canva — origem em Belém, o que cada sócia traz, e a convicção "BIM não é uma ferramenta a ser aprendida, é um modo de operar" — com negrito seletivo nas frases-chave (por isso `teamBody` passou de `textContent` para `innerHTML`). A síntese "profundidade acadêmica + vivência real de mercado" saiu do título e virou o fecho do 2º parágrafo, que é onde ela conclui o argumento.
- **Os nomes sobre a foto viraram o seletor.** O `.team-picker` abaixo do texto foi removido: `_joene louchard` (topo à direita) e `_dayana ramos` (base à esquerda) são agora legenda **e** botão, com o traço `_` da task 01 acendendo no nome ativo. Isso corrigiu de quebra um problema do comportamento anterior — o rótulo do botão virava `_modo_bim` quando ativo, ou seja, o texto mudava embaixo do dedo do usuário; agora o rótulo é fixo e quem sinaliza o estado é o traço. Os nomes são botões de alternância com `aria-pressed` — não `role="tab"`: sem `aria-controls`, `role="tabpanel"` e navegação por setas, o papel de aba anuncia ao leitor de tela um comportamento que não existe.
- **Faixa de prova** no rodapé do painel claro: **100%** personalizado · **3** pilares (tecnologia, pessoas e processos) · **BR** atendimento nacional. Aparece **só no estado default**: os números são da consultoria, não das pessoas, e não cabem sobre a bio de uma delas. Como a faixa vive fora do `.team-info`, some junto no fade da troca e é forçada visível durante a medição de altura — senão a trava reservaria a altura errada. Os números fazem count-up uma única vez ao entrar em cena, respeitando `prefers-reduced-motion`. O valor real fica visível até a animação começar — zerar de saída fazia quem não rolasse até lá ver `0` no lugar de `3`.
- **Caminho de volta explícito.** Com os nomes virando seletor, abrir uma bio deixava o visitante sem saída visível — clicar de novo no nome ativo funcionava, mas ninguém adivinha. Novo link `← Voltar para a _modo_bim` (estilo `.tlink`) aparece dentro do `.team-info` só nos estados de bio, então entra no fade da troca e não desestabiliza a trava de altura.
- **A seção não pula mais ao abrir uma bio.** O manifesto é ~250 px mais alto que as bios, então trocar de estado encolhia a seção e puxava a página para cima. Um clone invisível do estado default (`.team-ghost`) entra em fluxo por um instante, com o bloco real escondido, e a seção inteira é medida nesse estado — a reserva vai para `min-height` na `.team`. Medir a seção toda, e não deduzir a altura de uma coluna só, é o que faz a conta valer nos dois layouts: contas parciais quebravam ora no desktop (o `min-height: min(86vh, 720px)` do CSS limitava a medida) ora no mobile (empilhado, a seção também carrega a altura da foto). A imagem também é posicionada de forma absoluta dentro de `.team-photo` — no fluxo, a proporção da foto em cena (verticais nas bios, horizontal nas duas) passava a mandar na altura da seção.
- **A foto virou um cartão quadrado contido**, com margem cereja dos quatro lados, em vez de ocupar a altura toda do painel. Isso resolve dois problemas de uma vez: tira a imagem de encostada na borda da tela e corta o fundo de estúdio vazio acima da cabeça nas fotos verticais. A causa era geométrica — numa caixa mais estreita, em proporção, que a foto, o `object-fit: cover` corta só na horizontal e a vertical inteira aparece; com a caixa mais larga o corte passa a ser vertical e o `object-position` (por foto, no objeto `TEAM`) escolhe o trecho que interessa.
- **Cantos boleados e bordas esfumadas:** o cartão da foto (10–20 px) e o próprio bloco cereja (14–28 px) ganharam `border-radius`, e as quatro bordas da foto se esfumam no fundo por `mask-image` cruzada nos dois eixos com `mask-composite`. O esfumado é curto de propósito (últimos 7%): mais que isso come a imagem em vez de suavizar o encontro. A máscara vai na imagem e no véu, nunca em `.team-photo`, senão levaria junto os nomes. Com as bordas esfumadas o véu inferior perdeu a função e saiu; ficou só o do topo, para `_joene louchard`.
- **O painel da foto passou a Cereja escuro `#470000`.** Medidas as bordas das três fotos, elas ficam entre `#41` e `#64` por causa da vinheta do estúdio; contra o `#81161E` do cereja principal isso é um degrau visível, e o esfumado só o transformava num halo. O `#470000` encosta nesses valores e o encontro entre foto e fundo praticamente some.
- O **Pattern** migrou para o painel claro (em cereja a 7% de opacidade, canto inferior direito), já que o painel esquerdo agora é foto sangrada e a textura ficaria escondida.
- Mobile (`< 900px`): o split vira vertical — foto em cereja no topo ocupando a largura toda (o recuo lateral só faz sentido quando ela divide a tela com o texto), texto claro abaixo, stats em coluna única com divisórias. Conferido sem overflow horizontal em 390 px, 918 px, 1002 px, 1178 px e 1418 px.

### Fotos das fundadoras — `img/`
- Três fotos novas de estúdio (fundo cereja) substituíram as anteriores. Chegaram em resolução de câmera, somando **62 MB**, o que travava a renderização da seção. Reduzidas para `founders.jpg` 2400 px de largura e `dayana.jpg`/`joene.jpg` 1500 px, em JPEG mozjpeg progressivo q78–80: **62 MB → 445 KB** no total, na mesma ordem de grandeza do `hero.jpg` (106 KB).
- `img/dayana.jpg` e `img/joene.jpg` passaram a ser as fotos que chegaram como `day.jpg` e `joe.jpg`, sem recorte: só redimensionamento e recompressão, preservando o enquadramento original.
- A `<img>` da seção ganhou `loading="lazy"` e `decoding="async"`, e as duas fotos das bios são pré-carregadas em `requestIdleCallback` — sem isso o primeiro clique num nome trocava o `src` e a foto só chegava depois do fade, piscando vazio.

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
