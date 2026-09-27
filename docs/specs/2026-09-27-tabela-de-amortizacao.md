# Tabela de amortização (Etapa 7) — Spec

**Criado em:** 2026-09-27
**Status:** Concluída em 2026-09-27 (decisões 1 a 4 resolvidas na mesma data; plano executado, T1 a T12)
**Etapa do plano:** 7 (`plano.md`) · **Requisitos:** R1 (mais um `GET` pela interface), R4 (visualização da amortização)

## Problema
O resultado (Etapa 6) mostra, para cada financiamento, a primeira e a última parcela, o total pago e os juros, mas não **como** a dívida é paga: quanto de cada parcela é juros, quanto amortiza e como o saldo devedor cai mês a mês.
Essa é a tabela de amortização (Price ou SAC), e o botão **Ver parcelas** do cartão de cada financiamento hoje leva a uma tela provisória ("Tela em construção").

## Objetivo
Mostrar, para uma opção de financiamento, os dados da opção, os **totais** e a tabela mês a mês (parcela, juros, amortização e saldo devedor após o pagamento), exatamente como o backend devolve, com carregamento, erro e `404` tratados
e a volta ao resultado. O frontend **não recalcula nada**: só exibe (e formata) o `GET /simulacoes/:id/financiamentos/:fid/parcelas`.

## Fora de escopo
- Qualquer cálculo no cliente: parcela, juros, amortização, saldo, totais, subtotais por ano, "quanto já foi pago" ou "quanto falta": tudo vem do `/parcelas`.
- Comparar duas opções lado a lado nesta tela e trocar de opção sem voltar ao resultado (a decisão 4 manteve só a volta ao resultado).
- Exportar, imprimir ou baixar a tabela (**Etapa 9**, opcional) e o polimento de responsividade e erros de todo o app (**Etapa 8**); aqui só o necessário para a tela ser boa no celular.
- Editar a opção nesta tela (o link **Editar simulação** leva à edição, onde ficam as opções) e paginação, ordenação ou filtros da tabela (o backend não os oferece, por decisão do autor).
- Alterações no repositório do backend.

## Proposta

### O que foi verificado (estado atual)
| Item | Situação |
|---|---|
| Tela | `pages/Amortizacao.jsx` é o `EmConstrucao` ("Amortização da opção #N" e "Simulação #N"); a rota `/simulacoes/:id/financiamentos/:fid` já existe (protegida) e o cartão de cada financiamento do resultado já liga a ela (**Ver parcelas**) |
| Mocks | `handlers/parcelas.js` devolve as fixtures `parcelas-price.json` (48x) e `parcelas-sac.json` (36x) conforme o sistema da opção, com as regras de acesso do backend (401 → simulação 404 → opção 404). **Faltam** os casos de taxa 0, prazo 1, parcelas de centavos (0,00) e quitação antecipada |
| Cache | não há chave para as parcelas; elas dependem da **opção** e da **simulação** (o valor do veículo muda o `valor_financiado`), então editar uma ou outra precisa invalidá-las |
| Reaproveitável | `formatarMoeda`, `formatarPercentual`, `formatarPrazo`, `formatarMes`, `ROTULO_DO_SISTEMA`, `EstadoErro`, `EsqueletoLista`, `SimulacaoNaoEncontrada`, o padrão de cabeçalho (lista de definição) do resultado, o Recharts (já no pacote) e o tema do MUI |
| Dependências | tudo instalado; **nenhuma dependência nova e nenhum ícone novo** (os mesmos 5) |
| Backend | no ar; contrato conferido abaixo com contas descartáveis (Price, SAC, taxa 0, prazos de 1 a 72, casos extremos, erros) |

### Contrato real observado (backend, 2026-09-27)
`GET /api/simulacoes/:id/financiamentos/:fid/parcelas` (JWT; só leitura; calculado a cada requisição). `200` com três blocos, tudo número JSON:

- **`financiamento`** (cabeçalho): `id, nome, prazo_meses, sistema_amortizacao` (`PRICE`/`SAC`), `taxa_juros_mensal` (% a.m.), `valor_entrada` (a da **opção**) e `valor_financiado`.
- **`parcelas`**: **uma linha por mês**, de 1 ao prazo, cada uma `{ numero, valor_parcela, juros, amortizacao, saldo_devedor }`. O `saldo_devedor` é o saldo **depois** do pagamento (não há linha do mês 0; o saldo inicial é o `valor_financiado` do cabeçalho).
- **`totais`**: `{ total_pago, total_juros, custo_total }`. Batem **exatamente** com os do `/resultado` da mesma opção (conferido em Price, SAC e sem juros: `total_pago`, `total_juros`, `custo_total`, `valor_financiado` e a primeira e a última parcela são iguais).

| Caso | O que o backend devolve |
|---|---|
| Price 48x a 1,5 % a.m., financiado 75.000 | parcela fixa **2.203,12** do mês 1 ao 47 e **2.203,45** no mês 48 (a última absorve o resíduo); juros decrescentes (1.125,00, 1.108,83...), amortização crescente (1.078,12, 1.094,29...); saldo final 0,00; totais 105.750,09 / 30.750,09 / 125.750,09 |
| SAC 36x a 1,3 % a.m., financiado 70.000 | amortização constante (**1.944,44**, e **1.944,60** na última); parcelas decrescentes (2.854,44, 2.829,16... 1.969,88); totais 86.835,04 / 16.835,04 / 111.835,04 |
| taxa 0 (72x sem juros) | `juros` **0,00** em todas as linhas; parcela = amortização (1.319,44; a última 1.319,76); `total_juros` 0,00 |
| prazo 1 | uma linha; Price e SAC iguais (76.125,00 com 1.125,00 de juros) |
| **parcelas de centavos** (financiado 0,01 em 72x, Price e SAC, qualquer taxa) | **71 linhas com parcela 0,00**, juros 0,00 e amortização 0,00 (o saldo fica 0,01) e a **72ª com 0,01** que zera o saldo; `total_pago` 0,01 |
| **quitação antecipada** (financiado 0,02 em 3x) | parcelas 0,01, 0,01 e **0,00**: o saldo já é 0,00 na linha 2 e a linha 3 sai zerada (28 combinações de valor, taxa, prazo e sistema deram esse padrão) |
| taxas e prazos extremos | 72x a 20 % a.m. sem entrada: Price de 19.000,04 a 13.092,16 (total pago 1.362.095,00); SAC de 20.319,44 a 1.583,71 (788.502,27); nada quebra |
| tamanho e tempo | 1 linha ≈ 0,5 kB, 48 linhas ≈ 7,5 kB, 72 linhas ≈ 11 kB; 4 a 6 ms |
| editar a opção (taxa 1,5 → 2,0) | o `/parcelas` seguinte já traz os novos valores (totais 117.366,58 / 42.366,58 / 137.366,58) e a taxa nova no cabeçalho |
| `?foo=1` (parâmetro qualquer) | **`200`**: o `/parcelas` ignora parâmetros (diferente do `/resultado`, que os recusa) |

Erros: sem token → `401` (`WWW-Authenticate: Bearer`); simulação inexistente, de outra pessoa ou id `0` → `404 "Simulação não encontrada"`; opção inexistente, id `0` ou **de outra simulação** → `404 "Opção de financiamento não encontrada"`; id não numérico (simulação ou opção) → `404 "Recurso não encontrado"`.
Ordem: **401 → simulação (404) → opção (404)** (simulação e opção inexistentes juntas dão o 404 da simulação). Só `GET` (`POST` → `405`).

### Desvios dos mocks a corrigir nesta etapa
As regras de acesso e as mensagens do handler já são as reais (conferidas com a tabela acima). O que falta é **cobertura de cenários**:
1. **Fixtures novas capturadas do backend real** (ids normalizados: simulação 1 e opção 1): sem juros 72x, prazo 1, parcelas de centavos (financiado 0,01 em 72x) e quitação antecipada (financiado 0,02 em 3x). As fixtures Price 48x e SAC 36x seguem como estão.
2. **Atalhos de teste** (`servidor.use(...)`, como os do resultado e dos índices) que mantêm as regras de acesso e devolvem a fixture pedida: `parcelasSemJuros()`, `parcelasDeUmMes()`, `parcelasDeCentavos()`, `parcelasQuitacaoAntecipada()` e `parcelasIndisponivel()` (503).
3. O teste dos mocks passa a conferir as chaves das novas fixtures e a **igualdade dos totais com os do `/resultado`** nas fixtures que têm as duas (Price e SAC), com literais reais como referência.

### Estrutura criada e alterada
```
src/
  api/parcelas.js                  # obterParcelas(simulacaoId, financiamentoId, { signal }) sobre o client
  hooks/chavesSimulacoes.js        # parcelas(id, fid) = ['simulacoes', id, 'parcelas', fid]; parcelas(id) é o prefixo de todas as da simulação
  hooks/useParcelas.js             # a consulta das parcelas de uma opção
  hooks/useAtualizarFinanciamento.js  # passa a invalidar as parcelas da opção editada
  hooks/useExcluirFinanciamento.js    # passa a remover as parcelas da opção excluída
  hooks/useAtualizarSimulacao.js      # passa a invalidar as parcelas de todas as opções da simulação (o veículo muda o valor financiado)
  components/
    ResumoFinanciamento.jsx        # os dados da opção e os três totais, num bloco acima da tabela
    TabelaAmortizacao.jsx          # a tabela mês a mês, num quadro com rolagem e cabeçalho fixo
    GraficoAmortizacao.jsx         # barras empilhadas: juros e amortização de cada parcela
  pages/Amortizacao.jsx            # a tela (substitui o EmConstrucao)
  mocks/                           # fixtures novas e atalhos
```
Os nomes do `plano.md` (`TabelaAmortizacao`, `ResumoFinanciamento`) são mantidos; `api/parcelas.js` em arquivo próprio (o plano deixava a opção de ficar em `financiamentos.js`).

### Comportamento
- **Busca:** `GET /simulacoes/:id/financiamentos/:fid/parcelas` ao abrir a tela (o `id` e o `fid` da rota), com esqueleto enquanto carrega. O resultado fica no cache do React Query; **nada é calculado** e o título e os dados vêm do próprio `financiamento` do resultado da chamada.
- **Cabeçalho e voltar:** título "Amortização: *nome da opção*"; links **Voltar ao resultado** (`/simulacoes/:id/resultado`) e **Editar simulação**.
- **Dados da opção** (`financiamento`): sistema (Price ou SAC), taxa (**% a.m.**), prazo, valor financiado e entrada, formatados.
- **Totais** (`totais`): num **bloco de resumo acima da tabela**, junto dos dados da opção: total pago, total de juros e custo total lado a lado, **como a API devolve** (nenhuma soma no cliente); o custo total é explicado com a mesma frase do resultado (o que se paga pelo carro: entrada mais parcelas). A tabela **não** tem linha de totais.
- **Gráfico:** barras empilhadas, uma por mês, com a **amortização** e os **juros** de cada parcela (lidos das colunas `amortizacao` e `juros`, sem conta), acima da tabela: na Price a fatia dos juros encolhe, na SAC a da amortização é constante. Recharts, cor **e** padrão diferentes nas duas fatias, legenda com as duas, tooltip em reais ("Mês 12"), eixo em valor compacto, título e resumo em texto para leitor de tela (a primeira e a última parcela, lidas da tabela), sem animação e largura responsiva; com 72 barras no celular elas ficam finas, sem rolagem horizontal.
- **Tabela:** num **quadro de altura limitada (cerca de 60 % da altura da tela) com o cabeçalho das colunas fixo** enquanto se rola as linhas (todas as linhas ficam na página; sem paginação nem linha de totais), com colunas **Mês**, **Parcela**, **Juros**, **Amortização** e **Saldo devedor** (o saldo **depois** do pagamento; uma nota curta diz isso e que o saldo inicial é o valor financiado), uma linha por mês exatamente como vem, valores em reais alinhados à direita. Parcelas de R$ 0,00 (centavos, quitação antecipada) aparecem **como vêm** e uma nota discreta
  as explica ("Parcelas de R$ 0,00 aparecem quando os centavos do saldo já foram quitados"), escolhida ao ver que alguma linha veio zerada (só uma comparação, não um cálculo). Rolagem horizontal no próprio quadro no celular e leitura por tabela acessível (`<table>` com legenda, `scope`, valores com a mesma largura).
- **Estados:** carregando (esqueleto), erro (rede/5xx: mensagem clara e **Tentar de novo**) e `404` (o mesmo estado "Simulação não encontrada" da edição e do resultado, para simulação inexistente, alheia **e opção inexistente ou de outra simulação**: nenhuma revela a existência de nada).
- **Cache:** `['simulacoes', id, 'parcelas', fid]`, com o `staleTime` de 30 s. Editar a **opção** invalida as parcelas dela; excluí-la as remove; editar a **simulação** invalida as parcelas de todas as opções dela (prefixo); excluir a simulação já as remove. Assim, depois de mudar uma opção ou o veículo e voltar, a tabela abre atualizada.
- **Sessão:** um `401` segue o fluxo da Etapa 2.
- **Acessibilidade:** a tabela tem legenda e `scope` e o quadro rolável recebe foco por teclado; nenhum valor depende só de cor; a ordem de leitura é cabeçalho, resumo com os totais, gráfico, tabela.
- **Navegação:** só **Voltar ao resultado** e **Editar simulação**; para ver outra opção volta-se ao resultado e usa-se o **Ver parcelas** do outro cartão (sem seletor de opção nesta tela).

### Mocks e testes
- **Mocks:** as fixtures novas (capturadas do backend real), os atalhos e o teste de contrato (chaves de cada fixture, o número de linhas = prazo, saldo final 0,00, e a igualdade dos totais com o `/resultado` nas fixtures que têm as duas).
- `api/parcelas` (ambiente `node`): a chamada, `401` (controle: `404` da simulação e da opção não avisam a sessão), os dois `404` com as mensagens reais e o mesmo `404` para a opção de outra simulação, `503` e rede, e o `signal`.
- `useParcelas` e as chaves: cache por opção (separado do da lista de opções e do resultado), `404` sem repetição, `503` uma vez, e a invalidação por editar a opção, excluir a opção e editar a simulação (e **só** da simulação e da opção certas).
- Componentes e tela (MSW): cada fixture (Price 48x, SAC 36x, sem juros, prazo 1, centavos, quitação antecipada) mostra o número de linhas do prazo, o texto exato de cada valor (a formatação do número da API, sem cálculo), os totais como vêm, a nota das parcelas 0,00 **só** quando há linha zerada, o cabeçalho com sistema, taxa e prazo, os links, e os estados de carregando, erro com **Tentar de novo** e `404`.
  Cada teste de comportamento tem um controle (a versão sem o comportamento).

### Casos de borda
- **Prazo 1:** uma linha; a "primeira" e a "última" parcela são a mesma.
- **Prazo 72 e 3 opções:** tabela de 72 linhas (~11 kB); a rolagem e o cabeçalho fixo mantêm o uso confortável.
- **Parcelas 0,00** (71 linhas no caso de 0,01 em 72x; a última do caso de quitação antecipada): mostradas como vêm, com a nota; nada é escondido nem recalculado.
- **Taxa 0:** juros "R$ 0,00" em todas as linhas e "0,00% a.m." no cabeçalho.
- **Nome longo** (até 120 caracteres): quebra a linha no título e no cabeçalho.
- **Valores grandes** (parcelas de 20.319,44 e total pago de 1.362.095,00, ou milhões): as colunas seguem legíveis e alinhadas.
- **Opção editada ou excluída em outra aba:** com o cache de 30 s a tela pode mostrar a versão anterior; a próxima abertura (ou o **Tentar de novo**) refaz e, se a opção sumiu, mostra o `404`.
- **Endereço com ids inválidos** (`/simulacoes/abc/financiamentos/1`, `/financiamentos/999`): o mesmo estado de "não encontrada", sem vazar existência.
- **Parâmetros extras no endereço** (`?foo=1`): ignorados, como no backend.

### Resíduos no banco de desenvolvimento do backend
A exploração desta spec usou duas **contas descartáveis** (`sonda-<aleatório>@example.com`; senhas aleatórias já descartadas, nunca impressas): a primeira execução do segundo script falhou por um nome de 1 caractere (o backend exige 2 ou mais) e foi refeita. Criaram várias simulações e **apagaram todas** ao fim (as contas terminaram com 0 simulações).
O backend não exclui usuários; sem impacto para o app.

## Decisões em aberto
Resolvidas em 2026-09-27 (decisões do autor):
1. ~~Como mostrar a tabela~~ **Quadro com rolagem e cabeçalho fixo:** a tabela fica num quadro de altura limitada (cerca de 60 % da tela), com o cabeçalho das colunas fixo no topo enquanto se rola as linhas e rolagem horizontal no próprio quadro no celular. Todas as linhas ficam na página, sem paginação
   e sem página inteira rolando.
2. ~~Gráfico da amortização~~ **Barras empilhadas, amortização e juros de cada parcela:** uma barra por mês dividida em duas fatias (juros e amortização), acima da tabela, com cor e padrão diferentes, legenda, tooltip, título e resumo em texto. Sem gráfico de linha do saldo e sem "só a tabela".
3. ~~Onde ficam os totais~~ **Bloco de resumo acima da tabela:** os dados da opção e os três totais (total pago, total de juros e custo total) lado a lado no topo, com a frase que explica o custo total; a tabela fica só com as linhas de cada mês, sem linha final de totais.
4. ~~Navegação entre as opções~~ **Só voltar ao resultado:** links **Voltar ao resultado** e **Editar simulação**; sem seletor de opção nesta tela (para ver outra opção, volta-se ao resultado e usa-se o **Ver parcelas** do outro cartão).

Sem decisões em aberto: a spec está pronta para o `/plan`.

## Critérios de aceite
- [x] `npm run lint` (0 avisos), `npm test` e `npm run build` verdes; nenhuma dependência nova e nenhum ícone novo.
- [x] **No navegador, contra o backend real:** **Ver parcelas** abre a tela de uma opção Price e de uma SAC; o cabeçalho traz sistema, taxa (% a.m.), prazo, valor financiado e entrada; a tabela tem uma linha por mês do prazo, com parcela, juros, amortização e saldo devedor **como o Swagger devolve**; a última linha tem saldo 0,00.
- [x] Os **totais** da tela são idênticos aos do `/resultado` da mesma opção (total pago, total de juros e custo total), e a primeira e a última parcela da tabela coincidem com as do cartão do resultado.
- [x] Numa **Price** a última parcela difere da primeira por centavos e a **SAC** tem parcelas decrescentes e amortização constante, exatamente como a API traz (nada recalculado).
- [x] Casos extremos: taxa 0 (juros "R$ 0,00" em todas as linhas), prazo 1 (uma linha) e parcelas 0,00 (com a nota que as explica) aparecem como vêm.
- [x] A tabela tem rolagem horizontal no celular, cabeçalho fixo e é utilizável em largura de celular.
- [x] Carregando (esqueleto), erro com **Tentar de novo** e `404` (simulação inexistente ou de outra pessoa, **opção inexistente ou de outra simulação**) estão implementados e testados, com o mesmo estado de "não encontrada".
- [x] Depois de editar a opção ou o valor do veículo e voltar, a tabela abre **atualizada**; excluir a opção remove as parcelas do cache.
- [x] Os mocks refletem o backend real (fixtures novas e atalhos) e o teste de contrato confere as chaves e a igualdade dos totais com o `/resultado`.
- [x] Nomes em `PascalCase.jsx`/`camelCase.js`; nenhum `console.log`; nenhum cálculo financeiro no `src/` (fora dos mocks e testes) e nenhuma chamada a API externa.
- [x] O `CLAUDE.md` é atualizado (estrutura, contrato das parcelas, contagem de testes) e o `plano.md` marca a Etapa 7.

## Plano de Implementação

**Status:** executado (T1 a T12) · **Criado em:** 2026-09-27

São 14 tarefas pequenas, em cinco blocos. Cada uma indica **quem executa** (**Claude** ou **Você**), os arquivos, o que muda e como validar. O código de cada módulo nasce **junto com os seus testes** (`*.test.js(x)` ao lado). Regras para todo o plano:
- O Claude **não** roda `git add`, `commit` nem `push` (os commits são seus).
- Ao fim de cada tarefa que altera código: `npm run lint` (0 avisos) e `npm test` verdes.
- Cada teste de comportamento tem um **controle** (a versão que não deve disparar) que prova que ele pode falhar; os testes de guarda (nota das parcelas 0,00 só com linha zerada, invalidação do cache, o mesmo `404` para simulação e opção) são provados também **removendo a checagem do código por um instante**, como nas Etapas 4 a 6.
- **Mensagens e números:** a referência são os literais da seção "Contrato real observado" desta spec e as **fixtures capturadas do backend real**, nunca o próprio componente ou handler testado; **nenhum teste calcula** valores financeiros (os testes conferem que o texto na tela é a formatação do número que a fixture traz).
- Testes de corrida usam uma **comporta** controlada pelo teste (nunca `delay` por tempo).
- **Nenhum cálculo financeiro no cliente:** nada de somar, subtrair, multiplicar ou dividir valores em reais (nem subtotais por ano, "quanto já foi pago" ou "quanto falta"); a tela só formata, lê as colunas `juros` e `amortizacao` para o gráfico e compara `valor_parcela === 0` para decidir a nota (a T9 procura por aritmética nos arquivos novos).
- **Sem dependência nova e sem ícone novo:** a T9 confere o `package.json` e que o bundle continua com os mesmos 5 ícones; o **Recharts já está instalado**.
- **`.gitignore`:** a T12 confere com `git status --ignored` e `git check-ignore -v` que nenhum arquivo novo foi ignorado por engano.
- **Segredos:** as contas descartáveis (T1 e T10; senha aleatória, nunca impressa) criam e **apagam** o que usarem.

**Ordem e dependências:** A → B → C → D → E. A T2 usa as fixtures da T1; a T4 usa a T3; a T5 usa o texto do custo total já existente em `CartoesResumo`; a T7 usa `formatar.js`; a T8 usa T4, T5, T6 e T7.
As tarefas que exigem **você** são a T11 (navegador) e a T13 (commit).

### Bloco A — Mocks

**T1 · Claude · Fixtures reais das parcelas**
- Arquivos: `src/mocks/fixtures/parcelas-sem-juros.json`, `parcelas-um-mes.json`, `parcelas-centavos.json`, `parcelas-quitacao-antecipada.json`, `src/mocks/contrato.test.js`.
- O que muda: capturo do **backend real** (conta descartável, dados fictícios, ids normalizados como nas fixtures anteriores: simulação 1 e opção 1) as parcelas de uma opção **sem juros** de 72x, de **1 mês**, de **financiado 0,01 em 72x** (71 linhas de R$ 0,00) e de **financiado 0,02 em 3x** (quitação antecipada); o teste de contrato passa a conferir todas as fixtures de parcelas.
- Validar: `npm test`: cada fixture tem as chaves do contrato (`ParcelasFinanciamento`, cabeçalho, totais e linha), **uma linha por mês** (o número de linhas é o prazo, com `numero` de 1 ao prazo) e o saldo final 0,00; as fixtures Price e SAC batem **exatamente** com o `/resultado` (`total_pago`, `total_juros`, `custo_total`, `valor_financiado`, primeira e última parcela; controle: uma fixture alterada é recusada); a fixture de centavos tem 71 linhas zeradas e a última de R$ 0,01, e a de quitação antecipada termina com uma linha zerada depois de o saldo já ser 0,00; a conferência das fixtures novas contra a resposta viva (mesmas chaves e tipos); a conta descartável termina com 0 simulações e nenhum dado pessoal nas fixtures.

**T2 · Claude · Handler das parcelas: atalhos**
- Arquivos: `src/mocks/handlers/parcelas.js`, `src/mocks/handlers/leituras.test.js`.
- O que muda: o handler passa a ser gerado a partir de uma fixture base, e entram atalhos de teste (`parcelasSemJuros()`, `parcelasDeUmMes()`, `parcelasDeCentavos()`, `parcelasQuitacaoAntecipada()`, `parcelasIndisponivel()`) e um `FIXTURES_DE_PARCELAS` exportado, no estilo dos atalhos do resultado.
- Validar: `npm test` com um bloco novo de literais reais: `401` sem token; `404 "Simulação não encontrada"` (inexistente, alheia, id `0`); `404 "Opção de financiamento não encontrada"` (inexistente, id `0` e **de outra simulação**); `404 "Recurso não encontrado"` para `abc` na simulação e na opção; a ordem 401 → simulação → opção (as duas inexistentes dão o 404 da simulação); `?foo=1` é ignorado (`200`); cada atalho devolve a fixture correspondente, mantém as regras de acesso e só vale dentro do teste que o liga (controle: sem atalho o comportamento volta ao normal); a suíte inteira verde.

### Bloco B — Dados

**T3 · Claude · `api/parcelas.js`**
- Arquivos: `src/api/parcelas.js`, `src/api/parcelas.test.js`.
- O que muda: `obterParcelas(simulacaoId, financiamentoId, { signal })` sobre o client (`GET /simulacoes/:id/financiamentos/:fid/parcelas`).
- Validar: `npm test` (ambiente `node`, MSW): devolve `{ financiamento, parcelas, totais }` exatamente como a fixture; `401` chama o `aoExpirar` (controle: os dois `404` não chamam); os dois `404` com as mensagens reais e a opção de **outra simulação** dando **a mesma** mensagem da inexistente; `503` e falha de rede sobem como `ErroApi` e `ErroRede`; o `signal` cancela sem virar erro de API.

**T4 · Claude · Cache das parcelas e invalidações**
- Arquivos: `src/hooks/chavesSimulacoes.js`, `src/hooks/useParcelas.js`, `src/hooks/useParcelas.test.jsx`, `src/hooks/useAtualizarFinanciamento.js`, `src/hooks/useExcluirFinanciamento.js`, `src/hooks/useAtualizarSimulacao.js`, `src/hooks/mutacoesFinanciamento.test.jsx`, `src/hooks/mutacoesSimulacao.test.jsx`, `src/hooks/useSimulacoes.test.jsx` (chaves).
- O que muda: as chaves `parcelas(id, fid)` = `['simulacoes', id, 'parcelas', fid]` e o prefixo `parcelas(id)`, o hook das parcelas de uma opção, e as invalidações: editar a **opção** invalida as parcelas dela, excluí-la as remove e editar a **simulação** invalida as de todas as opções (o veículo muda o valor financiado).
- Validar: `npm test` com o cache de produção: as parcelas ficam num cache **separado** da lista de opções e do resultado (uma mutação da lista não as refaz à toa); `404` não é repetido e `503` repete **uma** vez; sem ids não busca; cancela ao desmontar; editar a opção X invalida só as parcelas de X (controle: as de Y ficam), excluí-la as remove, editar a simulação invalida as de todas as opções **e só** da simulação certa (controle: a de outra simulação fica); uma edição que **falha** não invalida (controle); os hooks das Etapas 5 e 6 continuam invalidando o que invalidavam.

### Bloco C — Interface

**T5 · Claude · `ResumoFinanciamento`**
- Arquivos: `src/components/ResumoFinanciamento.jsx`, `src/components/ResumoFinanciamento.test.jsx`, `src/components/CartoesResumo.jsx` (só para reaproveitar o texto do custo total).
- O que muda: o bloco de resumo acima da tabela, com os dados da opção (sistema, taxa em **% a.m.**, prazo, valor financiado, entrada) e os três totais (total pago, total de juros, custo total) lado a lado, mais a frase que explica o custo total (a mesma do resultado, agora compartilhada).
- Validar: `npm test` com os valores das fixtures: cada dado aparece formatado exatamente como o número que a API traz (Price 48x: taxa "1,50% a.m.", "48 meses", "R$ 75.000,00"; totais "R$ 105.750,09", "R$ 30.750,09", "R$ 125.750,09"); SAC mostra "SAC"; taxa 0 mostra "0,00% a.m." e juros "R$ 0,00"; prazo 1 mostra "1 mês"; nome longo quebra a linha; a frase do custo total presente e **idêntica** à do resultado (os testes do `CartoesResumo` seguem verdes); nenhuma soma nem texto de cálculo.

**T6 · Claude · `TabelaAmortizacao`**
- Arquivos: `src/components/TabelaAmortizacao.jsx`, `src/components/TabelaAmortizacao.test.jsx`.
- O que muda: a tabela mês a mês num quadro de altura limitada (cerca de 60 % da tela) com **cabeçalho fixo** e rolagem horizontal no próprio quadro, com as colunas Mês, Parcela, Juros, Amortização e Saldo devedor, uma linha por mês **como vem**, valores à direita, legenda e `scope`, o quadro rolável focável por teclado, a nota de que o saldo é **depois** do pagamento e a nota das parcelas de R$ 0,00 só quando alguma linha vem zerada.
- Validar: `npm test` com as fixtures: Price 48x tem 48 linhas e SAC 36x, 36; o texto exato de cada valor (a primeira e a última linha de cada fixture, com literais como "R$ 2.203,12", "R$ 1.125,00", "R$ 1.078,12", "R$ 73.921,88" e a última "R$ 2.203,45" com saldo "R$ 0,00"); a fixture de centavos mostra 71 linhas "R$ 0,00" e a última "R$ 0,01", com a nota; a de quitação antecipada mostra a linha zerada final, com a nota; **controle: sem linha zerada (Price e SAC) a nota não aparece**; taxa 0 mostra "R$ 0,00" de juros em todas as linhas; prazo 1 uma linha; o quadro tem altura limitada, o cabeçalho é fixo (`position: sticky`) e o quadro tem `tabIndex` e nome acessível; a legenda e os `scope="col"` existem; nenhuma linha é somada nem calculada.

**T7 · Claude · `GraficoAmortizacao`**
- Arquivos: `src/components/GraficoAmortizacao.jsx`, `src/components/GraficoAmortizacao.test.jsx`, `src/utils/serieDaAmortizacao.js`, `src/utils/serieDaAmortizacao.test.js`.
- O que muda: o gráfico de barras empilhadas (Recharts), uma barra por mês com a **amortização** e os **juros** lidos das colunas da API (sem conta), acima da tabela, com cor e padrão diferentes nas fatias, legenda com as duas, tooltip em reais ("Mês 12"), eixo compacto, título, resumo em texto para leitor de tela (a primeira e a última parcela, lidas da tabela), sem animação e largura responsiva.
- Validar: `npm test` (o Recharts no jsdom recebe um tamanho fixo por `vi.mock`, e os testes verificam **dados, legenda e texto**, não pixels): a série tem uma barra por linha da API com os valores exatos de `juros` e `amortizacao` (controle: nenhum vira 0 nem é somado); Price e SAC (fixtures) geram as fatias certas na primeira e na última linha; com a fixture sem juros a fatia de juros é sempre 0,00 como vem; a legenda tem as duas entradas com a amostra de cor e padrão; a `figure` tem nome e o resumo cita a primeira e a última parcela ("Parcela do mês 1: R$ 2.203,12 ... mês 48: R$ 2.203,45"); prazo 1 e 72 barras funcionam; `npm run build` verde (o tamanho é registrado).

**T8 · Claude · Página `Amortizacao`**
- Arquivos: `src/pages/Amortizacao.jsx`, `src/pages/Amortizacao.test.jsx`, `src/App.test.jsx`, `src/pages/telas.test.jsx`, e `src/components/EmConstrucao.jsx` com o teste dele (removidos se ficarem sem uso).
- O que muda: a tela substitui o `EmConstrucao`: busca as parcelas, mostra o título "Amortização: *nome*", os links **Voltar ao resultado** e **Editar simulação**, o resumo com os totais, o gráfico e a tabela, e os estados carregando (esqueleto), erro (**Tentar de novo**) e `404` (o mesmo estado "Simulação não encontrada" para simulação inexistente ou alheia **e opção inexistente ou de outra simulação**).
- Validar: `npm test` (`renderizarComAuth` + MSW): esqueleto → título, resumo, gráfico e tabela com a fixture; com cada atalho (sem juros, 1 mês, centavos, quitação antecipada) o número de linhas e a nota certos; `503` mostra o erro com **Tentar de novo**, que carrega quando o servidor volta; falha de rede com a mensagem própria; `404` de simulação inexistente, de simulação **alheia**, de opção inexistente e de opção **de outra simulação** mostram **o mesmo** estado (mesmo texto na tela, sem nome nem número); `abc` no id também; `401` segue o fluxo da sessão (leva ao login); os links apontam para `/simulacoes/:id/resultado` e `/simulacoes/:id/editar`; `?foo=1` no endereço é ignorado; o `App.test` e o `telas.test` verdes (a rota deixa de ser provisória); `grep` confirma que nada mais usa o `EmConstrucao` antes de removê-lo; `npm run build` verde.

### Bloco D — Verificação e fechamento

**T9 · Claude · Verificação completa**
- Arquivos: nenhum (só leitura, salvo correções).
- O que muda: rodo tudo de ponta a ponta.
- Validar: `lint` com 0 avisos; `npm test` verde **três vezes seguidas** (para pegar instabilidade do gráfico e das corridas) com a contagem registrada; `npm run build` sem avisos novos e o tamanho do bundle (o Recharts já está no pacote, esperado perto dos 1.126 kB de hoje; se crescer mais de ~5 % registro o dado); `npm ls --all` sem problemas; `git diff HEAD -- package.json package-lock.json` vazio (nenhuma dependência nova);
  os **mesmos 5 ícones** (`Add`, `DeleteOutlined`, `EditOutlined`, `Visibility`, `VisibilityOff`); nenhum `console.log` nem dado de teste no `dist/`; `grep` confirma que só `api/api.js` chama `fetch` no código de produção e que os arquivos novos do `src/` (fora dos mocks e testes) **não têm aritmética sobre valores em reais** (nenhum `reduce`, soma, subtração, multiplicação ou divisão de valores da API).

**T10 · Claude · Verificação por linha de comando com o backend real**
- Arquivos: nenhum.
- O que muda: só verificação; subo o `dev` e uso uma **conta descartável nova** (senha aleatória, nunca impressa) que cria simulações com opções Price, SAC, sem juros, de 1 mês e de centavos e **apaga tudo** ao fim.
- Validar: as rotas `/simulacoes/1/financiamentos/1` (e com `?foo=1`) respondem `200` (fallback de SPA); o `/parcelas` vivo tem as **mesmas chaves e tipos** das fixtures da T1 (Price, SAC, sem juros, 1 mês, centavos e quitação antecipada); os **totais batem com o `/resultado`** da mesma opção em todos os casos; o número de linhas é o prazo e o saldo final é 0,00; com o código real de `serieDaAmortizacao.js` e `formatar.js`: a série do gráfico tem os valores exatos das colunas, a nota das parcelas de R$ 0,00 é decidida como esperado (verdadeira nos casos de centavos e de quitação antecipada; falsa em Price e SAC normais), os textos formatados dos valores reais (primeira e última parcela, totais) e o resumo acessível; os mesmos `404` do backend real para os cinco casos de acesso; editar a opção muda as parcelas seguintes; a conta termina com 0 simulações.

**T11 · Você · Verificação no navegador**
- Arquivos: nenhum.
- O que muda: com `npm run dev` (eu subo) e o backend no ar, você abre `http://localhost:5173`, entra e confere, com o console aberto (F12), numa simulação com uma opção **Price** e uma **SAC** (use a da Etapa 5 ou crie outra):
  1. **Abrir:** no resultado, **Ver parcelas** de cada opção abre a tela; o título é "Amortização: *nome*", o cabeçalho traz sistema, taxa em **% a.m.**, prazo, valor financiado e entrada, e o resumo traz os três totais e a frase do custo total.
  2. **Bate com o resultado:** os totais (total pago, juros e custo total) são **idênticos** aos do cartão do resultado, e a primeira e a última parcela da tabela coincidem com as do cartão.
  3. **Tabela:** uma linha por mês do prazo; o quadro tem altura limitada e **rola**, com o cabeçalho das colunas **fixo**; a última linha tem saldo devedor R$ 0,00; a nota diz que o saldo é depois do pagamento.
  4. **Price e SAC:** na Price as parcelas são iguais e a última difere por centavos, os juros diminuem e a amortização cresce; na SAC a amortização é constante e as parcelas diminuem.
  5. **Gráfico:** barras empilhadas (amortização e juros); passe o mouse (ou toque) para ver o tooltip em reais com o mês; na Price a fatia de juros encolhe e na SAC a da amortização é constante; legenda com as duas fatias e padrões diferentes além das cores.
  6. **Números:** compare 3 ou 4 valores (primeira e última linha, um total) com o **Swagger** (`/apidocs/`, `GET /simulacoes/{id}/financiamentos/{fid}/parcelas`, com *Authorize*): idênticos.
  7. **Casos extremos:** crie uma opção **sem juros** (juros "R$ 0,00" em todas as linhas), uma de **1 mês** (uma linha) e uma com **entrada de R$ 94.999,99** num veículo de R$ 95.000 em 72 meses (71 linhas de R$ 0,00 e a última de R$ 0,01, **com a nota** das parcelas zeradas).
  8. **Atualiza depois de mudar:** edite a taxa da opção (ou o valor do veículo da simulação) e volte a **Ver parcelas**: a tabela mostra os valores novos, sem recarregar a página.
  9. **Erros:** com a tela já aberta e o backend no ar, peça "pare o backend" e recarregue **só a tela de parcelas** depois de me pedir para religar e parar de novo (procedimento das Etapas 5 e 6): o erro tem **Tentar de novo**; abra `/simulacoes/999999/financiamentos/1`, `/simulacoes/{id}/financiamentos/999999` e `/simulacoes/abc/financiamentos/1`: o **mesmo** estado "Simulação não encontrada" nos três.
  10. **Links:** **Voltar ao resultado** e **Editar simulação** levam às telas certas.
  11. **Celular:** estreite a janela: o resumo empilha, o gráfico cabe na largura (barras finas, mas visíveis), e a tabela rola **na horizontal dentro do quadro** com o cabeçalho fixo.
  12. **Teclado:** com Tab o quadro da tabela recebe foco e rola com as setas.
- Validar: você me diz o resultado de cada item; qualquer falha vira correção antes da T12.

**T12 · Claude · Registrar a conclusão da etapa**
- Arquivos: `CLAUDE.md`, `plano.md` (Etapa 7), esta spec.
- O que muda: `CLAUDE.md` (estrutura com `api/parcelas.js`, hooks, componentes, `utils/serieDaAmortizacao.js`, sem o `EmConstrucao` se foi removido; contrato real das parcelas com a tabela de casos, os totais iguais aos do `/resultado`, as parcelas 0,00 e a quitação antecipada, o `?foo=1` ignorado; comportamento da tela e o cache; lições de teste; contagem de testes e tamanho do bundle; resíduos); `plano.md` marca a Etapa 7 como concluída com notas (nomes finais, decisões e desvios); a spec passa a "Concluída" com os critérios marcados e o registro da execução.
- Validar: releitura dos três arquivos; `git status --ignored --short` e `git check-ignore -v` nas pastas com arquivos novos confirmam que **nada** foi ignorado por engano e que nada proibido (`node_modules/`, `dist/`, `.env`, `CLAUDE.md`, `api/`) é publicável.

**T13 · Você · Commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica. Sugestão: `git add .`, `git status`, `git commit` e `git push` (inclui a última linha da spec da Etapa 6, ainda não commitada).
- Validar: `git status` limpo; push sem erro.

### Bloco E — Publicação

**T14 · Claude · Confirmar a publicação, do zero**
- Arquivos: nenhum.
- O que muda: só verificação; clono o repositório público numa pasta limpa (a pasta temporária é apagada ao fim).
- Validar: o número de arquivos rastreados no GitHub bate com o do disco; `npm ci`, `npm ls`, `lint` (0 avisos), `npm test` e `npm run build` verdes no clone; a listagem do GitHub tem `src/api/parcelas.js`, `src/pages/Amortizacao.jsx`, `src/components/TabelaAmortizacao.jsx` e as fixtures novas, e não tem `node_modules`, `dist`, `.env`, `CLAUDE.md`, `api` nem `.claude`.

### Mapa dos critérios de aceite
| Critério | Tarefas |
|---|---|
| `lint`, `test` e `build` verdes; nenhuma dependência nova e nenhum ícone novo | T9, T14 |
| Ver parcelas abre Price e SAC, com cabeçalho, uma linha por mês e saldo final 0,00, como o Swagger | T5, T6, T8, T10, T11 |
| Totais idênticos aos do `/resultado` e primeira e última parcela coincidindo com as do cartão | T1, T5, T10, T11 |
| Price com última parcela diferente e SAC decrescente, exatamente como a API traz | T6, T11 |
| Casos extremos: taxa 0, prazo 1 e parcelas 0,00 com a nota | T1, T2, T6, T10, T11 |
| Rolagem horizontal no celular, cabeçalho fixo e uso em largura de celular | T6, T11 |
| Carregando, erro com **Tentar de novo** e `404` igual para simulação e opção inexistentes ou alheias | T2, T3, T8, T10, T11 |
| Tabela atualizada depois de editar a opção ou o veículo; excluir a opção remove o cache | T4, T11 |
| Mocks iguais ao backend real (fixtures e atalhos) e teste de contrato com as chaves e os totais | T1, T2, T10 |
| Nomes, `console.log`, nenhum cálculo financeiro e nenhuma API externa | T9 |
| `CLAUDE.md` e `plano.md` atualizados | T12 |

### Riscos
- **Cabeçalho fixo dentro de um quadro com rolagem horizontal:** o `position: sticky` só funciona se o quadro for o contêiner de rolagem; a T6 verifica a estrutura e os estilos, e a conferência visual (inclusive no celular) fica na T11, pois o jsdom não faz layout.
- **Foco por teclado no quadro:** uma região rolável precisa de `tabIndex`, papel e nome acessível para ser usada sem mouse; a T6 testa e a T11 confere com o Tab e as setas.
- **Barras finas com 72 linhas no celular:** o gráfico usa largura responsiva e nenhuma rolagem; se as barras ficarem ilegíveis a conferência da T11 acusa e o ajuste (espaçamento entre barras, altura) é feito antes do fechamento.
- **Recharts no jsdom:** o `ResponsiveContainer` recebe um tamanho fixo por `vi.mock`, como na Etapa 6, e os testes verificam dados, legenda e texto, não pixels.
- **Cache com prefixo próprio:** as parcelas ficam em `['simulacoes', id, 'parcelas', fid]`, separadas da lista de opções (`['simulacoes', id, 'financiamentos']`) para uma mutação da lista não refazê-las; a T4 prova o isolamento e as três invalidações (opção, exclusão e simulação).
- **Mesma tela para quatro `404`:** simulação e opção, inexistentes ou alheias, precisam dar o **mesmo** texto sem vazar nada (nem o nome); a T8 compara o conteúdo da tela nos quatro casos.
- **A nota das parcelas zeradas:** decidida por uma comparação (`valor_parcela === 0`) e não por um cálculo; a T6 prova com controle (sem linha zerada, sem nota) e a T9 confere que não há aritmética.
- **Remoção do `EmConstrucao`:** só depois de um `grep` confirmar que ninguém mais o usa (a T8), incluindo os testes.
- **Tamanho:** 14 tarefas; a T6 (tabela) e a T8 (página) são as maiores. Se preferir, executo por bloco e paro para a sua revisão ao fim de cada um.

### Registro da execução (2026-09-27)
- **Resultado:** 1517 testes em 66 arquivos (estáveis em 3 execuções seguidas), `lint` sem avisos, `build` de **1.162 kB** (354 kB gzip; era 1.126 kB: +3,2 %, abaixo dos 5 % que o plano fixou para registrar); os mesmos 5 ícones; nenhuma dependência nova; só `api/api.js` chama `fetch`; nenhuma aritmética sobre valores em reais nos arquivos novos; `dist/` sem `msw` nem `mockServiceWorker.js`; o `EmConstrucao` foi removido depois de um `grep` confirmar que ninguém mais o usava.
- **Desvios do plano:** (1) o teste de contrato compara as fixtures Price e SAC com o `/resultado` por uma função de comparação com controle (uma fixture alterada é recusada); (2) o `ResumoFinanciamento` importa a frase do custo total de `CartoesResumo` (`TEXTO_DO_CUSTO_TOTAL`), em vez de duplicá-la; (3) o quadro rolável da tabela ganhou o nome próprio "Tabela de amortização, com rolagem", pois a seção e o quadro com o mesmo nome viravam duas regiões iguais; (4) o Recharts não desenha as fatias de altura zero, então a contagem de barras dos testes é a dos valores não zerados da API; (5) `useAtualizarFinanciamento`, `useExcluirFinanciamento` e `useAtualizarSimulacao` foram alterados, como a spec previa; (6) os atalhos `parcelas*` mantêm as regras de acesso do handler padrão, como os do resultado.
- **Bugs achados pelos testes:** só fragilidades de teste: `getAllByRole` com regex, o `<span>` de medição do Recharts no `body`, `toHaveStyle` com `vh` no jsdom, e duas regiões com o mesmo nome. Prova de sensibilidade: removidas de propósito a invalidação das parcelas em cada um dos três hooks, a condição da nota das parcelas zeradas (sempre ligada), o `stickyHeader`, o `stackId`, o padrão listrado e a unificação do 404 (o da opção diferente do da simulação), os testes correspondentes falharam em todos e o código voltou ao original.
- **Verificação automática com o backend real (T10):** 45 checagens com uma conta descartável: nos 6 casos (Price 48x, SAC 36x, sem juros 72x, 1 mês, centavos e quitação antecipada) as chaves e os tipos, as linhas e os totais são **idênticos** aos das fixtures; uma linha por mês e saldo final 0,00; totais, valor financiado, primeira e última parcela iguais aos do `/resultado`; o gráfico com os valores exatos; a nota das parcelas zeradas só nos casos de centavos e de quitação antecipada; os 404 reais (simulação, opção, opção de outra simulação e `abc`) e o `?foo=1` ignorado; editar a opção muda as parcelas e editar o veículo muda o valor financiado (100.000 − 20.000 = 80.000); a conta terminou com 0 simulações.
- **Verificação no navegador (T11, pelo autor):** os 12 itens funcionaram (abrir, totais iguais aos do resultado, tabela com cabeçalho fixo, Price e SAC, gráfico, números iguais aos do Swagger, casos extremos, atualização depois de mudar, erros e os três 404 iguais, links, celular e teclado).
- **Resíduos:** quatro contas descartáveis (duas da exploração da spec, a captura das fixtures `mock-...` e a da T10), todas com 0 simulações ao fim; a primeira execução do segundo script da exploração falhou por um nome de 1 caractere (o backend exige 2 ou mais) e foi refeita. O backend não exclui usuários. As senhas aleatórias nunca foram impressas nem gravadas.
- **Publicação (T13 e T14):** commit `cfb9729`. O GitHub tem os 198 arquivos rastreados (os mesmos do disco), com `src/api/parcelas.js`, `src/pages/Amortizacao.jsx`, `src/components/TabelaAmortizacao.jsx`, `src/components/GraficoAmortizacao.jsx`, as fixtures novas e esta spec, sem o `EmConstrucao.jsx` e sem `node_modules`, `dist`, `api`, `.claude`, `CLAUDE.md`, `.env` nem `requisitos front-end.md`. **Verificação do zero:** clone do repositório público numa pasta limpa, com `npm ci`, `npm ls`, `lint` (0 avisos), `test` (1517 em 66 arquivos) e `build` (1.162 kB) verdes; `dist/` sem `msw` nem `mockServiceWorker.js`.
