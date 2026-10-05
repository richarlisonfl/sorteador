# Sorteador de jogos

Aplicação web estática para organizar turmas em equipes nos Jogos Internos do IFPA 2026. O sistema funciona no navegador, sem servidor próprio, banco de dados ou dependências externas.

**Página publicada:** [richarlisonfl.github.io/sorteador](https://richarlisonfl.github.io/sorteador/)

## Licença e atribuição

Este projeto é distribuído sob a **GNU General Public License, versão 3 (GPL-3.0-only)**. O texto integral está em [`LICENSE`](LICENSE).

Copyright (C) 2026 Richarlison Lisboa, Técnico de Informática e Estudante de ADS.

Forks e redistribuições devem preservar a atribuição ao autor original descrita em [`NOTICE`](NOTICE), conforme o termo adicional da seção 7(b) da GPL-3.0. Versões modificadas também devem indicar que foram alteradas e informar a data, como estabelece a seção 5(a) da licença. A atribuição não representa endosso do autor às versões derivadas.

## Executar localmente

Abra `index.html` no navegador. Para testar como um site local, também é possível iniciar o servidor simples que acompanha o Python:

```sh
python3 -m http.server 8000
```

Depois, acesse `http://localhost:8000`. Não é preciso instalar pacotes: HTML, CSS e JavaScript são servidos diretamente.

## Arquivos do projeto

- [`index.html`](index.html): estrutura da página, tabela, botões, formulários e diálogo de configuração.
- [`styles.css`](styles.css): aparência, adaptação para telas menores e regras de impressão/PDF.
- [`script.js`](script.js): configuração, regras de distribuição, interação, código de salvamento e restauração.

## Como a aplicação funciona

1. O navegador lê o HTML e cria os elementos da página. O `<link>` carrega `styles.css`; o `<script src="script.js" defer>` carrega o JavaScript depois que o HTML foi analisado.
2. O JavaScript procura os elementos pelos seus `id`s, lê a configuração salva no navegador ou usa a configuração padrão e desenha a tabela.
3. Os botões registram eventos de clique. Cada clique altera o estado do sorteio e chama a função que atualiza a tabela.
4. Quando todas as equipes foram reveladas, o sistema cria um código com os dados do resultado. Esse código pode ser copiado ou digitado mais tarde para restaurar o sorteio.
5. A impressão usa a função nativa do navegador. O CSS de impressão formata a tabela para papel A4 em paisagem e esconde controles que não pertencem ao resultado.

Os arquivos são estáticos; o GitHub Pages apenas entrega HTML, CSS e JavaScript ao navegador. A lógica roda no dispositivo da pessoa que abriu a página.

## Estrutura do HTML

O [`index.html`](index.html) descreve o conteúdo, sem implementar o sorteio:

- O cabeçalho identifica o site e abre o diálogo de configuração.
- A seção `actions` contém **Sortear todos** e **Sortear um a um**.
- A seção **Equipes e turmas** contém uma tabela sem cabeçalhos ou linhas fixos. O JavaScript cria seu conteúdo a partir da configuração.
- A seção `ferramentas-resultado`, colocada abaixo da tabela, reúne impressão, código de salvamento e restauração.
- O `<dialog>` contém o formulário de configuração. O navegador fornece o comportamento modal e o JavaScript valida os campos.

Os identificadores como `sortear-todos`, `corpo-equipes` e `formulario-restauracao` são pontos de conexão entre HTML e JavaScript. Se um `id` for alterado em um arquivo, a referência correspondente no outro também precisa ser atualizada. Rótulos, regiões e atributos `aria-live` ajudam leitores de tela a identificar controles e mensagens dinâmicas. Atributos e APIs padronizados da plataforma, como `id`, `class`, `value` e `document.querySelector`, permanecem em inglês.

## Aparência e impressão

O [`styles.css`](styles.css) organiza a aparência em camadas:

- As variáveis em `:root` centralizam cores reutilizadas pela página.
- As regras gerais definem tipografia, fundo, espaçamentos, botões e tabela.
- A media query de até 640 px empilha os botões e os controles para caber em telas estreitas; a tabela pode rolar horizontalmente na tela.
- `:focus-visible` mostra o foco do teclado, e `prefers-reduced-motion` reduz animações para quem prefere movimento reduzido.
- `@page` e `@media print` selecionam A4 paisagem, compactam células, definem bordas e larguras e mantêm o cabeçalho verde. Configurações, botões e formulário de restauração não aparecem no papel.

Ao imprimir, o navegador abre a própria janela de impressão. Escolha a opção para salvar como PDF se quiser gerar um arquivo.

## Configuração das turmas

No começo de [`script.js`](script.js), `CHAVE_CONFIGURACAO` identifica a chave atual do `localStorage` e `PADRAO_TURMA` valida os nomes das turmas. A expressão regular captura três partes: um ou mais dígitos para o ano, letras para o curso e uma letra depois do hífen para o turno. Por exemplo, `1ADM-A` significa ano 1, curso ADM, turno A.

`CONFIGURACAO_PADRAO` fornece os valores usados quando ainda não há uma configuração salva ou quando os dados salvos não podem ser lidos. Uma configuração tem esta forma:

```js
{
  turmas: ['1INF-A', '1MAB-A', '1ADM-A'],
  extras: ['Ensino Superior']
}
```

`turmas` são as classes consideradas pelas regras do sorteio. `extras` são nomes que aparecem como equipes fixas, fora da distribuição regular. O padrão do projeto cria turmas dos cursos INF, MAB e ADM para os anos 1, 2 e 3, nos turnos A e B.

O botão de configuração abre o diálogo. Cada linha do campo corresponde a uma turma; o segundo campo recebe itens extras, também um por linha. O formulário rejeita linhas em formato inválido, configuração sem turmas e nomes repetidos. Ao salvar, a configuração é normalizada e armazenada em `localStorage` na chave `sorteador-configuracao-v1`. A função `carregarConfiguracao` também reconhece a chave e os campos antigos (`sorteador-config-v1`, `classes` e `extra`) e migra os dados para o formato atual. Isso mantém a configuração naquele navegador, mas não a sincroniza entre pessoas ou dispositivos. **Restaurar padrão** preenche os valores iniciais no formulário; é preciso salvar para aplicá-los.

## Regras do sorteio

O JavaScript transforma cada nome válido em um objeto com `nome`, `ano`, `curso` e `turno`. A função `montarEquipes` usa esses dados para montar a tabela:

1. Anos e turnos são identificados e ordenados. Os anos aparecem do maior para o menor.
2. As turmas são separadas por turno e agrupadas por curso.
3. Cursos com uma única turma naquele turno viram equipes individuais. As demais turmas são distribuídas por ano.
4. Para as turmas regulares, a quantidade de equipes de cada turno é baseada no maior número de turmas regulares de um mesmo ano. `preencherEquipes` tenta preencher essas equipes sem repetir o mesmo curso na mesma equipe, considerando todos os anos. Ela usa busca recursiva com alternativas aleatórias; se não encontrar uma distribuição válida, informa o erro em vez de exibir um sorteio inválido.

A função `embaralhar` embaralha uma cópia da lista usando Fisher–Yates e `Math.random()`. Como toda aleatoriedade do navegador, isso não é uma auditoria ou garantia criptográfica de imparcialidade.

Cada equipe tem `turno` e `vagas`; `vagas` associa um ano à turma daquela equipe. A função `renderizar` converte essa estrutura em cabeçalhos e células HTML. Uma turma ausente naquele ano aparece como “A definir”. No modo um a um, equipes ainda não reveladas aparecem com um traço.

### Dois modos de sorteio

- **Sortear todos** cria uma nova distribuição, revela todas as equipes e conclui o resultado em um clique.
- **Sortear um a um** revela uma equipe por clique. O código de salvamento e a impressão só ficam disponíveis quando a última equipe é revelada. Começar de novo após um resultado completo cria uma nova distribuição.

O estado de exibição fica nas variáveis `distribuicao` e `equipesReveladas`: `distribuicao` contém os anos e equipes calculados; `equipesReveladas` indica quantas equipes já podem ser mostradas.

## Código de salvamento

Ao concluir um sorteio, `exibirResultadoConcluido` cria um objeto com:

- `versao`: versão do formato do objeto;
- `identificador` e `dataCriacao`: identificação e data do sorteio;
- `configuracao`: turmas e extras utilizados;
- `distribuicao`: anos e equipes completas.

`codificarSorteio` serializa esse objeto como JSON, transforma os bytes em Base64 URL-safe e acrescenta uma soma de verificação. Os novos códigos começam com `SJ2`. Ao restaurar um código `SJ1` antigo, `decodificarSorteio` converte seus campos para português e o resultado volta a ser exibido como `SJ2`. Os dados ficam dentro do próprio código: não há registro remoto nem banco de dados.

**Para salvar:** use **Copiar código** ou imprima o resultado. Guarde o texto completo, sem alterar caracteres.

**Para restaurar:** cole o código em **Restaurar usando um código salvo** e envie o formulário. `decodificarSorteio` verifica o formato e a soma; `validarSorteio` confere configuração, anos, equipes, duplicatas e se todas as turmas estão representadas. Se estiver válido, a tabela é reconstruída com o resultado original.

A soma de verificação detecta muitos erros acidentais de digitação, mas não é criptografia nem assinatura digital. O código não prova quem criou o sorteio e pode ficar longo quando há muitas turmas.

## Sugestão de leitura do código

Para estudar o projeto em etapas, siga esta ordem:

1. Em [`index.html`](index.html), localize os `id`s `sortear-todos`, `sortear-uma-a-uma`, `cabecalho-equipes`, `corpo-equipes` e `ferramentas-resultado`.
2. Em [`script.js`](script.js), acompanhe `CONFIGURACAO_PADRAO`, `analisarTurma` e `montarEquipes` para entender os dados e as regras.
3. Leia `renderizar`, `sortear` e os eventos associados a `sortear-todos` e `sortear-uma-a-uma` para ver como o estado vira uma tabela interativa.
4. Estude `codificarSorteio`, `decodificarSorteio` e `validarSorteio` para seguir o ciclo de salvar e restaurar sem servidor.
5. Em [`styles.css`](styles.css), compare as regras da tela, a media query móvel e o bloco `@media print`.

Ao alterar ou acrescentar um elemento, confira os `id`s usados pelo JavaScript e teste tanto uma tela estreita quanto a impressão. Mudanças nas regras de equipes devem ser testadas com configurações de anos, cursos e turnos diferentes.

## Como o protótipo virou aplicação

O navegador transforma os arquivos em uma aplicação em tempo de execução: o HTML fornece os elementos, o CSS determina como aparecem e o JavaScript conecta esses elementos às regras do sorteio. Os eventos dos botões acionam as funções, que atualizam o estado e redesenham a tabela. `localStorage` guarda apenas as preferências de configuração naquele navegador; o código de salvamento transporta o resultado completo quando ele precisa ser levado para outro momento ou dispositivo. Por fim, o GitHub Pages publica os três arquivos sem etapa de compilação.
