# Tela de resultado: cartões e gráfico comparativo (Etapa 6) — Spec

**Criado em:** 2026-09-27
**Status:** Concluída em 2026-09-27 (decisões 1 a 5 resolvidas na mesma data; plano executado, T1 a T17)
**Etapa do plano:** 6 (`plano.md`) · **Requisito:** R4 (criatividade e inovação: visualizações, destaque do melhor cenário, simulação "e se eu guardar X por mês?")

## Problema
O produto existe para responder "como comprar este carro?", e a resposta está no `GET /api/simulacoes/:id/resultado`: o custo do carro à vista, em cada opção de financiamento e guardando dinheiro num fundo. Hoje o botão
**Ver resultado** (histórico e edição) leva a uma tela provisória ("Tela em construção"). Sem esta tela, o cadastro das Etapas 3 a 5 não produz nenhuma comparação visível.

## Objetivo
Mostrar os três cenários lado a lado, com o **menor custo destacado** e a explicação do que o número significa, os detalhes de cada financiamento e do fundo, e um **gráfico de linhas** que compara, mês a mês, o saldo devedor de cada
financiamento, o saldo do fundo e o preço do carro corrigido pelo IPCA. Permitir a pergunta "e se eu guardar X por mês?" (`?aporte_mensal=`). O frontend **não recalcula nada**: só exibe (e formata) o que a API devolve.

## Fora de escopo
- Qualquer cálculo financeiro no cliente (parcela, juros, totais, "menor custo", séries): tudo vem do `/resultado`. A tela só formata e compara valores para **exibir** (ex.: destacar o cartão que o backend indicou em `menor_custo`).
- A tabela de amortização mês a mês (**Etapa 7**): esta etapa só liga o cartão de cada financiamento à rota que a Etapa 7 preenche, conforme a decisão 5.
- Editar simulação ou opções dentro desta tela (o link **Editar simulação** leva à edição da Etapa 3 e 5).
- Exportação por impressão (**Etapa 9**, opcional) e o polimento de erros e responsividade de todo o app (**Etapa 8**); aqui só o necessário para a tela funcionar bem no celular.
- Valor presente, CET ou qualquer outra métrica (o backend compara em valores **nominais**, sem paginação, filtros nem CET, por decisão do autor).
- Alterações no repositório do backend.

## Proposta

### O que foi verificado (estado atual)
| Item | Situação |
|---|---|
| Tela | `pages/Resultado.jsx` é o `EmConstrucao`; a rota `/simulacoes/:id/resultado` já existe (protegida) e o histórico e a edição já ligam a ela (**Ver resultado**) |
| Mocks | `handlers/resultado.js` devolve **sempre** a fixture da simulação 1 (2 opções: Price 48x e SAC 36x), com `?aporte_mensal=`: `resultado-aporte.json` (≥ 1.500, meta no mês 44) ou `resultado-aporte-insuficiente.json` (não alcança). **Faltam** cenários de 0 opções, de 3 opções com prazos diferentes e de o **fundo** vencer, e há 3 mensagens de 422 diferentes do backend real (ver "Desvios dos mocks") |
| Cache | a chave `chavesSimulacoes.resultado(id)` já existe (Etapa 5) e é **invalidada** ao criar, editar ou excluir uma opção; **falta** invalidá-la também quando a **simulação** é editada (`useAtualizarSimulacao`), pois o resultado depende dos valores dela |
| Reaproveitável | `formatarMoeda`, `formatarPercentual`, `numeroParaCampo`, `lerNumero`, `campoNumerico` (esquema Zod), `EstadoErro`, `EsqueletoLista`, `useAviso`, o estado "simulação não encontrada" da edição (`SimulacaoNaoEncontrada`), o padrão de cartões e o tema do MUI |
| Dependências | **Recharts 3.10** já instalado e ainda **sem uso**; nenhuma dependência nova. Ícones: os mesmos 5 (a tela não precisa de ícone novo) |
| Backend | no ar; contrato conferido abaixo com uma conta descartável nova (mais de 50 chamadas, cobrindo 0, 1 e 3 opções, prazos de 1 a 72 meses, IPCA de −20 a 100, o modo aporte e os erros) |

### Contrato real observado (backend, 2026-09-27)
`GET /api/simulacoes/:id/resultado[?aporte_mensal=X]` (JWT; só leitura; calculado a cada requisição, nada gravado). `200` com `{ simulacao, cenarios, menor_custo, series }`, tudo número JSON (nunca texto):

- **`simulacao`** (eco): `id, nome, prazo_meses_fundo, taxa_fundo_rendimento, taxa_ipca_projetada, valor_entrada, valor_veiculo` (**sem** `criado_em`).
- **`cenarios.a_vista`**: `{ custo_total }` (= valor do veículo).
- **`cenarios.financiamentos`** (0 a 3, **ordem de criação**): `id, nome, sistema_amortizacao` (`PRICE`/`SAC`), `prazo_meses, valor_financiado, valor_entrada` (a da **opção**), `primeira_parcela, ultima_parcela, total_pago, total_juros, custo_total`.
  `custo_total = valor_entrada + total_pago` (ex.: 20.000 + 105.750,09 = 125.750,09); `valor_financiado` = veículo − entrada da opção. Numa opção **Price** a última parcela pode diferir da primeira por **centavos** (ex.: 1.319,44 e 1.319,76 em 72x sem juros); na **SAC** a primeira é sempre maior (parcelas decrescentes).
- **`cenarios.fundo`**: `capital_inicial` (= `valor_entrada` da **simulação**), `aporte_mensal, prazo_meses` (meses **simulados**), `mes_da_meta, alcanca_a_meta, preco_na_compra, total_aportado, rendimento, saldo_final, custo_total`.
  Modo padrão: o aporte é calculado para atingir o preço em `prazo_meses_fundo` (`alcanca_a_meta: true`, `mes_da_meta` = o prazo). Com a entrada igual ao veículo o `aporte_mensal` vem **0**.
- **`menor_custo`** = `{ cenario, id }`: `cenario` é `"a_vista"` ou `"fundo"` (com juros ≥ 0 o financiamento **nunca** é o mais barato) e `id` é `null` nos dois. **Empate → à vista** (financiamento sem juros e sem entrada dá 95.000, igual ao à vista: vence o à vista). O **fundo** vence, por exemplo, com IPCA de −20 % (custo 48.640 contra 95.000).
  O formato geral prevê também `"financiamento"` com o `id` da opção; a tela trata os três casos.
- **`series`**: um ponto por mês, `{ mes, preco_corrigido, saldo_fundo, saldo_devedor: { "<id da opção>": valor } }`, num **eixo comum** do mês 0 ao maior prazo (o das opções ou o do fundo): com opções de 48, 36 e 72 meses a série tem **73** pontos; com 0 opções e fundo de 36 meses, 37; com fundo de 60, 61. `preco_corrigido` existe em todo o eixo. Onde uma série **terminou** o valor é `null`: `saldo_fundo` depois de `prazo_meses` do fundo, e `saldo_devedor` **depois** do último mês da opção (no último mês da opção o saldo é `0`; no mês 0 vale o valor financiado). As chaves de `saldo_devedor` são o `id` da opção **como texto**; sem opções o objeto vem **vazio** (`{}`).
- **Tamanho e tempo:** 0 opções ≈ 5 kB, 1 opção ≈ 6,6 kB, 3 opções com 72 meses ≈ 16 kB, fundo de 60 meses ≈ 8 kB; 5 a 20 ms.

**Modo `?aporte_mensal=X`** (0 a 9.999.999,00, 2 casas; aceita ponto decimal, nunca vírgula): o aporte informado **substitui** o calculado e o `prazo_meses_fundo` deixa de valer.
| Aporte | Resposta |
|---|---|
| `1500` e `1500.50` | `200`: `alcanca_a_meta: true`, `mes_da_meta: 44`, `prazo_meses: 44` (mês da meta), `preco_na_compra` e `custo_total` preenchidos |
| `100` e `0` | `200`: `alcanca_a_meta: false`, `mes_da_meta: null`, **`prazo_meses: 60`**, `preco_na_compra: null`, **`custo_total: null`** (fora do `menor_custo`), demais valores do mês 60 (com 100: saldo final 43.280,96, rendimento 17.280,96) |
| `9999999` | `200`, meta no mês 1 |
| `1e3` | `200`, vale 1000 (notação científica é lida; a SPA nunca a envia) |
| `9999999.01` e `-1` | `422 "O aporte mensal deve estar entre 0,00 e 9.999.999,00."` |
| 3 casas (`1500.505`) | `422 "Use no máximo 2 casas decimais."` |
| `abc`, vazio, só espaços e `1500,5` (vírgula) | `422 "Número inválido."` |
| repetido | `422 "Informe o parâmetro uma única vez."` |
| parâmetro desconhecido (`foo=1`, `aporte=1500`) | `422 "Campo desconhecido."` (a chave é o nome do parâmetro) |
Erros de acesso: sem token → `401` (`WWW-Authenticate: Bearer`); simulação inexistente, de outra pessoa ou id `0` → `404 "Simulação não encontrada"`; id não numérico → `404 "Recurso não encontrado"`. Ordem: **401 → 404 → 422** (um aporte inválido numa simulação que não existe dá 404). Só `GET` (`POST` no caminho → `405`).
O `/parcelas` de cada opção também responde (`financiamento`, `parcelas`, `totais`), para a Etapa 7.

### Desvios dos mocks a corrigir nesta etapa
1. **Mensagens de 422 do aporte** (3 casos): o mock diz `"Parâmetro desconhecido."` (real: `"Campo desconhecido."`), `"O parâmetro não pode ser vazio."` para vazio e só espaços (real: `"Número inválido."`) e `"Deve estar entre 0 e 9999999."` para a faixa (real: `"O aporte mensal deve estar entre 0,00 e 9.999.999,00."`). As demais (casas, número inválido, repetido) já são iguais.
2. **Cenários que os mocks não têm:** o handler devolve sempre a fixture de 2 opções. Passam a existir fixtures **capturadas do backend real** (ids normalizados, como as anteriores) e **atalhos** de teste (`servidor.use(...)`, como os dos índices): sem opções, três opções com prazos diferentes (48, 36 e 72) e o **fundo vence** (IPCA negativo); mais o aporte informado com meta no primeiro mês, se útil. As fixtures existentes seguem como estão.
O teste dos mocks passa a usar os literais reais desta spec como referência (não os handlers).

### Estrutura criada e alterada
```
src/
  api/resultado.js                # obterResultado(simulacaoId, { aporteMensal, signal }) sobre o client (o aporte vai como número, com ponto)
  hooks/chavesSimulacoes.js       # resultado(id) vira o prefixo; a variante com aporte = [...resultado(id), aporte]
  hooks/useResultado.js           # a consulta do resultado (staleTime padrão; sem repetição em 4xx)
  hooks/useAtualizarSimulacao.js  # passa a invalidar também o resultado da simulação editada
  components/
    CartaoCenario.jsx             # um cartão (à vista, financiamento ou fundo): título, custo total, destaque "Menor custo" e detalhes
    CartoesResumo.jsx             # a linha de cartões, o texto que explica o "custo total" e o convite quando não há opções
    ControleAporte.jsx            # o campo "e se eu guardar X por mês?" e o botão para voltar ao valor calculado (decisão 2)
    GraficoComparativo.jsx        # o gráfico de linhas (Recharts) e o resumo acessível (decisão 3)
    SimulacaoNaoEncontrada.jsx    # tirado de pages/SimulacaoForm.jsx para servir à edição e ao resultado
  pages/Resultado.jsx             # a tela (substitui o EmConstrucao)
  utils/formatar.js               # rótulo do mês ("mês 44"), valor compacto para o eixo do gráfico ("R$ 100 mil")
  mocks/                          # fixtures novas, atalhos e as mensagens do aporte
```
Os nomes previstos no `plano.md` (`CartaoCenario`, `CartoesResumo`, `GraficoComparativo`, `DadosDaSimulacao`, `ControleAporte`) são mantidos, exceto `DadosDaSimulacao`, que vira um cabeçalho simples dentro de `Resultado.jsx` (nome, valor do veículo, entrada e taxas, todos do eco `simulacao`).

### Comportamento
- **Busca:** `GET /simulacoes/:id/resultado` ao abrir a tela (o `id` da rota), com esqueleto enquanto carrega. O resultado **não** é copiado para estado local (fica no cache do React Query) e nada é calculado: o título e o cabeçalho usam o eco `simulacao`.
- **Cabeçalho:** "Resultado" com o nome da simulação; abaixo, valor do veículo, entrada e as taxas (rendimento do fundo e IPCA projetado, **% a.a.**) e o prazo do fundo; links **Editar simulação** e **Voltar ao histórico**.
- **Cartões-resumo:** um por cenário, na ordem à vista, financiamentos (ordem de criação) e fundo, cada um com o **custo total** em destaque. O cartão indicado por `menor_custo` recebe o **destaque** (etiqueta em texto "Menor custo", que não depende só de cor, e borda), casando por `cenario` e, para financiamento, também por `id`; o empate (à vista) e a ausência de vencedor no modo aporte já vêm do backend.
- **O que é "custo total":** uma frase **sempre visível** acima dos cartões (sem dica ao passar o mouse); o destaque do menor custo é a etiqueta escrita **"Menor custo"** mais uma borda mais forte: é o que se **paga pelo carro**, em valores nominais, **sem** valor presente: à vista = o valor do veículo; financiamento = entrada da opção + soma das parcelas; fundo = o **preço do carro corrigido pelo IPCA na data da compra** (não o dinheiro que sai do bolso).
- **Detalhes:** dentro de cada cartão e **sempre visíveis** (linhas rótulo/valor abaixo do custo total): financiamento (sistema, prazo, valor financiado, entrada, primeira e última parcela, total pago, total de juros) e fundo (capital inicial, aporte mensal, prazo, mês da meta, preço na compra, total aportado, rendimento e saldo final). Cada cartão de financiamento tem o link **Ver parcelas** para `/simulacoes/:id/financiamentos/:fid` (a rota existe e mostra "Tela em construção" até a Etapa 7).
- **Última parcela:** numa opção Price em que a última parcela difere da primeira, a tela mostra as duas e explica em uma frase que a última absorve o arredondamento de centavos; SAC mostra "parcelas decrescentes". Só se **exibe** o que a API devolve (a comparação serve para escolher o texto).
- **Sem opções (0):** o resultado mostra à vista e fundo, e um convite ("Adicione opções de financiamento para compará-las") com o link para a edição; o gráfico só tem o fundo e o preço corrigido.
- **Modo aporte:** o campo "E se eu guardar (R$ por mês)?", com o botão **Simular**, fica **dentro do cartão do fundo**. Ao simular, o valor vai para o endereço da página (`?aporte_mensal=1500,5`: formato de campo pt-BR, sem separador de milhar, lido com `lerNumero`), de modo que recarregar, o Voltar do navegador e copiar o link mantêm (ou desfazem) o cenário; o botão **Voltar ao valor calculado** tira o parâmetro do endereço. Um valor inválido no endereço (`1500.5`, texto, fora da faixa) vira **aviso no campo** e o resultado padrão é mostrado: **nunca** vai ao servidor. Com um aporte informado, o cartão do fundo mostra o aporte usado e "alcança a meta no mês N" **ou** "não alcança a meta em 60 meses" (`alcanca_a_meta: false`); nesse caso `preco_na_compra` e `custo_total` do fundo vêm `null` e aparecem como "—" com uma frase ("sem custo total: o fundo não alcança o preço em 60 meses"), e o fundo fica fora do destaque (o `menor_custo` já vem sem ele). Um `422` do parâmetro aparece **junto ao campo** do aporte; o cliente valida antes (0 a 9.999.999,00, 2 casas, vírgula decimal) e envia o número.
- **Gráfico:** um **único** gráfico com todas as séries, na mesma escala em reais; a **legenda é clicável** (oculta e mostra cada linha; a linha oculta continua na legenda, riscada e com o estado anunciado). Recharts, eixo comum de meses (0 ao maior prazo); séries: saldo devedor de cada financiamento (chave = `id` como texto; o nome vem do cartão), saldo do fundo e preço corrigido. `null` **não liga lacunas** (`connectNulls={false}`), então a linha termina onde a série acabou. Legenda, tooltip formatado em reais ("Mês 36"), eixos com valor compacto, cores distinguíveis **e** estilos de traço diferentes (não só cor), título e resumo acessível (`aria`), altura fixa e largura responsiva; sem rolagem horizontal no celular.
- **Estados:** carregando (esqueleto), erro (rede/5xx: mensagem clara e **Tentar de novo**), `404` (mesmo estado de "Simulação não encontrada" da edição, com o link ao histórico; simulação de outra pessoa dá o mesmo).
- **Cache:** `['simulacoes', id, 'resultado']` (padrão) e `[..., 'resultado', aporte]` (modo aporte), com o `staleTime` de 30 s; criar, editar ou excluir **opção** e **editar a simulação** invalidam o prefixo (o resultado abre atualizado na próxima visita); excluir a simulação já o remove. Trocar o aporte não apaga o resultado padrão (voltar ao valor calculado não faz nova chamada dentro dos 30 s).
- **Sessão:** um `401` segue o fluxo da Etapa 2.
- **Acessibilidade:** o destaque é texto, não só cor; o gráfico tem alternativa em texto; o campo do aporte tem rótulo e erro associados; a ordem de leitura é cartões, detalhes, gráfico.

### Mocks e testes
- **Mocks:** as fixtures novas (capturadas do backend real), os atalhos, as três mensagens do aporte e um teste com os literais reais (a tabela do aporte, a ordem 401 → 404 → 422 e o `null` do fundo).
- `api/resultado` (ambiente `node`): a chamada com e sem aporte (o parâmetro vai com **ponto** decimal e só quando informado), `401` (controle: `404` e `422` não avisam a sessão), `404` da simulação, `422` com a mensagem real.
- `useResultado` e as chaves: cache (padrão e com aporte separados, sem novo `GET` ao voltar dentro de 30 s), `404` sem repetição, `503` uma vez, e a invalidação por criar/editar/excluir opção **e** por editar a simulação.
- Componentes e tela (MSW): destaque no cartão certo (à vista, fundo e, com fixture própria, financiamento), o empate, o texto do "custo total", os detalhes de cada financiamento (Price com última parcela diferente, SAC), 0 opções com o convite, o modo aporte (alcança, não alcança com `null` mostrado como "—", 422 no campo, voltar ao valor calculado), o gráfico (uma linha por série, `null` sem ligar, resumo acessível), e os estados de carregando, erro com "Tentar de novo" e `404`.
  Cada teste de comportamento tem um controle (a versão sem o comportamento). O Recharts no jsdom precisa de `ResizeObserver` e tamanho: os testes do gráfico verificam os dados que chegam às linhas e o texto acessível, não pixels.

### Casos de borda
- **`saldo_devedor` vazio** (0 opções): o gráfico não desenha linhas de dívida e a legenda só lista fundo e preço corrigido.
- **Séries de comprimentos diferentes:** o eixo vai até o maior prazo; o fundo termina no mês da meta (ou 60) e cada opção no seu mês, sem completar com zero.
- **Aporte 0** (ou entrada igual ao veículo, em que o aporte calculado é 0): o texto do fundo continua correto ("R$ 0,00 por mês"); com aporte informado 0 o fundo não alcança a meta.
- **Valores grandes** (veículo de 9.999.999 ou IPCA de 100 %, custo do fundo de milhões): o eixo compacto e o cartão formatam sem quebrar o layout.
- **Financiamento com entrada quase igual ao veículo** (valor financiado de R$ 0,01): mostra os números como vêm.
- **Nome de opção longo** (até 120 caracteres): quebra a linha no cartão e na legenda.
- **Resultado desatualizado depois de uma mudança em outra aba:** o cache de 30 s pode mostrar o resultado anterior; a próxima abertura da tela ou o **Tentar de novo** refaz (o backend calcula a cada requisição).
- **Aporte digitado com vírgula** (`1.500,50`): o cliente lê pt-BR e envia `1500.5`; o backend nunca recebe vírgula.
- **Simulação com id de outra pessoa ou apagada:** o mesmo `404` "Simulação não encontrada", sem vazar existência.

### Resíduos no banco de desenvolvimento do backend
A exploração desta spec usou uma **décima conta descartável** (`sonda-<aleatório>@example.com`; senha aleatória já descartada, nunca impressa). Criou várias simulações para provar os casos e **apagou todas** ao fim (a conta terminou com 0 simulações). O backend não exclui usuários; sem impacto para o app.

## Decisões em aberto
Resolvidas em 2026-09-27 (decisões do autor):
1. ~~Como mostrar os detalhes de cada cenário~~ **Dentro do cartão, sempre visíveis:** o custo total grande no topo e, abaixo, linhas rótulo/valor (financiamento: sistema, prazo, valor financiado, entrada, primeira e última parcela, total pago, juros; fundo: capital inicial, aporte, prazo, mês da meta, preço na compra, total aportado, rendimento, saldo final).
   Nada escondido em "Ver detalhes" nem numa tabela separada; lado a lado no computador, empilhados no celular, no mesmo desenho dos cartões do histórico e das opções.
2. ~~Como funciona o "e se eu guardar X por mês?"~~ **Campo no cartão do fundo, com o valor no endereço da página:** campo "E se eu guardar (R$ por mês)?" com **Simular**, `?aporte_mensal=1500,5` (pt-BR, sem milhar), **Voltar ao valor calculado** que tira o parâmetro (sem nova chamada dentro dos 30 s de cache) e o Voltar do navegador que desfaz.
   Um valor inválido no endereço vira aviso no campo, com o resultado padrão, e nunca chama o servidor. Sem faixa acima dos cartões e sem controle deslizante.
3. ~~Como é o gráfico~~ **Um único gráfico com todas as séries e legenda clicável:** saldo devedor de cada financiamento, saldo do fundo e preço corrigido, na mesma escala em reais, e a legenda oculta e mostra cada linha (cores diferentes **e** estilos de traço diferentes). Sem dois gráficos e sem legenda só informativa.
4. ~~Como explicar o "custo total" e destacar o menor custo~~ **Texto fixo na tela + etiqueta e borda:** uma frase sempre visível acima dos cartões (é o que se **paga pelo carro**, em valores nominais; no fundo, o preço corrigido pelo IPCA na compra, não o dinheiro que sai do bolso) e o cartão de menor custo com a etiqueta escrita "Menor custo" e uma borda mais forte, que não dependem só de cor. Sem tooltip e sem ícone de ajuda.
5. ~~Link do cartão de financiamento para a amortização~~ **Incluir já, com o texto "Ver parcelas":** o link aponta para `/simulacoes/:id/financiamentos/:fid` (a rota já existe e mostra "Tela em construção" até a Etapa 7 substituí-la), sem ícone novo.

Sem decisões em aberto: a spec está pronta para o `/plan`.

## Critérios de aceite
- [x] `npm run lint` (0 avisos), `npm test` e `npm run build` verdes; nenhuma dependência nova e nenhum ícone novo.
- [x] **No navegador, contra o backend real:** a tela mostra os três cenários com o custo total, o **menor custo** destacado no cartão indicado pelo backend e a explicação do que o número significa; os números coincidem com os do Swagger do backend (nada recalculado).
- [x] Cada financiamento mostra sistema, prazo, valor financiado, entrada, primeira e última parcela, total pago e juros; o fundo mostra aporte, mês da meta, preço na compra, total aportado, rendimento e saldo final; numa Price com última parcela diferente há a explicação em uma frase.
- [x] O gráfico mostra o saldo devedor de cada financiamento, o saldo do fundo e o preço corrigido, num eixo comum, **sem ligar as lacunas** (`null`), com legenda, tooltip em reais, título e alternativa em texto; é legível em largura de celular.
- [x] O modo "e se eu guardar X por mês?" funciona: com um aporte que alcança a meta mostra o mês da meta; com um que não alcança mostra "não alcança a meta em 60 meses", com o custo total do fundo como "—" e o fundo fora do destaque; um `422` aparece junto ao campo e dá para voltar ao valor calculado.
- [x] Simulação **sem opções** mostra à vista e fundo com o convite para adicionar opções; com o **fundo vencendo** (IPCA negativo) o destaque vai para o fundo.
- [x] Depois de criar, editar ou excluir uma opção, ou de editar a simulação, o resultado abre **atualizado**.
- [x] Carregando (esqueleto), erro com **Tentar de novo** e `404` (simulação de outra pessoa ou apagada) estão implementados e testados.
- [x] Os mocks refletem o backend real (3 mensagens do aporte corrigidas, fixtures novas) e o teste de contrato confere os literais.
- [x] Nomes em `PascalCase.jsx`/`camelCase.js`; nenhum `console.log`; nenhum cálculo financeiro no `src/` (fora dos mocks e testes) e nenhuma chamada a API externa.
- [x] O `CLAUDE.md` é atualizado (estrutura, contrato do resultado, contagem de testes) e o `plano.md` marca a Etapa 6.

## Plano de Implementação

**Status:** executado (T1 a T17) · **Criado em:** 2026-09-27

São 19 tarefas pequenas, em cinco blocos. Cada uma indica **quem executa** (**Claude** ou **Você**), os arquivos, o que muda e como validar. O código de cada módulo nasce **junto com os seus testes** (`*.test.js(x)` ao lado). Regras para todo o plano:
- O Claude **não** roda `git add`, `commit` nem `push` (os commits são seus).
- Ao fim de cada tarefa que altera código: `npm run lint` (0 avisos) e `npm test` verdes.
- Cada teste de comportamento tem um **controle** (a versão que não deve disparar) que prova que ele pode falhar; os testes de guarda (destaque só no cartão indicado, `null` sem ligar lacunas, aporte inválido nunca vai ao servidor) são provados também **removendo a checagem do código por um instante**, como nas Etapas 4 e 5.
- **Mensagens e números:** a referência são os literais da seção "Contrato real observado" desta spec e as **fixtures capturadas do backend real**, nunca o próprio componente ou handler testado; **nenhum teste calcula** resultado financeiro (os testes conferem que o texto na tela é a formatação do número que a fixture traz).
- Testes de corrida usam uma **comporta** controlada pelo teste (nunca `delay` por tempo).
- **Nenhum cálculo financeiro no cliente:** nada de somar, subtrair, multiplicar ou dividir valores em reais; a tela só formata, escolhe qual cartão destacar por `menor_custo` e escolhe o texto da última parcela comparando `primeira_parcela` com `ultima_parcela` (a T15 procura por aritmética nos arquivos novos).
- **Sem dependência nova e sem ícone novo:** a T14 confere o `package.json` e que o bundle continua com os mesmos 5 ícones; o **Recharts já está instalado**.
- **`.gitignore`:** a T17 confere com `git status --ignored` e `git check-ignore -v` que nenhum arquivo novo foi ignorado por engano.
- **Segredos:** as contas descartáveis (T1 e T15; senha aleatória, nunca impressa) criam e **apagam** o que usarem.

**Ordem e dependências:** A → B → C → D → E. A T2 usa as fixtures da T1; a T4 usa a T3; a T7 usa a T5; a T9 usa a T8; a T10 usa a T7 e a T9; a T12 usa T4, T6, T10 e T11; a T13 usa a T12 e a T9.
As tarefas que exigem **você** são a T16 (navegador) e a T18 (commit).

### Bloco A — Mocks

**T1 · Claude · Fixtures reais do resultado**
- Arquivos: `src/mocks/fixtures/resultado-sem-opcoes.json`, `resultado-tres-opcoes.json`, `resultado-fundo-vence.json` (e, se útil, `resultado-aporte-mes-1.json`), `src/mocks/contrato.js`, `src/mocks/contrato.test.js`.
- O que muda: capturo do **backend real** (conta descartável, dados fictícios, ids normalizados como nas fixtures anteriores: simulação 1, opções 1, 2 e 3) os resultados de 0 opções, de 3 opções com prazos 48, 36 e 72 (uma delas com taxa 0) e de IPCA −20 % (o fundo vence); o teste de contrato passa a conferir também as chaves dessas respostas.
- Validar: `npm test` (o teste de contrato confere as chaves de cada fixture contra `contrato.js`, com controle que prova que detecta deriva); conferência das fixtures novas contra a resposta viva (mesmas chaves e tipos, `null` onde deve); a conta descartável termina com 0 simulações; nenhum dado pessoal nas fixtures.

**T2 · Claude · Handler do resultado: mensagens reais e atalhos**
- Arquivos: `src/mocks/handlers/resultado.js`, `src/mocks/handlers/leituras.test.js`.
- O que muda: as três mensagens de 422 do aporte passam a ser as reais (`"Campo desconhecido."`, `"Número inválido."` para vazio e só espaços, `"O aporte mensal deve estar entre 0,00 e 9.999.999,00."`) e entram atalhos de teste (`resultadoSemOpcoes()`, `resultadoTresOpcoes()`, `resultadoFundoVence()`, mais `resultadoIndisponivel()` para `5xx`), no estilo dos atalhos dos índices.
- Validar: `npm test` com um bloco novo que confere **todos os literais da tabela do aporte** (uma linha por caso: `1500`, `100`, `0`, `1500.50`, `9999999` = 200; `9999999.01`, `-1`, `abc`, vazio, só espaços, vírgula, 3 casas, repetido e desconhecido = 422 com a mensagem real), a ordem 401 → 404 → 422 e o `null` do fundo sem meta; controle: sem parâmetro e com `1500` continuam `200`, e os atalhos só valem dentro do teste que os liga; a suíte inteira verde (nenhum teste antigo dependia dos textos velhos).

### Bloco B — Dados e utilitários

**T3 · Claude · `api/resultado.js`**
- Arquivos: `src/api/resultado.js`, `src/api/resultado.test.js`.
- O que muda: `obterResultado(simulacaoId, { aporteMensal, signal })` sobre o client; o aporte vai como **número com ponto decimal** e só quando informado.
- Validar: `npm test` (ambiente `node`, MSW): devolve o objeto completo da fixture; sem aporte a consulta não tem parâmetro; com `1500.5` vai `aporte_mensal=1500.5` (nunca vírgula); `401` chama o `aoExpirar` (controle: `404` e `422` não chamam); `404` da simulação e da de outra pessoa com a **mesma** mensagem; `422` com a mensagem real e a chave `aporte_mensal`; `503` e falha de rede sobem como `ErroApi` e `ErroRede`; o `signal` cancela.

**T4 · Claude · Cache do resultado e `useResultado`**
- Arquivos: `src/hooks/chavesSimulacoes.js`, `src/hooks/useResultado.js`, `src/hooks/useResultado.test.jsx`, `src/hooks/useAtualizarSimulacao.js`, `src/hooks/mutacoesSimulacao.test.jsx`, `src/hooks/useSimulacoes.test.jsx` (chaves).
- O que muda: `resultado(id)` continua sendo o prefixo e ganha a variante com aporte (`[...resultado(id), aporte]`); o hook busca o resultado (com ou sem aporte) e `useAtualizarSimulacao` passa a invalidar também o resultado da simulação editada.
- Validar: `npm test` com o cache de produção: os caches do resultado padrão e do com aporte são **separados**; voltar do aporte ao padrão dentro de 30 s **não** faz nova chamada; `404` não é repetido e `503` repete **uma** vez; sem id não busca; cancela ao desmontar; salvar a simulação (hook existente) invalida o prefixo do resultado e **não** o de outra simulação (controle); criar, editar e excluir **opção** (hooks da Etapa 5) continuam invalidando (controle: as chaves novas são cobertas pelo mesmo prefixo).

**T5 · Claude · Formatação para o resultado e aporte no endereço**
- Arquivos: `src/utils/formatar.js`, `src/utils/formatar.test.js`, `src/utils/aporteNaUrl.js`, `src/utils/aporteNaUrl.test.js`.
- O que muda: novos formatadores (o rótulo "mês 44", o valor **compacto** do eixo do gráfico como "R$ 100 mil" e "R$ 1,2 mi") e um utilitário que **lê** o `aporte_mensal` do endereço (pt-BR sem milhar, via `lerNumero`, faixa 0 a 9.999.999,00 e 2 casas, com as mensagens reais da faixa e das casas) e o **escreve** no formato de campo.
- Validar: `npm test`: os formatadores com valores da fixture (95.000, 108.410,78, 3.040.000, 11.411.660,11) e nulos → traço; a leitura do endereço aceita `1500`, `1500,5`, `0`, `9999999`; recusa (com aviso, nunca envio) `1500.5`, `1.500,50` no endereço, `abc`, vazio, `-1`, `9999999,01`, `1500,505`, parâmetro repetido e lixo, e devolve `{ valor: undefined }` quando o parâmetro não existe; escrita e leitura formam um par (ida e volta); controle: a leitura nunca devolve `NaN`.

### Bloco C — Interface

**T6 · Claude · `SimulacaoNaoEncontrada` compartilhado**
- Arquivos: `src/components/SimulacaoNaoEncontrada.jsx`, `src/components/SimulacaoNaoEncontrada.test.jsx`, `src/pages/SimulacaoForm.jsx`.
- O que muda: o estado "Simulação não encontrada" da edição é extraído para um componente e passa a servir também ao resultado.
- Validar: `npm test`: os testes atuais da edição (`404` de id inexistente, de outra pessoa, `404` no `PUT`) passam **sem alterar o que verificam**; um teste novo do componente (título, texto, link ao histórico); a suíte inteira verde.

**T7 · Claude · `CartaoCenario`: à vista e financiamento**
- Arquivos: `src/components/CartaoCenario.jsx`, `src/components/CartaoCenario.test.jsx`.
- O que muda: o cartão de um cenário (título, **custo total** grande, etiqueta escrita "Menor custo" com borda mais forte quando destacado, linhas de detalhe sempre visíveis) nas variantes **à vista** e **financiamento** (sistema, prazo, valor financiado, entrada, primeira e última parcela, total pago, juros, link **Ver parcelas** e a explicação da última parcela numa Price).
- Validar: `npm test` com os valores da fixture: cada dado aparece formatado como o número que a API traz (sem cálculo); a etiqueta e a borda só existem com `destacado` (controle: sem ele, nada); a Price com última parcela diferente mostra as duas e **uma frase** sobre o arredondamento, a Price com parcelas iguais mostra "parcela" só uma vez e a SAC mostra "parcelas decrescentes"; o link **Ver parcelas** aponta para `/simulacoes/:id/financiamentos/:fid`; nome de 120 caracteres quebra a linha; nenhum texto de cálculo; nenhum ícone novo.

**T8 · Claude · `ControleAporte`**
- Arquivos: `src/components/ControleAporte.jsx`, `src/components/ControleAporte.test.jsx`.
- O que muda: o campo "E se eu guardar (R$ por mês)?" com o botão **Simular** e o botão **Voltar ao valor calculado**, que valida no cliente (0 a 9.999.999,00, 2 casas, vírgula decimal) e só chama `aoSimular(valor)` com um número válido.
- Validar: `npm test`: aporte válido chama `aoSimular` com o **número** (`1.500,50` → `1500.5`); vazio, `abc`, `-1`, `9.999.999,01`, `1500,505` e ponto decimal (`1500.5`) mostram a mensagem no campo (as reais da faixa e das casas, a de formato do projeto) e **não** chamam `aoSimular` (controle: o válido chama); um erro vindo do servidor (`422`) aparece no campo; o valor atual é mostrado quando já há um aporte, e **Voltar ao valor calculado** só existe com aporte informado; envia com Enter; o campo tem rótulo e erro associados; bloqueia o envio duplo enquanto busca.

**T9 · Claude · `CartaoCenario`: fundo**
- Arquivos: `src/components/CartaoCenario.jsx`, `src/components/CartaoCenario.test.jsx`.
- O que muda: a variante **fundo** (capital inicial, aporte mensal, prazo, mês da meta, preço na compra, total aportado, rendimento, saldo final), com o `ControleAporte` dentro do cartão e os três estados: **padrão** (meta no prazo), **aporte informado que alcança** ("alcança a meta no mês N") e **aporte informado que não alcança** ("não alcança a meta em 60 meses", com o preço na compra e o custo total como "—" e a frase "sem custo total: o fundo não alcança o preço em 60 meses", e nunca destacado).
- Validar: `npm test` com as fixtures (padrão, aporte 1.500 e aporte 100): cada estado mostra o texto certo e os valores da fixture formatados; `custo_total: null` vira "—" (controle: com valor mostra o valor); aporte 0 no padrão (entrada igual ao veículo) mostra "R$ 0,00 por mês"; o cartão do fundo destacado (fixture "fundo vence") tem a etiqueta; o controle de aporte aparece só neste cartão.

**T10 · Claude · `CartoesResumo`**
- Arquivos: `src/components/CartoesResumo.jsx`, `src/components/CartoesResumo.test.jsx`.
- O que muda: a linha de cartões (à vista, financiamentos em ordem de criação, fundo), a frase sempre visível que explica o **custo total**, a escolha do cartão destacado por `menor_custo` (`cenario` e, para financiamento, o `id`) e o convite com link à edição quando não há opções.
- Validar: `npm test` com as fixtures: destaque no à vista (padrão e empate), no **fundo** (fixture "fundo vence"), num **financiamento** (resultado montado no teste com `menor_custo: { cenario: 'financiamento', id }`, para provar que o `id` casa) e em **nenhum** cartão quando o `menor_custo` é de um cenário ausente (controle); a ordem dos cartões; a frase do custo total presente (com "pago pelo carro", "nominais" e "corrigido pelo IPCA"); 0 opções mostra o convite e só à vista e fundo, 1 e 3 opções não mostram (controle); nenhum cálculo (o teste não soma nada).

**T11 · Claude · `GraficoComparativo`**
- Arquivos: `src/components/GraficoComparativo.jsx`, `src/components/GraficoComparativo.test.jsx`, `src/setupTests.js` (só se o jsdom pedir `ResizeObserver`).
- O que muda: o gráfico de linhas (Recharts) com uma linha por financiamento (`saldo_devedor` pela chave do `id`), o saldo do fundo e o preço corrigido, `connectNulls={false}`, legenda clicável que oculta e mostra cada linha, tooltip em reais ("Mês 36"), eixo em valor compacto, traços diferentes além das cores, título e resumo acessível, largura responsiva e sem animação (`isAnimationActive={false}`).
- Validar: `npm test` (o Recharts no jsdom não mede pixels: os testes conferem os **dados que chegam às linhas**, a legenda e o texto acessível): com a fixture de 3 opções há 5 linhas com os nomes das opções e a série de cada uma tem `null` depois do último mês da opção (**não** preenchidos com 0; controle: o gráfico não some com a série); com 0 opções só há fundo e preço corrigido; clicar na legenda oculta a linha e clicar de novo a mostra (o estado é anunciado, `aria-pressed`); o resumo acessível cita os pontos-chave lidos da série (preço corrigido e saldo do fundo no fim do prazo do fundo), sem calcular; nome de opção longo não quebra a legenda; `npm run build` verde (o bundle cresce com o Recharts e o tamanho é registrado).

**T12 · Claude · Página `Resultado`**
- Arquivos: `src/pages/Resultado.jsx`, `src/pages/Resultado.test.jsx`, `src/App.test.jsx`.
- O que muda: a tela substitui o `EmConstrucao`: busca o resultado (padrão), mostra o cabeçalho (nome, veículo, entrada, taxas em % a.a., prazo do fundo, links **Editar simulação** e **Voltar ao histórico**), os cartões, o gráfico e os estados carregando (esqueleto), erro (**Tentar de novo**) e `404`.
- Validar: `npm test` (`renderizarComAuth` + MSW): esqueleto → cabeçalho, cartões e gráfico com a fixture padrão; com `resultadoSemOpcoes()`, o convite e só à vista e fundo; com `resultadoFundoVence()` o destaque vai ao fundo; `503` mostra o erro com **Tentar de novo**, que carrega quando o servidor volta; falha de rede com a mensagem própria; `404` de id inexistente e de outra pessoa mostram **o mesmo** estado; `401` segue o fluxo da sessão; os links apontam para as rotas certas; o título da página usa o nome do eco `simulacao`; `App.test` e `telas.test` verdes (a rota deixa de ser provisória).

**T13 · Claude · Aporte no endereço da página**
- Arquivos: `src/pages/Resultado.jsx`, `src/pages/Resultado.test.jsx`.
- O que muda: o `ControleAporte` do cartão do fundo lê e escreve `?aporte_mensal=` no endereço (`useSearchParams`); um valor válido busca o resultado com o aporte, **Voltar ao valor calculado** tira o parâmetro e um valor inválido no endereço vira aviso no campo com o resultado padrão, sem chamada ao servidor.
- Validar: `npm test`: abrir `/simulacoes/1/resultado?aporte_mensal=1500` busca **com** o aporte e mostra "alcança a meta no mês 44"; `?aporte_mensal=100` mostra "não alcança a meta em 60 meses", o custo do fundo como "—" e nenhum destaque no fundo; simular pelo campo põe `aporte_mensal=1500,5` no endereço e envia `1500.5`; **Voltar ao valor calculado** remove o parâmetro e volta ao resultado padrão **sem nova chamada** (cache dentro de 30 s; controle: com o cache limpo faz a chamada); o Voltar do navegador desfaz o aporte; `?aporte_mensal=1500.5`, `abc` e `-1` no endereço mostram aviso no campo, mostram o resultado padrão e **não** geram chamada com aporte (medido pelas chamadas ao servidor, com controle: um valor válido gera); `422` do servidor (atalho que responde 422) aparece no campo; o aporte do endereço sobrevive a recarregar a página (nova montagem com o mesmo endereço).

### Bloco D — Verificação e fechamento

**T14 · Claude · Verificação completa**
- Arquivos: nenhum (só leitura, salvo correções).
- O que muda: rodo tudo de ponta a ponta.
- Validar: `lint` com 0 avisos; `npm test` verde **três vezes seguidas** (para pegar instabilidade do gráfico e das corridas) com a contagem registrada; `npm run build` sem avisos novos e o tamanho do bundle (com o Recharts, esperado bem acima dos 759 kB de hoje; se passar de ~1,2 MB registro o dado e proponho o carregamento sob demanda da tela numa decisão, sem fazê-lo sozinho); `npm ls --all` sem problemas; `git diff HEAD -- package.json package-lock.json` vazio (nenhuma dependência nova);
  os **mesmos 5 ícones** (`Add`, `DeleteOutlined`, `EditOutlined`, `Visibility`, `VisibilityOff`); nenhum `console.log` nem dado de teste no `dist/`; `grep` confirma que só `api/api.js` chama `fetch` no código de produção e que os arquivos novos do `src/` (fora dos mocks e testes) **não têm aritmética sobre valores em reais** (nenhum `reduce`, soma, subtração, multiplicação ou divisão de valores da API).

**T15 · Claude · Verificação por linha de comando com o backend real**
- Arquivos: nenhum.
- O que muda: só verificação; subo o `dev` e uso uma **conta descartável nova** (senha aleatória, nunca impressa) que cria simulações com 0, 1 e 3 opções e **apaga tudo** ao fim.
- Validar: as rotas `/simulacoes/1/resultado` e `/simulacoes/1/resultado?aporte_mensal=1500,5` respondem `200` (fallback de SPA); o resultado vivo tem as **mesmas chaves e tipos** das fixtures da T1 (0, 1 e 3 opções, aporte, fundo vence); **paridade cliente × backend** com o código real (`utils/aporteNaUrl` e o esquema do aporte): cada valor que o cliente recusa tem a **mesma mensagem** que o backend real devolve para o mesmo valor (faixa e casas), e cada valor aceito dá `200`, inclusive `1500,5` → `1500.5`; `menor_custo` confere com o cartão que a lógica de destaque escolheria para cada resposta viva (à vista, à vista em empate, fundo com IPCA −20); os textos formatados dos valores reais (`custo_total`, `mes_da_meta`, parcelas) com o código real de `formatar.js`; a conta termina com 0 simulações.

**T16 · Você · Verificação no navegador**
- Arquivos: nenhum.
- O que muda: com `npm run dev` (eu subo) e o backend no ar, você abre `http://localhost:5173`, entra e confere, com o console aberto (F12), numa simulação com **3 opções** (uma Price, uma SAC; use a da Etapa 5 ou crie outra):
  1. **Resultado:** **Ver resultado** (histórico e edição) abre a tela; o cabeçalho traz o nome, o veículo, a entrada e as taxas com **% a.a.**; a frase do **custo total** está visível; cada cartão mostra o custo total e os detalhes; o **menor custo** tem a etiqueta e a borda no cartão certo.
  2. **Números:** compare 3 ou 4 valores (custo total à vista, de um financiamento e do fundo, aporte mensal) com o **Swagger** do backend (`/apidocs/`, `GET /simulacoes/{id}/resultado`, com *Authorize*): devem ser idênticos, sem recálculo.
  3. **Última parcela:** a Price mostra as duas parcelas e a frase do arredondamento quando diferem; a SAC mostra "parcelas decrescentes".
  4. **Gráfico:** 5 linhas com legenda; passe o mouse (ou toque) para ver o tooltip em reais com o mês; **clique na legenda** para ocultar e mostrar uma linha; as linhas **terminam** onde a série acaba (sem cair para zero nem ligar pontos); os traços são diferentes além das cores.
  5. **Aporte:** simule `1500`: o cartão do fundo mostra "alcança a meta no mês 44" (ou o mês da fixture da sua simulação) e o endereço fica `?aporte_mensal=1500`; simule `100`: "não alcança a meta em 60 meses", o custo do fundo em "—" e sem destaque; recarregue a página (o cenário se mantém); use o **Voltar do navegador** (desfaz); **Voltar ao valor calculado** (limpa o endereço).
  6. **Valores inválidos:** digite `10.000.000` e `1500,505`: a mensagem aparece no campo, sem chamada (aba *Network*); edite o endereço para `?aporte_mensal=1500.5` e para `?aporte_mensal=abc`: aviso no campo e resultado padrão, sem chamada com aporte.
  7. **Sem opções:** numa simulação sem opções, só à vista e fundo, com o convite e o link para adicionar.
  8. **Fundo vence:** crie uma simulação com **IPCA −20** e uma opção: o destaque vai para o **fundo**.
  9. **Atualiza depois de mudar:** edite uma opção (ou o valor do veículo) e volte ao resultado: os números mudaram (sem recarregar a página).
  10. **Erros:** com o backend parado (peça que eu pare, com a tela já aberta) recarregue só depois de me pedir para religar e parar de novo, como na Etapa 5: o erro tem **Tentar de novo**; abra `/simulacoes/999999/resultado`: "Simulação não encontrada".
  11. **Ver parcelas:** o link leva a "Tela em construção" (esperado até a Etapa 7).
  12. **Celular:** estreite a janela: os cartões empilham, o gráfico cabe na largura (sem rolagem horizontal) e a legenda continua utilizável.
- Validar: você me diz o resultado de cada item; qualquer falha vira correção antes da T17.

**T17 · Claude · Registrar a conclusão da etapa**
- Arquivos: `CLAUDE.md`, `plano.md` (Etapa 6), esta spec.
- O que muda: `CLAUDE.md` (estrutura com `api/resultado.js`, hooks, componentes, `utils/aporteNaUrl.js`; contrato real do resultado com a tabela do aporte, o vencedor `a_vista`/`fundo`, as séries e os `null`; comportamento da tela e do aporte no endereço; lições de teste, incluindo o Recharts no jsdom; contagem de testes e tamanho do bundle; resíduos); `plano.md` marca a Etapa 6 como concluída com notas (nomes finais, decisões e desvios); a spec passa a "Concluída" com os critérios marcados e o registro da execução.
- Validar: releitura dos três arquivos; `git status --ignored --short` e `git check-ignore -v` nas pastas com arquivos novos confirmam que **nada** foi ignorado por engano e que nada proibido (`node_modules/`, `dist/`, `.env`, `CLAUDE.md`, `api/`) é publicável.

**T18 · Você · Commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica. Sugestão: `git add .`, `git status`, `git commit` e `git push` (inclui a última linha da spec da Etapa 5, ainda não commitada).
- Validar: `git status` limpo; push sem erro.

### Bloco E — Publicação

**T19 · Claude · Confirmar a publicação, do zero**
- Arquivos: nenhum.
- O que muda: só verificação; clono o repositório público numa pasta limpa (a pasta temporária é apagada ao fim).
- Validar: o número de arquivos rastreados no GitHub bate com o do disco; `npm ci`, `npm ls`, `lint` (0 avisos), `npm test` e `npm run build` verdes no clone; a listagem do GitHub tem `src/api/resultado.js`, `src/pages/Resultado.jsx`, `src/components/GraficoComparativo.jsx` e as fixtures novas, e não tem `node_modules`, `dist`, `.env`, `CLAUDE.md`, `api` nem `.claude`.

### Mapa dos critérios de aceite
| Critério | Tarefas |
|---|---|
| `lint`, `test` e `build` verdes; nenhuma dependência nova e nenhum ícone novo | T14, T19 |
| Três cenários, custo total, menor custo no cartão certo, explicação e números iguais aos do Swagger | T7, T9, T10, T12, T15, T16 |
| Detalhes de cada financiamento e do fundo, e a frase da última parcela | T7, T9 |
| Gráfico com as séries, `null` sem ligar, legenda clicável, tooltip, alternativa em texto e celular | T5, T11, T16 |
| Modo "e se eu guardar X por mês?" (alcança, não alcança, `422` no campo, voltar ao valor calculado, endereço) | T2, T5, T8, T9, T13, T15, T16 |
| Sem opções e fundo vence | T1, T2, T10, T12, T16 |
| Resultado atualizado depois de mudar opção ou simulação | T4, T16 |
| Carregando, erro com **Tentar de novo** e `404` | T3, T6, T12, T16 |
| Mocks iguais ao backend real (3 mensagens, fixtures novas) e teste de contrato | T1, T2, T15 |
| Nomes, `console.log`, nenhum cálculo financeiro e nenhuma API externa | T14 |
| `CLAUDE.md` e `plano.md` atualizados | T17 |

### Riscos
- **Recharts no jsdom:** o `ResponsiveContainer` mede o elemento e o jsdom devolve tamanho 0, então nada é desenhado; a T11 decide o caminho mais simples (dimensão inicial ou `ResizeObserver` no `setupTests`) e os testes verificam **dados, legenda e texto**, não pixels. Se o custo de testar ficar alto, preferimos um gráfico com largura e altura injetáveis a esconder o problema.
- **`null` sem ligar:** a prova é sobre os dados que chegam à linha e sobre `connectNulls={false}` (mutação removendo-o); a conferência visual fica na T16.
- **Legenda clicável e acessibilidade:** a legenda do Recharts não é um botão por padrão; a T11 usa uma legenda própria (botões com `aria-pressed`) ou a personaliza, e testa por teclado.
- **Tamanho do bundle:** o Recharts entra pela primeira vez no pacote e o build já avisa de chunk grande; a T14 mede e, se for preciso, **pergunta** antes de dividir o código (carregamento sob demanda), sem decidir sozinha.
- **Endereço e cache:** o aporte no endereço não pode gerar laço de navegação nem chamada com valor inválido; a T13 testa o Voltar do navegador, o recarregar e a ausência de chamadas inválidas, e a chave de cache com aporte não pode invalidar o resultado padrão.
- **Números grandes e formatos:** valores de milhões (IPCA 100 %, veículo de 9.999.999) e o eixo compacto não podem quebrar o cartão nem o gráfico; a T5 e a T7 cobrem os casos da spec.
- **Nenhum cálculo no cliente:** a tentação é somar ou comparar valores para "ajudar" (ex.: quanto a mais custa o financiamento); a regra é só exibir, e a T14 procura aritmética nos arquivos novos.
- **Cartão do fundo com o controle de aporte dentro:** o estado do campo (erro, valor digitado) precisa sobreviver a uma nova busca e não ser perdido quando o resultado troca; a T9 e a T13 testam.
- **Tamanho:** 19 tarefas; a T11 (gráfico) e a T13 (aporte no endereço) são as maiores. Se preferir, executo por bloco e paro para a sua revisão ao fim de cada um.

### Registro da execução (2026-09-27)
- **Resultado:** 1381 testes em 59 arquivos (estáveis em 3 execuções seguidas), `lint` sem avisos, `build` de **1.126 kB** (346 kB gzip; era 759 kB: o Recharts entrou pela primeira vez, abaixo do limiar de ~1,2 MB que o plano fixou para perguntar sobre dividir o código; o build já avisa de chunk grande); os mesmos 5 ícones; nenhuma dependência nova; só `api/api.js` chama `fetch`; nenhuma aritmética sobre valores em reais nos arquivos novos (a busca só achou um contador de índice); `dist/` sem `msw` nem `mockServiceWorker.js`.
- **Desvios do plano:** (1) `useResultado` ganhou `enabled` (o resultado padrão só é buscado de reserva quando o servidor recusa o aporte); (2) o aporte no endereço é escrito com `navigate({ search })` e não com `setSearchParams`, porque o `URLSearchParams` codifica a vírgula como `%2C` e a spec pedia `1500,5` legível; (3) a validação do aporte (`validarAporte`) ficou em `utils/aporteNaUrl.js` e vale para o campo e para o endereço (este sem milhar); (4) `CartaoCenario` recebe `children` (o `ControleAporte` entra no cartão do fundo), e o `CartoesResumo` repassa esse slot; (5) `formatarPrazo` foi para `utils/formatar.js` e o `CartaoFinanciamento` passou a usá-lo; (6) `DadosDaSimulacao` virou o cabeçalho de `Resultado.jsx`; (7) o gráfico usa legenda própria (botões com `aria-pressed`) e o `ResponsiveContainer` é substituído por um tamanho fixo só nos testes (`vi.mock`); (8) o mock de `/resultado` ganhou `FIXTURES_DE_RESULTADO` exportado para os testes.
- **Bugs achados pelos testes:** só fragilidades de teste: `retry: undefined` desligava a política de repetição, listener de eventos sem remoção multiplicava as chamadas, trocas de estado sem `act`, `waitFor` esquecido no import. Prova de sensibilidade: removidos de propósito `connectNulls={false}`, o `hide` da legenda, a invalidação do resultado pela edição da simulação e a leitura que impede o aporte inválido do endereço de ir ao servidor, os testes correspondentes falharam em todos e o código voltou ao original.
- **Verificação automática com o backend real (T15):** 38 checagens com contas descartáveis: formato (chaves e tipos) igual ao das fixtures de 0 opções, 3 opções e fundo vence; o vencedor indicado sempre tem cartão (à vista em 0 e 1 opção e no empate; fundo com IPCA −20); as séries vivas no código do gráfico (73 pontos, 5 linhas, os 36 `null` do fundo e da SAC de 36 meses preservados); o modo aporte com as mesmas mensagens (faixa e casas) e os aceitos (`1500`, `0`, `0,01`, `9999999`, `1.500,50`, `1500,5` → `1500.5`); a ida e volta pelo endereço; o formato inválido nunca chega ao servidor; alcança (mês 44) e não alcança ("—"); a conta terminou com 0 simulações. A primeira execução acusou um erro do **próprio script** (usei o id normalizado da fixture em vez do real); corrigido e refeito com outra conta.
- **Verificação no navegador (T16, pelo autor):** os 12 itens funcionaram sem erro (resultado e números iguais aos do Swagger, última parcela, gráfico e legenda, aporte no endereço, valores inválidos, sem opções, fundo vence, atualização depois de mudar, erros, "Ver parcelas" e celular).
- **Resíduos:** quatro contas descartáveis (a sonda da spec, a captura das fixtures `mock-...` e duas da T15), todas com 0 simulações ao fim; o backend não exclui usuários. As senhas aleatórias nunca foram impressas nem gravadas.
