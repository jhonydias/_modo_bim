# Changelog

Histórico de modificações do site **_modo_bim**.
Formato: data (mais recente no topo) → o que mudou e em quais arquivos.

---

## 2026-06-28

### Seções "nosso modo / implementações / treinamentos" com scroll horizontal — `index.html`
- As três seções agora **deslizam lateralmente** conforme o scroll vertical: rolar para baixo avança para a direita, rolar para cima volta para a esquerda. Ficam **pinadas** (sticky) enquanto o track horizontal é dirigido pelo scroll, com deslize suavizado (lerp) para uma transição gradual e bonita.
- O **selecionador** acompanha automaticamente o painel ativo e, ao clicar num item (ou em qualquer link interno para essas seções), a página rola suavemente até o painel correspondente.
- **Fallback:** em telas `< 768px` e com *prefers-reduced-motion*, as três seções voltam a empilhar verticalmente (sem pin), preservando acessibilidade. Estrutura via `display:contents` para não afetar o layout no fallback.
- Os passos 01–04 dentro de "implementações" voltaram ao **grid normal** (a versão anterior, que rolava só os 4 passos, foi descartada conforme o esclarecimento).

### Auditoria UX/UI + tasks de evolução — `tasks/03`–`tasks/07`
- **`tasks/03/analise_ux_ui.md`:** documento de análise profunda (estética × performance/lead) das imagens de branding em `contexts/` e do site atual. Inclui: leitura do Termômetro de Atributos Visuais com nota por eixo e **alinhamento geral ≈ 73%** (furos em Ousada, Criativa e Orgânica/Artesanal); recomendação de onde aplicar o **Pattern** (espinha da jornada + textura nas seções cereja + divisor que se constrói no scroll); e leitura dos mockups de marca (prova de identidade tátil/humana, fotos reais, naming "teambim_"/"Escale com bim_", cores Bege/Marrom sub-usadas).
- **Tasks detalhadas criadas a partir das melhores ideias** (padrão do projeto, porém com mais detalhe de implementação e definição de pronto):
  - `tasks/04` — Pattern da marca como espinha visual da jornada (processo, seções cereja, divisor com scroll).
  - `tasks/05` — "Termômetro de Maturidade BIM": quiz interativo client-side que qualifica e roteia o lead (cadastro vs lista-espera).
  - `tasks/06` — Prova real: fim dos placeholders de galeria/depoimento, fotos reais das fundadoras, acento Bege/Marrom.
  - `tasks/07` — Momento "Ousada": seção full-bleed cereja com manifesto gigante + Pattern antes de um CTA.

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
