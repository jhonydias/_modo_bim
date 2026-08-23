/* Utilidades de DOM compartilhadas pelos testes dos três formulários.
 *
 * Os formulários são idênticos em estrutura (etapas, pílulas, honeypot, submit),
 * então tudo o que é navegação vive aqui e cada teste cuida só do que é seu.
 */

export function campo(pagina, nome) {
    return pagina.document.querySelector(`[name="${nome}"]`);
}

/** Preenche inputs/selects/textarea por name, disparando input+change. */
export function preencher(pagina, valores) {
    for (const [nome, valor] of Object.entries(valores)) {
        const el = campo(pagina, nome);
        if (!el) throw new Error(`campo [name="${nome}"] não existe na página`);
        el.value = valor;
        el.dispatchEvent(new pagina.window.Event('input', { bubbles: true }));
        el.dispatchEvent(new pagina.window.Event('change', { bubbles: true }));
    }
}

/** Digita dígito a dígito, como uma pessoa — é assim que a máscara é exercitada. */
export function digitar(pagina, nome, texto) {
    const el = campo(pagina, nome);
    if (!el) throw new Error(`campo [name="${nome}"] não existe na página`);
    el.value = '';
    for (const ch of texto) {
        el.value += ch;
        el.dispatchEvent(new pagina.window.Event('input', { bubbles: true }));
    }
    return el.value;
}

/** Clica pílulas de um grupo pelo rótulo do data-value. */
export function clicarPilulas(pagina, grupo, valores) {
    const g = pagina.document.querySelector(`[data-pill-group="${grupo}"]`);
    if (!g) throw new Error(`grupo de pílulas "${grupo}" não existe`);
    for (const valor of valores) {
        const pill = [...g.querySelectorAll('.pill')].find((p) => p.dataset.value === valor);
        if (!pill) throw new Error(`pílula "${valor}" não existe em "${grupo}"`);
        pill.dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true }));
    }
    return campo(pagina, grupo)?.value ?? '';
}

export function etapaAtiva(pagina) {
    return pagina.document.querySelector('.stage.active')?.id ?? null;
}

export function clicar(pagina, seletor) {
    const el = pagina.document.querySelector(seletor);
    if (!el) throw new Error(`elemento "${seletor}" não existe`);
    el.dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    return el;
}

/** Botão "Avançar" da etapa visível (cada etapa tem o seu). */
export function avancar(pagina) {
    const ativa = pagina.document.querySelector('.stage.active');
    const btn = ativa.querySelector('[data-next]');
    if (!btn) throw new Error(`a etapa ${ativa.id} não tem botão Avançar`);
    btn.dispatchEvent(new pagina.window.MouseEvent('click', { bubbles: true }));
}

export function voltar(pagina) {
    const ativa = pagina.document.querySelector('.stage.active');
    ativa.querySelector('[data-back]').dispatchEvent(
        new pagina.window.MouseEvent('click', { bubbles: true }));
}

export function bannerVisivel(pagina, etapa) {
    return pagina.document.getElementById('error-' + etapa)?.classList.contains('visible');
}

export function camposComErro(pagina, etapa) {
    const stage = pagina.document.getElementById('stage-' + etapa);
    return [...stage.querySelectorAll('.field.error')].map((f) => {
        const input = f.querySelector('[name]');
        return {
            nome: input?.getAttribute('name') ?? f.dataset.pillGroup ?? '(sem name)',
            mensagem: f.querySelector('.field-error')?.textContent ?? ''
        };
    });
}

/** Percorre a capa e todas as etapas até a última, preenchendo o que for pedido. */
export function preencherAte(pagina, { etapas, pilulas = {}, ultima }) {
    clicar(pagina, '#startBtn');
    for (let n = 1; n <= ultima; n++) {
        if (etapas[n]) preencher(pagina, etapas[n]);
        for (const [grupo, valores] of Object.entries(pilulas[n] ?? {})) {
            clicarPilulas(pagina, grupo, valores);
        }
        if (n < ultima) avancar(pagina);
    }
}
