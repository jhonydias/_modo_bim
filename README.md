# _modo_bim · Guia de Deploy do Apps Script

## 📋 Passo a passo (10 minutos)

### 1. Criar a planilha
1. Acesse https://sheets.google.com e crie uma planilha em branco.
2. Renomeie para algo como **"Modo BIM — Cadastros"**.
3. **Não precisa** criar a aba `Cadastros` manualmente — o script faz isso automaticamente no primeiro envio.

### 2. Abrir o editor de Apps Script
1. Na planilha, vá em **Extensões → Apps Script**.
2. Vai abrir uma nova aba com um arquivo `Code.gs` vazio.
3. Apague todo o conteúdo padrão.
4. Cole o conteúdo completo do arquivo `Code.gs` que gerei.

### 3. Configurar (opcional, se quiser mudar)
No topo do `Code.gs`, há um objeto `CONFIG` — só ajuste se quiser:
- `ADMIN_EMAIL`: já está como `jhonymarlon@gmail.com`
- `COMPANY_NAME`, `PROTOCOL_PREFIX`, etc.

### 4. Salvar e dar nome ao projeto
1. Clique em **💾 Salvar** (ou `Ctrl+S`).
2. Quando pedir, dê o nome do projeto: **"Modo BIM Backend"**.

### 5. Testar manualmente (recomendado antes de publicar)
1. No editor, no dropdown de funções (em cima, ao lado do botão ▶ Executar), selecione **`testeManual`**.
2. Clique em **▶ Executar**.
3. Vai pedir autorização — aceite (clique em "Avançado" → "Acessar projeto sem confirmar" se aparecer aviso, é normal por ser script seu).
4. Volte à planilha — uma linha de teste deve ter aparecido na aba `Cadastros`, e seu e-mail deve receber a notificação.

> ✅ Se chegou até aqui, está tudo funcionando.

### 6. Publicar como Web App
1. No editor, clique em **Implantar → Nova implantação**.
2. Em "Selecionar tipo" (engrenagem ⚙️), escolha **App da Web**.
3. Preencha:
    - **Descrição**: `v1 — produção`
    - **Executar como**: `Eu (jhonymarlon@gmail.com)`
    - **Quem tem acesso**: `Qualquer pessoa` ⚠️ (importante para o front conseguir chamar)
4. Clique em **Implantar**.
5. **COPIE A URL** que aparece — é algo como:
   ```
   https://script.google.com/macros/s/AKfyc.../exec
   ```

### 7. Conectar o front-end
1. Abra o **`js/config.js`** — é o único lugar do site que guarda o endpoint.
2. Substitua o valor de `ENDPOINT_URL` pela URL que você copiou no passo 6.
3. Salve. As três páginas de formulário (`cadastro.html`, `contrato.html`, `lista-espera.html`)
   leem daí; nenhuma delas tem a URL escrita dentro.
4. Rode `npm run check:endpoint` para confirmar que nada ficou hardcoded.

> Este passo só é necessário **uma vez**, ou ao trocar de projeto Apps Script. Publicações normais
> do backend não mudam a URL — veja abaixo.

### 8. Subir no GitHub Pages
1. Crie um repositório público no GitHub: `modo-bim-cadastro` (ou outro nome).
2. Faça upload do `index.html` para a raiz do repo.
3. Vá em **Settings → Pages** do repositório.
4. Em **Source**, escolha **Deploy from a branch** → `main` → `/ (root)` → **Save**.
5. Aguarde 1-2 minutos. A URL será:
   ```
   https://[seu-usuario].github.io/modo-bim-cadastro/
   ```

---

## 🔧 Como atualizar depois

**Se editar o `script/Code.gs`:**

```bash
npm run deploy
```

Só isso. O script publica o `Code.gs` do repositório e reimplanta **sempre a mesma implantação**,
então **a URL não muda** e nenhum HTML precisa ser tocado. Ao final ele confere que o ID publicado
bate com o de `js/config.js` e avisa se não bater.

Pré-requisitos (uma vez por máquina):

1. `npm install`
2. Habilitar a Apps Script API em <https://script.google.com/home/usersettings>
3. `npx clasp login`

> ⚠️ **Nunca use "Implantar → Nova implantação" no editor.** O trecho `AKfyc...` da URL é o **ID da
> implantação**, não o da versão: criar uma implantação nova gera uma **URL nova** e quebra os três
> formulários até alguém editar o `js/config.js`. Foi exatamente esse o problema que a task 20
> resolveu. Se precisar publicar pelo editor, use **Gerenciar implantações → ✏️ → Nova versão**.

**Se editar o `index.html` ou outra página:**
- Apenas faça commit/push no GitHub — o Pages atualiza sozinho em ~1 min.

**Comandos disponíveis:**

| comando | o que faz |
|---|---|
| `npm run deploy` | publica `script/Code.gs` na implantação fixa (URL estável) |
| `npm run pull` | traz do Apps Script o código que está no ar, para comparar com o repo |
| `npm run check:endpoint` | falha se alguma página HTML voltar a ter a URL escrita dentro |

---

## 🛡️ Segurança implementada

- **Validação server-side** de CNPJ, CPF, e-mail e CEP (mesmo que o front seja burlado)
- **Rate limiting** por e-mail: máx. 3 cadastros a cada 5 minutos
- **Sanitização** de strings (remove HTML, limita tamanho)
- **Honeypot** no front (campo invisível que bots preenchem → descartado)

---

## 🐛 Troubleshooting

**"Erro 403 / Forbidden" ao testar do front:**
- Você publicou como "Apenas eu" em vez de "Qualquer pessoa". Refaça o passo 6.

**E-mail de notificação não chega:**
- Verifique a caixa de spam.
- O Gmail tem cota diária de 100 e-mails para contas gratuitas (suficiente para v1).

**Linha não aparece na planilha:**
- Veja os logs: no editor Apps Script → **Execuções** (ícone de relógio na barra lateral) → última execução → ver detalhes.

**CORS error no console do navegador:**
- O Apps Script aceita `text/plain` (não `application/json`). O HTML que gerei já está correto, mas se modificar, mantenha `'Content-Type': 'text/plain;charset=utf-8'`.

---

## 📊 Próximas evoluções (v2)

- Dashboard com Google Data Studio plugado na planilha
- Geração automática de PDF do contrato pré-preenchido
- Webhook para WhatsApp (via Twilio ou Z-API)
- Captcha (hCaptcha) se houver muito spam
- Domínio customizado: `cadastro.modobim.com.br`
