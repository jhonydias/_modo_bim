/* Task 19 — payloads e valores reutilizáveis.
 *
 * Os payloads espelham exatamente o que cada formulário monta no submit
 * (…formData + tipo + timestamp + userAgent). Se um campo obrigatório sumir
 * daqui, é o teste de paridade (paridade.test.js) que acusa, não este arquivo.
 */

/* CNPJ e CPF com dígitos verificadores válidos. Os testes de validarCNPJ_ /
   validarCPF_ conferem que continuam válidos, então um erro de digitação aqui
   aparece como falha, não como falso verde. */
export const CNPJ_VALIDO = '11.222.333/0001-81';
export const CNPJ_INVALIDO = '11.222.333/0001-82';
export const CPF_VALIDO = '529.982.247-25';
export const CPF_INVALIDO = '529.982.247-26';

export const EMAILS_VALIDOS = ['a@b.co', 'contato@modobim.com.br', 'nome.sobrenome+tag@dominio.com'];
export const EMAILS_INVALIDOS = ['a@b', 'a b@c.com', '@b.com', 'a@.com', '', 'sem-arroba.com'];

export const TELEFONES_VALIDOS = ['(91) 98888-7777', '(91) 3222-1111', '91988887777'];
export const TELEFONES_INVALIDOS = ['(91) 9888-777', '919888877771', '', 'abcdefghij'];

export function payloadOrcamento(extra = {}) {
    return {
        nomeCompleto: 'Fulana de Teste',
        empresa: 'Escritório Teste',
        email: 'fulana@teste.com.br',
        telefone: '(91) 98888-7777',
        produtosServicos: 'Projetos residenciais e comerciais',
        gargalo: 'Retrabalho entre disciplinas',
        objetivoBIM: 'Compatibilizar antes da obra',
        qtdPessoas: '8',
        softwareInteresse: 'Revit, Archicad',
        nivelEquipe: 'Equipe mista',
        observacoes: '',
        tipo: 'orcamento',
        timestamp: new Date('2026-08-23T12:00:00Z').toISOString(),
        userAgent: 'vitest',
        ...extra
    };
}

export function payloadListaEspera(extra = {}) {
    return {
        nomeCompleto: 'Ciclana de Teste',
        empresa: 'Autônoma',
        email: 'ciclana@teste.com.br',
        telefone: '(91) 3222-1111',
        cidade: 'Belém',
        estado: 'PA',
        cargo: 'Arquiteta',
        softwareAtual: 'AutoCAD',
        nivelBIM: 'Iniciante',
        softwareInteresse: 'Revit',
        objetivo: 'Sair do CAD',
        bimclub: 'Sim',
        comoConheceu: 'Instagram',
        tipo: 'lista-espera',
        timestamp: new Date('2026-08-23T12:00:00Z').toISOString(),
        userAgent: 'vitest',
        ...extra
    };
}

export function payloadCadastro(extra = {}) {
    return {
        razaoSocial: 'Empresa Teste LTDA',
        nomeFantasia: 'Teste',
        cnpj: CNPJ_VALIDO,
        inscricaoEstadual: 'ISENTO',
        ramoAtividade: 'Arquitetura',
        cpfRepresentante: CPF_VALIDO,
        cargo: 'Sócia',
        email: 'financeiro@teste.com.br',
        telefone: '(91) 98888-7777',
        site: 'https://teste.com.br',
        cep: '66000-000',
        logradouro: 'Av. Teste',
        numero: '100',
        complemento: '',
        bairro: 'Centro',
        cidade: 'Belém',
        estado: 'PA',
        tipo: 'cadastro',
        timestamp: new Date('2026-08-23T12:00:00Z').toISOString(),
        userAgent: 'vitest',
        ...extra
    };
}

export const PAYLOAD_POR_TIPO = {
    orcamento: payloadOrcamento,
    'lista-espera': payloadListaEspera,
    cadastro: payloadCadastro
};

/* Valores que preenchem cada etapa do formulário no DOM (jsdom e Playwright
   usam a mesma fonte, para não divergirem). */
export const ETAPAS_CADASTRO = {
    1: {
        nomeCompleto: 'Fulana de Teste',
        empresa: 'Escritório Teste',
        email: 'fulana@teste.com.br',
        telefone: '(91) 98888-7777'
    },
    2: {
        produtosServicos: 'Projetos residenciais e comerciais',
        gargalo: 'Retrabalho entre disciplinas',
        objetivoBIM: 'Compatibilizar antes da obra'
    },
    3: { qtdPessoas: '8' },
    4: { observacoes: 'Sem restrição de agenda.' }
};

export const PILULAS_CADASTRO = {
    3: { softwareInteresse: ['Revit', 'Archicad'], nivelEquipe: ['Equipe mista'] }
};

export const ETAPAS_LISTA_ESPERA = {
    1: {
        nomeCompleto: 'Ciclana de Teste',
        email: 'ciclana@teste.com.br',
        telefone: '(91) 3222-1111',
        cidade: 'Belém',
        estado: 'PA'
    },
    2: {
        empresa: 'Autônoma',
        cargo: 'Arquiteta',
        softwareAtual: 'AutoCAD',
        nivelBIM: 'Iniciante'
    },
    3: { objetivo: 'Sair do CAD', comoConheceu: 'Instagram' }
};

export const PILULAS_LISTA_ESPERA = {
    3: { softwareInteresse: ['Revit'], bimclub: ['Sim'] }
};
