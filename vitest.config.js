import { defineConfig } from 'vitest/config';

/* Os testes unitários montam o próprio jsdom por página (tests/unit/helpers/loadPage.js),
   porque cada caso precisa decidir o que existe em window ANTES de o script inline rodar.
   Por isso o ambiente do vitest é 'node', e não 'jsdom'. */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/unit/**/*.test.js'],
        globals: false,
        restoreMocks: true,
        /* O default do vitest é 5s, e não cabe aqui: os testes de paridade
           carregam cadastro.html (53KB) inteiro no jsdom e avaliam o script
           inline dentro do próprio caso de teste. Com os arquivos rodando em
           paralelo, o primeiro deles passava dos 5s por contenção — falhava
           sozinho, na suíte cheia, e passava quando rodado isolado. O trabalho
           é real, não é travamento; o teto é que estava baixo. (task 22) */
        testTimeout: 20000
    }
});
