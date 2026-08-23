import { defineConfig } from 'vitest/config';

/* Os testes unitários montam o próprio jsdom por página (tests/unit/helpers/loadPage.js),
   porque cada caso precisa decidir o que existe em window ANTES de o script inline rodar.
   Por isso o ambiente do vitest é 'node', e não 'jsdom'. */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/unit/**/*.test.js'],
        globals: false,
        restoreMocks: true
    }
});
