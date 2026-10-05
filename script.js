// SPDX-License-Identifier: GPL-3.0-only; termos de direitos autorais e atribuição: LICENSE e NOTICE.
// --- 1. CONFIGURAÇÃO E LEITURA DOS DADOS ---
const CHAVE_CONFIGURACAO = 'sorteador-configuracao-v1';
const CHAVE_CONFIGURACAO_ANTIGA = 'sorteador-config-v1';
const PADRAO_TURMA = /^(\d+)([A-Za-zÀ-ÿ]+)-([A-Za-z])$/;
const ROTULO_A_DEFINIR = 'A definir';

const CONFIGURACAO_PADRAO = {
  turmas: ['INF', 'MAB', 'ADM'].flatMap((curso) =>
    ['A', 'B'].flatMap((turno) => [1, 2, 3].map((ano) => `${ano}${curso}-${turno}`))
  ),
  extras: []
};

const separarLinhas = (texto) =>
  texto.split('\n').map((linha) => linha.trim()).filter(Boolean);

const analisarTurma = (nome) => {
  const correspondencia = PADRAO_TURMA.exec(nome);
  if (!correspondencia) return null;
  return { nome, ano: Number(correspondencia[1]), curso: correspondencia[2].toUpperCase(), turno: correspondencia[3].toUpperCase() };
};

const normalizarConfiguracao = (dados) => {
  if (dados && Array.isArray(dados.turmas) && Array.isArray(dados.extras)) {
    return { turmas: dados.turmas, extras: dados.extras };
  }
  if (dados && Array.isArray(dados.classes) && Array.isArray(dados.extra)) {
    return { turmas: dados.classes, extras: dados.extra };
  }
  return null;
};

const carregarConfiguracao = () => {
  try {
    for (const chave of [CHAVE_CONFIGURACAO, CHAVE_CONFIGURACAO_ANTIGA]) {
      const dadosSalvos = JSON.parse(localStorage.getItem(chave));
      const configuracaoSalva = normalizarConfiguracao(dadosSalvos);
      if (!configuracaoSalva) continue;
      if (chave === CHAVE_CONFIGURACAO_ANTIGA) {
        try {
          localStorage.setItem(CHAVE_CONFIGURACAO, JSON.stringify(configuracaoSalva));
        } catch {
          // Mantém a configuração em memória se o navegador bloquear a migração.
        }
      }
      return configuracaoSalva;
    }
  } catch {
    // configuração inválida: usa o padrão
  }
  return structuredClone(CONFIGURACAO_PADRAO);
};

// --- 2. EMBARALHAMENTO E MONTAGEM DAS EQUIPES ---
const embaralhar = (lista) => {
  const copia = [...lista];
  for (let indice = copia.length - 1; indice > 0; indice -= 1) {
    const indiceAleatorio = Math.floor(Math.random() * (indice + 1));
    [copia[indice], copia[indiceAleatorio]] = [copia[indiceAleatorio], copia[indice]];
  }
  return copia;
};

// Distribui as turmas de cada ano entre as equipes sem repetir curso na mesma equipe.
const preencherEquipes = (anos, turmasPorAno, quantidadeEquipes) => {
  const equipes = Array.from({ length: quantidadeEquipes }, () => ({}));

  const posicionarAno = (indiceAno) => {
    if (indiceAno === anos.length) return true;
    const ano = anos[indiceAno];
    const grupo = embaralhar(turmasPorAno.get(ano) ?? []);

    const atribuirTurmas = (indiceEquipe, restantes) => {
      if (indiceEquipe === quantidadeEquipes) return posicionarAno(indiceAno + 1);
      const opcoes = restantes.filter(
        (turma) => !Object.values(equipes[indiceEquipe]).some((existente) => existente.curso === turma.curso)
      );
      const candidatas = restantes.length <= quantidadeEquipes - indiceEquipe - 1 ? [...opcoes, null] : opcoes;
      for (const escolha of embaralhar(candidatas)) {
        if (escolha) equipes[indiceEquipe][ano] = escolha;
        const resto = escolha ? restantes.filter((turma) => turma !== escolha) : restantes;
        if (atribuirTurmas(indiceEquipe + 1, resto)) return true;
        delete equipes[indiceEquipe][ano];
      }
      return false;
    };

    return atribuirTurmas(0, grupo);
  };

  return posicionarAno(0) ? equipes : null;
};

const montarEquipes = (configuracao) => {
  const turmasAnalisadas = configuracao.turmas.map(analisarTurma);
  const turmas = turmasAnalisadas.filter(Boolean);
  const anos = [...new Set(turmas.map((turma) => turma.ano))].sort((a, b) => b - a);
  const turnos = [...new Set(turmas.map((turma) => turma.turno))].sort();
  const resultado = [];

  turnos.forEach((turno) => {
    const turmasNoTurno = turmas.filter((turma) => turma.turno === turno);
    const gruposPorCurso = new Map();
    turmasNoTurno.forEach((turma) => gruposPorCurso.set(turma.curso, [...(gruposPorCurso.get(turma.curso) ?? []), turma]));

    const isoladas = [];
    const regulares = [];
    gruposPorCurso.forEach((grupo) => (grupo.length === 1 ? isoladas : regulares).push(...grupo));

    const turmasPorAno = new Map();
    regulares.forEach((turma) => turmasPorAno.set(turma.ano, [...(turmasPorAno.get(turma.ano) ?? []), turma]));
    const quantidadeEquipes = Math.max(0, ...[...turmasPorAno.values()].map((grupo) => grupo.length));

    if (quantidadeEquipes > 0) {
      const preenchidas = preencherEquipes(anos, turmasPorAno, quantidadeEquipes);
      if (!preenchidas) throw new Error(`Não foi possível montar equipes válidas no turno ${turno}. Revise as turmas.`);
      preenchidas.forEach((vagas) => resultado.push({ turno, vagas: Object.fromEntries(Object.entries(vagas).map(([ano, turma]) => [ano, turma.nome])) }));
    }

    isoladas.forEach((turma) => resultado.push({ turno, vagas: { [turma.ano]: turma.nome } }));
  });

  configuracao.extras.forEach((nome) => resultado.push({ turno: null, vagas: { [anos[anos.length - 1] ?? 1]: nome }, fixa: true }));

  return { anos, equipes: resultado };
};

// --- 3. GERAÇÃO E VALIDAÇÃO DO CÓDIGO DE SALVAMENTO ---
const criarIdentificadorSorteio = () => globalThis.crypto?.randomUUID?.()
  ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const calcularVerificacao = (valor) => {
  let valorVerificacao = 2166136261;
  for (let indice = 0; indice < valor.length; indice += 1) {
    valorVerificacao ^= valor.charCodeAt(indice);
    valorVerificacao = Math.imul(valorVerificacao, 16777619);
  }
  return (valorVerificacao >>> 0).toString(16).padStart(8, '0');
};

const codificarSorteio = (dadosSorteio) => {
  const octetos = new TextEncoder().encode(JSON.stringify(dadosSorteio));
  let binario = '';
  octetos.forEach((octeto) => { binario += String.fromCharCode(octeto); });
  const codificado = btoa(binario).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return `SJ2.${codificado}.${calcularVerificacao(codificado)}`;
};

const converterSorteioLegado = (dadosSorteio) => {
  if (!dadosSorteio || dadosSorteio.version !== 1 || !dadosSorteio.config || !dadosSorteio.layout) {
    throw new Error('O código não contém um sorteio compatível.');
  }

  const configuracaoLegada = normalizarConfiguracao(dadosSorteio.config);
  if (!configuracaoLegada || !Array.isArray(dadosSorteio.layout.years) || !Array.isArray(dadosSorteio.layout.teams)) {
    throw new Error('O código antigo não contém todos os dados do sorteio.');
  }

  return {
    versao: 2,
    identificador: dadosSorteio.id,
    dataCriacao: dadosSorteio.createdAt,
    configuracao: configuracaoLegada,
    distribuicao: {
      anos: dadosSorteio.layout.years,
      equipes: dadosSorteio.layout.teams.map((equipe) => ({
        turno: equipe.shift,
        vagas: equipe.slots,
        fixa: Boolean(equipe.fixed)
      }))
    }
  };
};

const validarSorteio = (dadosSorteio) => {
  if (!dadosSorteio || dadosSorteio.versao !== 2
    || typeof dadosSorteio.identificador !== 'string' || !dadosSorteio.identificador
    || Number.isNaN(Date.parse(dadosSorteio.dataCriacao))) {
    throw new Error('O código não contém um sorteio válido.');
  }

  const configuracaoSalva = dadosSorteio.configuracao;
  const distribuicaoSalva = dadosSorteio.distribuicao;
  if (!configuracaoSalva || !Array.isArray(configuracaoSalva.turmas) || !Array.isArray(configuracaoSalva.extras)
    || !distribuicaoSalva || !Array.isArray(distribuicaoSalva.anos) || !Array.isArray(distribuicaoSalva.equipes)) {
    throw new Error('O código não contém todos os dados do sorteio.');
  }

  const turmasAnalisadas = configuracaoSalva.turmas.map(analisarTurma);
  if (!turmasAnalisadas.length || turmasAnalisadas.some((turma) => !turma)
    || configuracaoSalva.extras.some((turma) => typeof turma !== 'string' || !turma.trim())) {
    throw new Error('O código contém uma configuração inválida.');
  }

  const nomesTurmas = [...configuracaoSalva.turmas, ...configuracaoSalva.extras].map((nome) => nome.toUpperCase());
  const nomesEsperados = new Set(nomesTurmas);
  if (nomesEsperados.size !== nomesTurmas.length) throw new Error('O código contém turmas repetidas.');

  const anos = [...new Set(turmasAnalisadas.map((turma) => turma.ano))].sort((a, b) => b - a);
  if (JSON.stringify(distribuicaoSalva.anos) !== JSON.stringify(anos) || !distribuicaoSalva.equipes.length) {
    throw new Error('O código contém uma tabela de sorteio inválida.');
  }

  const nomesAtribuidos = new Set();
  distribuicaoSalva.equipes.forEach((equipe) => {
    if (!equipe || !(equipe.turno === null || typeof equipe.turno === 'string')
      || !equipe.vagas || typeof equipe.vagas !== 'object' || Array.isArray(equipe.vagas)) {
      throw new Error('O código contém uma equipe inválida.');
    }
    Object.entries(equipe.vagas).forEach(([ano, nome]) => {
      const nomeNormalizado = typeof nome === 'string' ? nome.toUpperCase() : '';
      if (!anos.includes(Number(ano)) || !nomesEsperados.has(nomeNormalizado) || nomesAtribuidos.has(nomeNormalizado)) {
        throw new Error('O código contém uma distribuição inválida.');
      }
      nomesAtribuidos.add(nomeNormalizado);
    });
  });

  if (nomesAtribuidos.size !== nomesEsperados.size) throw new Error('O código não inclui todas as turmas.');
  montarEquipes(configuracaoSalva);
};

const decodificarSorteio = (valor) => {
  const correspondencia = /^SJ([12])\.([A-Za-z0-9_-]+)\.([a-f0-9]{8})$/i.exec(valor.replace(/\s+/g, ''));
  if (!correspondencia || calcularVerificacao(correspondencia[2]) !== correspondencia[3].toLowerCase()) {
    throw new Error('Código inválido ou digitado incorretamente.');
  }

  try {
    const textoBase64 = correspondencia[2].replace(/-/g, '+').replace(/_/g, '/');
    const binario = atob(textoBase64.padEnd(Math.ceil(textoBase64.length / 4) * 4, '='));
    const octetos = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
    const dadosLidos = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(octetos));
    const dadosSorteio = Number(correspondencia[1]) === 1 ? converterSorteioLegado(dadosLidos) : dadosLidos;
    validarSorteio(dadosSorteio);
    return dadosSorteio;
  } catch (erro) {
    if (erro instanceof Error && erro.message.startsWith('O código')) throw erro;
    throw new Error('Não foi possível ler esse código de sorteio.');
  }
};

// --- 4. ELEMENTOS E ESTADO GLOBAL DA INTERFACE ---
const cabecalhoTabela = document.querySelector('#cabecalho-equipes');
const corpoTabela = document.querySelector('#corpo-equipes');
const statusSorteio = document.querySelector('#status-sorteio');
const quantidadeEquipes = document.querySelector('#quantidade-equipes');
const dataResultado = document.querySelector('#data-resultado');
const codigoSorteio = document.querySelector('#codigo-salvamento');
const statusCopia = document.querySelector('#status-copia');
const botaoImprimir = document.querySelector('#imprimir-resultado');
const botaoCopiar = document.querySelector('#copiar-codigo');
const formularioRestauracao = document.querySelector('#formulario-restauracao');
const campoCodigoRestauracao = document.querySelector('#codigo-restauracao');
const statusRestauracao = document.querySelector('#status-restauracao');

let configuracao = carregarConfiguracao();
let distribuicao = null;
let equipesReveladas = 0;
let codigoSalvamentoAtual = '';

// --- 5. RENDERIZAÇÃO E ESTADO DO SORTEIO ---
const limparResultadoConcluido = () => {
  codigoSalvamentoAtual = '';
  botaoCopiar.disabled = true;
  codigoSorteio.textContent = 'Conclua um sorteio para gerar o código.';
  dataResultado.textContent = 'Disponível ao concluir um sorteio.';
  statusCopia.textContent = '';
};

const exibirResultadoConcluido = (dadosSorteio = {
  versao: 2,
  identificador: criarIdentificadorSorteio(),
  dataCriacao: new Date().toISOString(),
  configuracao: structuredClone(configuracao),
  distribuicao: structuredClone(distribuicao)
}, codigoSalvamento = codificarSorteio(dadosSorteio)) => {
  codigoSalvamentoAtual = codigoSalvamento;
  codigoSorteio.textContent = codigoSalvamento.replace(/\.([A-Za-z0-9_-]+)\./, (_, trechoCodificado) =>
    `.${trechoCodificado.match(/.{1,6}/g).join(' ')}.`);
  dataResultado.textContent = `Gerado em ${new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(dadosSorteio.dataCriacao))} · Código ${dadosSorteio.identificador}`;
  botaoCopiar.disabled = false;
};

const rotuloTurno = (turno) => (turno ? `Turno ${turno}` : 'Fora do sorteio');

const renderizar = () => {
  const { anos, equipes } = distribuicao;
  cabecalhoTabela.replaceChildren();
  corpoTabela.replaceChildren();

  const celulaAno = document.createElement('th');
  celulaAno.scope = 'col';
  celulaAno.className = 'rotulo-linha';
  celulaAno.textContent = 'Ano';
  cabecalhoTabela.append(celulaAno);

  equipes.forEach((equipe, indice) => {
    const celula = document.createElement('th');
    celula.scope = 'col';
    celula.append(`Equipe ${indice + 1}`);
    const detalheTurno = document.createElement('small');
    detalheTurno.textContent = rotuloTurno(equipe.turno);
    celula.append(detalheTurno);
    cabecalhoTabela.append(celula);
  });

  const linhas = anos.length ? anos : [1];
  linhas.forEach((ano) => {
    const linha = document.createElement('tr');
    const rotuloAno = document.createElement('th');
    rotuloAno.scope = 'row';
    rotuloAno.className = 'rotulo-linha';
    rotuloAno.textContent = `${ano}º ano`;
    linha.append(rotuloAno);

    equipes.forEach((equipe, indice) => {
      const celula = document.createElement('td');
      if (indice >= equipesReveladas) {
        celula.textContent = '—';
        celula.className = 'equipe-pendente';
      } else if (equipe.vagas[ano]) {
        celula.textContent = equipe.vagas[ano];
      } else {
        celula.textContent = ROTULO_A_DEFINIR;
        celula.className = 'celula-sem-turma';
      }
      linha.append(celula);
    });
    corpoTabela.append(linha);
  });

  const totalTurmas = equipes.reduce((acumulado, equipe) => acumulado + Object.keys(equipe.vagas).length, 0);
  quantidadeEquipes.textContent = `${equipes.length} equipes · ${totalTurmas} turmas`;
};

const sortear = () => {
  try {
    distribuicao = montarEquipes(configuracao);
    return true;
  } catch (erro) {
    statusSorteio.textContent = erro.message;
    return false;
  }
};

const reiniciar = () => {
  limparResultadoConcluido();
  equipesReveladas = 0;
  if (sortear()) {
    statusSorteio.textContent = '';
    renderizar();
  }
};

// --- 6. EVENTOS DOS BOTÕES E DOS CÓDIGOS ---
document.querySelector('#sortear-todos').addEventListener('click', () => {
  if (!sortear()) return;
  equipesReveladas = distribuicao.equipes.length;
  statusSorteio.textContent = 'Sorteio concluído.';
  renderizar();
  exibirResultadoConcluido();
});

document.querySelector('#sortear-uma-a-uma').addEventListener('click', () => {
  if (!distribuicao || equipesReveladas === 0 || equipesReveladas >= distribuicao.equipes.length) {
    if (!sortear()) return;
    equipesReveladas = 0;
  }
  limparResultadoConcluido();
  equipesReveladas += 1;
  statusSorteio.textContent = equipesReveladas === distribuicao.equipes.length
    ? 'Sorteio concluído.'
    : `Equipe ${equipesReveladas} sorteada. Clique novamente para a próxima.`;
  renderizar();
  if (equipesReveladas === distribuicao.equipes.length) exibirResultadoConcluido();
});

botaoImprimir.addEventListener('click', () => {
  if (!distribuicao || equipesReveladas !== distribuicao.equipes.length) {
    statusSorteio.textContent = 'Conclua o sorteio para imprimir o resultado.';
    return;
  }

  if (typeof window.print !== 'function') {
    statusSorteio.textContent = 'Impressão indisponível neste navegador. Use Ctrl+P ou Cmd+P.';
    return;
  }

  statusSorteio.textContent = 'Se a janela de impressão não abrir, use Ctrl+P ou Cmd+P.';
  try {
    window.print();
  } catch {
    statusSorteio.textContent = 'Não foi possível abrir a impressão. Use Ctrl+P ou Cmd+P.';
  }
});

document.querySelector('#copiar-codigo').addEventListener('click', async () => {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(codigoSalvamentoAtual);
    } else {
      const campoTemporario = document.createElement('textarea');
      campoTemporario.value = codigoSalvamentoAtual;
      campoTemporario.setAttribute('readonly', '');
      campoTemporario.style.position = 'fixed';
      campoTemporario.style.opacity = '0';
      document.body.append(campoTemporario);
      campoTemporario.select();
      const copiado = document.execCommand('copy');
      campoTemporario.remove();
      if (!copiado) throw new Error('Falha ao copiar');
    }
    statusCopia.textContent = 'Código copiado.';
  } catch {
    statusCopia.textContent = 'Não foi possível copiar automaticamente. Selecione e copie o código.';
  }
});

formularioRestauracao.addEventListener('submit', (evento) => {
  evento.preventDefault();
  try {
    const codigo = campoCodigoRestauracao.value.trim().replace(/\s+/g, '');
    const sorteioSalvo = decodificarSorteio(codigo);
    configuracao = structuredClone(sorteioSalvo.configuracao);
    distribuicao = structuredClone(sorteioSalvo.distribuicao);
    equipesReveladas = distribuicao.equipes.length;
    localStorage.setItem(CHAVE_CONFIGURACAO, JSON.stringify(configuracao));
    renderizar();
    exibirResultadoConcluido(sorteioSalvo);
    statusSorteio.textContent = 'Sorteio restaurado.';
    statusRestauracao.textContent = 'Sorteio restaurado com sucesso.';
  } catch (erro) {
    statusRestauracao.textContent = erro.message;
  }
});

// --- 7. DIÁLOGO E VALIDAÇÃO DA CONFIGURAÇÃO ---
const dialogo = document.querySelector('#dialogo-configuracao');
const campoTurmas = document.querySelector('#campo-turmas');
const campoExtras = document.querySelector('#campo-extras');
const caixaErro = document.querySelector('#erro-configuracao');

const preencherFormulario = (configuracaoOrigem) => {
  campoTurmas.value = configuracaoOrigem.turmas.join('\n');
  campoExtras.value = configuracaoOrigem.extras.join('\n');
  caixaErro.textContent = '';
};

document.querySelector('#abrir-configuracao').addEventListener('click', () => {
  preencherFormulario(configuracao);
  dialogo.showModal();
});
document.querySelector('#cancelar-configuracao').addEventListener('click', () => dialogo.close());
document.querySelector('#restaurar-padrao').addEventListener('click', () => preencherFormulario(CONFIGURACAO_PADRAO));

document.querySelector('#formulario-configuracao').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const turmas = separarLinhas(campoTurmas.value);
  const extras = separarLinhas(campoExtras.value);
  const invalidas = turmas.filter((nome) => !analisarTurma(nome));
  const nomesConfigurados = [...turmas, ...extras].map((nome) => nome.toUpperCase());
  const duplicadas = nomesConfigurados.filter((nome, indice) => nomesConfigurados.indexOf(nome) !== indice);
  const problemas = [];

  if (!turmas.length) problemas.push('Informe ao menos uma turma.');
  if (invalidas.length) problemas.push(`Formato inválido: ${invalidas.join(', ')}`);
  if (duplicadas.length) problemas.push(`Turmas repetidas: ${[...new Set(duplicadas)].join(', ')}`);

  if (!problemas.length) {
    try {
      montarEquipes({ turmas, extras });
    } catch (erro) {
      problemas.push(erro.message);
    }
  }

  if (problemas.length) {
    caixaErro.textContent = problemas.join('\n');
    return;
  }

  configuracao = { turmas: turmas.map((nome) => nome.toUpperCase()), extras };
  localStorage.setItem(CHAVE_CONFIGURACAO, JSON.stringify(configuracao));
  dialogo.close();
  reiniciar();
});

// --- 8. INICIALIZAÇÃO DA PÁGINA ---
reiniciar();
