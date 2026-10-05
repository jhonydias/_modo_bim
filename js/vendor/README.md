# js/vendor — bibliotecas de terceiro servidas pelo próprio site

Usadas só por `bcf-para-pdf.html` (task 24), e carregadas **sob demanda**: o `<script>` é injetado
quando a pessoa escolhe o primeiro arquivo `.bcf`. Quem só visita a página não baixa nenhum byte
delas, e nenhuma origem de terceiro entra no caminho crítico (regra da task 21).

| arquivo | versão | origem | licença | sha256 |
|---|---|---|---|---|
| `jszip-3.10.1.min.js` | 3.10.1 | `cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js` | MIT ou GPLv3 | `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` |
| `jspdf-2.5.1.umd.min.js` | 2.5.1 | `cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` | MIT | `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` |

São as mesmas versões que o `bcf-para-pdf.html` original puxava do CDN. A versão está no nome do
arquivo de propósito: o GitHub Pages serve tudo com `max-age=600`, e trocar a biblioteca sem trocar
o nome deixaria navegadores com a antiga em cache por até 10 minutos, misturada com o HTML novo.

Para atualizar: baixe a versão nova com o nome novo, confira o hash, troque o caminho em
`bcf-para-pdf.html` (constante `VENDOR`) e apague o arquivo antigo.
