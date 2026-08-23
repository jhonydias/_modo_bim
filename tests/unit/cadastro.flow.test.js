/* Task 19 §3.3 — navegação entre etapas, validação por etapa e saveStepData. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadPage } from './helpers/loadPage.js';
import {
    preencher, clicarPilulas, clicar, avancar, voltar, etapaAtiva,
    bannerVisivel, camposComErro, campo, preencherAte
} from './helpers/formulario.js';
import { ETAPAS_CADASTRO, PILULAS_CADASTRO } from './helpers/fixtures.js';

let pagina;
beforeEach(() => { pagina = loadPage('cadastro.html'); });
afterEach(() => pagina.fechar());

describe('showStage', () => {
    it('começa na capa', () => {
        expect(etapaAtiva(pagina)).toBe('stage-cover');
    });

    it('deixa uma única etapa ativa por vez', () => {
        pagina.window.showStage(2);
        const ativas = pagina.document.querySelectorAll('.stage.active');
        expect(ativas.length).toBe(1);
        expect(ativas[0].id).toBe('stage-2');
    });

    it('vai da capa até a tela de sucesso', () => {
        const esperado = ['stage-cover', 'stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-success'];
        esperado.forEach((id, i) => {
            pagina.window.showStage(i);
            expect(etapaAtiva(pagina)).toBe(id);
        });
    });

    it('#startBtn abre a etapa 1', () => {
        clicar(pagina, '#startBtn');
        expect(etapaAtiva(pagina)).toBe('stage-1');
    });
});

describe('updateProgress', () => {
    it('marca a etapa atual como active e as anteriores como completed', () => {
        pagina.window.showStage(3);
        const segs = [...pagina.document.querySelectorAll('.progress-segment')];
        expect(segs.map((s) => s.className.replace('progress-segment', '').trim()))
            .toEqual(['completed', 'completed', 'active', '']);
    });

    it('o headerMeta acompanha as 4 etapas', () => {
        expect(pagina.evalIn('totalSteps')).toBe(4);
        pagina.window.showStage(2);
        expect(pagina.document.getElementById('headerMeta').textContent).toBe('02 / 04');
        pagina.window.showStage(5);
        expect(pagina.document.getElementById('headerMeta').textContent).toBe('Concluído');
    });
});

describe('validateStep', () => {
    it('etapa vazia reprova, marca todos os obrigatórios e acende o banner', () => {
        clicar(pagina, '#startBtn');
        expect(pagina.window.validateStep(1)).toBe(false);
        expect(bannerVisivel(pagina, 1)).toBe(true);
        expect(camposComErro(pagina, 1).map((c) => c.nome).sort())
            .toEqual(['email', 'empresa', 'nomeCompleto', 'telefone']);
        expect(camposComErro(pagina, 1).every((c) => c.mensagem === 'Campo obrigatório')).toBe(true);
    });

    it('não avança de etapa enquanto reprova', () => {
        clicar(pagina, '#startBtn');
        avancar(pagina);
        expect(etapaAtiva(pagina)).toBe('stage-1');
    });

    it('e-mail e telefone inválidos têm mensagem própria', () => {
        clicar(pagina, '#startBtn');
        preencher(pagina, { ...ETAPAS_CADASTRO[1], email: 'a@b', telefone: '123' });
        expect(pagina.window.validateStep(1)).toBe(false);
        const erros = Object.fromEntries(camposComErro(pagina, 1).map((c) => [c.nome, c.mensagem]));
        expect(erros).toEqual({ email: 'E-mail inválido', telefone: 'Telefone inválido' });
    });

    it('qtdPessoas fora de 1..999 tem mensagem própria', () => {
        preencherAte(pagina, { etapas: ETAPAS_CADASTRO, pilulas: PILULAS_CADASTRO, ultima: 3 });
        preencher(pagina, { qtdPessoas: '0' });
        expect(pagina.window.validateStep(3)).toBe(false);
        expect(camposComErro(pagina, 3)[0]).toEqual({
            nome: 'qtdPessoas', mensagem: 'Informe um número de 1 a 999'
        });

        preencher(pagina, { qtdPessoas: '5' });
        expect(pagina.window.validateStep(3)).toBe(true);
    });

    it('grupo de pílulas vazio pede "Selecione uma opção"', () => {
        preencherAte(pagina, { etapas: ETAPAS_CADASTRO, ultima: 3 });
        expect(pagina.window.validateStep(3)).toBe(false);
        const erros = camposComErro(pagina, 3).map((c) => c.mensagem);
        expect(erros).toContain('Selecione uma opção');
    });

    it('marcar "Outro" sem dizer qual reprova a etapa', () => {
        preencherAte(pagina, { etapas: ETAPAS_CADASTRO, ultima: 3 });
        clicarPilulas(pagina, 'softwareInteresse', ['Outro']);
        clicarPilulas(pagina, 'nivelEquipe', ['Equipe mista']);
        expect(pagina.window.validateStep(3)).toBe(false);

        preencher(pagina, { softwareOutro: 'Solibri' });
        expect(pagina.window.validateStep(3)).toBe(true);
    });

    it('limpa os erros da rodada anterior quando tudo é preenchido', () => {
        clicar(pagina, '#startBtn');
        pagina.window.validateStep(1);
        expect(camposComErro(pagina, 1).length).toBe(4);

        preencher(pagina, ETAPAS_CADASTRO[1]);
        expect(pagina.window.validateStep(1)).toBe(true);
        expect(camposComErro(pagina, 1).length).toBe(0);
        expect(bannerVisivel(pagina, 1)).toBe(false);
    });
});

describe('saveStepData', () => {
    it('grava os campos da etapa com trim', () => {
        clicar(pagina, '#startBtn');
        preencher(pagina, { ...ETAPAS_CADASTRO[1], nomeCompleto: '  Fulana  ' });
        pagina.window.saveStepData(1);
        expect(pagina.evalIn('formData.nomeCompleto')).toBe('Fulana');
    });

    it('nunca grava o honeypot website_url', () => {
        preencherAte(pagina, { etapas: ETAPAS_CADASTRO, pilulas: PILULAS_CADASTRO, ultima: 4 });
        campo(pagina, 'website_url').value = 'http://spam.example';
        pagina.window.saveStepData(4);
        expect(pagina.evalIn('Object.keys(formData)')).not.toContain('website_url');
    });
});

describe('navegação para trás', () => {
    it('Voltar preserva o que já foi digitado', () => {
        preencherAte(pagina, { etapas: ETAPAS_CADASTRO, ultima: 2 });
        voltar(pagina);
        expect(etapaAtiva(pagina)).toBe('stage-1');
        expect(campo(pagina, 'nomeCompleto').value).toBe(ETAPAS_CADASTRO[1].nomeCompleto);
    });

    it('Voltar na etapa 1 não sai para a capa', () => {
        clicar(pagina, '#startBtn');
        voltar(pagina);
        expect(etapaAtiva(pagina)).toBe('stage-1');
    });
});

/* Regressão do commit e291735 (23/08): a logo era <a href="#"> com um handler
   que dava preventDefault e chamava showStage(0) — o link não saía da página.
   As duas asserções andam juntas: o href sozinho não basta se o handler voltar. */
describe('logo do topo', () => {
    it('aponta para a home', () => {
        const logo = pagina.document.getElementById('wordmark');
        expect(logo.getAttribute('href')).toBe('index.html');
    });

    it('não é interceptada por handler de clique', () => {
        clicar(pagina, '#startBtn');
        const evento = new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true });
        pagina.document.getElementById('wordmark').dispatchEvent(evento);
        expect(evento.defaultPrevented).toBe(false);
        expect(etapaAtiva(pagina)).toBe('stage-1'); // não voltou para a capa
    });
});
