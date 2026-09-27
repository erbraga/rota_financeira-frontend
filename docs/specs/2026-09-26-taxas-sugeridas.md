# Taxas sugeridas (CDI e IPCA) no formulário (Etapa 4) — Spec

**Criado em:** 2026-09-26
**Status:** Concluída em 2026-09-26 (decisões 1 a 4 resolvidas na mesma data; plano executado, T1 a T11)
**Etapa do plano:** 4 (`plano.md`) · **Requisito:** R4 (feedback visual, valores sugeridos a partir de dados reais)

## Problema
No formulário de simulação, `rendimento do fundo` e `IPCA projetado` são campos **obrigatórios e vazios**: a pessoa precisa saber
de cabeça (ou pesquisar) o CDI e o IPCA do momento. O backend já publica esses valores, vindos do Banco Central, em
`GET /api/indices/{cdi|ipca}` (campo `sugestao`), e o frontend ainda não os usa.

## Objetivo
Pré-preencher os dois campos com a taxa sugerida quando a simulação é **nova**, deixando claro **de onde vem** o número (índice e data),
que o IPCA sugerido é o **realizado em 12 meses** (não uma projeção) e que o campo continua **editável**, com um botão para **usar/restaurar** a
sugestão. Quando o Banco Central estiver fora do ar ou os dados estiverem defasados, o formulário **continua funcionando**: nada bloqueia o envio.

## Fora de escopo
- Qualquer chamada direta ao Banco Central (a SPA só fala com a API; **R8** do backend).
- "% do CDI" (multiplicador do rendimento), Selic e outros índices: o backend só tem CDI e IPCA.
- Gravar a taxa sugerida no backend ou torná-la obrigatória: as taxas seguem obrigatórias e digitadas/confirmadas pela pessoa.
- Tela de resultado e de amortização (**Etapas 6 e 7**); opções de financiamento (**Etapa 5**).
- Gráficos e miniaturas de séries históricas (decisão 3: ficam para a Etapa 6 ou, se sobrar tempo, a 8).
- Alterações no repositório do backend.

## Proposta

### O que foi verificado (estado atual)
| Item | Situação |
|---|---|
| Formulário | `FormularioSimulacao` (Etapa 3) com `CampoNumerico`; `taxaFundoRendimento` e `taxaIpcaProjetada` começam vazios |
| Mocks | `handlers/indices.js` e as fixtures `indice-cdi.json` (3m) e `indice-ipca.json` (12m), com atalhos `indiceIndisponivel()`, `indiceDesatualizado()` e `indiceSemSugestao()` |
| Reaproveitável | `numeroParaCampo`, `formatarData`, `useQuery` com a política do `queryClient` (503 repete 1 vez; 4xx nunca), `EstadoErro`, `mensagemDeErro` |
| Dependências | tudo instalado; **nenhuma dependência nova** |
| Backend | no ar; contrato conferido abaixo (conta descartável nova, só leituras) |

### Contrato real observado (backend, 2026-09-26)
- `GET /api/indices/{cdi|ipca}[?periodo=]` exige JWT (`401` com `WWW-Authenticate` sem token). O caminho é **minúsculo**; `selic`, `CDI`, `Ipca`, `xyz` → `404 "Índice não encontrado"`;
  barra final (`/indices/cdi/`) → `404 "Recurso não encontrado"`. Ordem: **401 → 404 do índice → 422 dos parâmetros**.
- Corpo: `{indice: "CDI"|"IPCA", descricao, unidade: "% a.a.", serie_sgs (4389 | 13522), sugestao, periodo: {inicio, fim}, pontos: [{data, valor}], atualizado_em, desatualizado}`.
- **`sugestao`** = `{valor, data_referencia}` (número, % a.a.): o valor mais recente **até hoje**, **independente do período** (o mesmo em `1m` e `60m`). CDI = último dia útil
  (hoje `13,65` em `2026-09-24`); IPCA = último mês publicado, dia 1 (hoje `4,22` em `2026-08-01`). `sugestao` e `atualizado_em` podem ser **`null`**.
- `desatualizado: true` = dados do cache vencido (o BACEN falhou, mas havia cache); sem cache e com o BACEN fora do ar → `503 "Dados do Banco Central indisponíveis no momento"`.
- **`periodo`** aceita `1m|3m|6m|12m|24m|60m` (padrão `12m`, só minúsculas). Outros valores e vazio → `422 "O período deve ser um destes: 1m, 3m, 6m, 12m, 24m, 60m."`;
  repetido → `422 "Informe o parâmetro uma única vez."`; parâmetro desconhecido → `422 "Campo desconhecido."` (chave = o nome do parâmetro).
- **Tamanho:** o CDI é diário. `12m` (o padrão) traz **250 pontos, ~15,7 kB**; `1m` traz 21 pontos (~1,6 kB); `60m`, 1.255 pontos (~78 kB). O IPCA é mensal (`1m` traz 0 pontos, mas a `sugestao` vem igual).
  Como só a `sugestao` importa para o formulário, pedir `periodo=1m` reduz a resposta em ~10x.

### Desvios dos mocks a corrigir nesta etapa
Comparando com o backend real, os mocks dos índices diferem em: (1) `periodo` **repetido** dá a mensagem genérica do período (o real: `"Informe o parâmetro uma única vez."`);
(2) parâmetro **desconhecido** é ignorado (o real: `422 "Campo desconhecido."`). As demais mensagens (`404` do índice, mensagem do período) já são iguais às reais.
O teste dos mocks passa a usar os literais acima como referência.

### Estrutura criada e alterada
```
src/
  api/indices.js                # obterIndice(indice, { periodo, signal }) sobre o client
  hooks/useIndice.js            # consulta ['indices', indice, periodo] (staleTime longo; sem refetch ao focar)
  components/
    SugestaoDeTaxa.jsx          # linha de apoio sob o campo: origem, data, aviso de cache, botão "Usar", erro com "Tentar de novo"
    FormularioSimulacao.jsx     # recebe as consultas (sugestoes) e aplica a sugestão (só na nova) sem sobrescrever o que foi digitado
  pages/SimulacaoForm.jsx       # busca CDI e IPCA (em paralelo) e passa ao formulário
  utils/formatar.js             # formatarMesAno("2026-08-01") -> "ago/2026" (o IPCA é mensal)
  mocks/handlers/indices.js     # corrige os dois desvios acima
```

### Comportamento
- **Busca:** ao abrir `/simulacoes/nova` (e `/simulacoes/:id/editar`, conforme a decisão 1), `GET /indices/cdi` e `GET /indices/ipca` **em paralelo**, com `periodo=1m` (só a `sugestao` interessa; decisão 3).
  Cache do React Query longo (30 min; o backend guarda 12 h): reabrir o formulário não refaz a chamada. Não bloqueia nada: o formulário abre e é digitável desde o primeiro instante.
- **Pré-preenchimento (só na nova):** `CDI → rendimento do fundo` e `IPCA → IPCA projetado`, com `numeroParaCampo(sugestao.valor)` (`13,65`, `4,22`). Aplicado **uma vez**, quando a resposta chega, e **somente se o campo ainda estiver intocado**
  (sem edição nem saída do campo). Se a pessoa já digitou algo (ou já saiu do campo), a sugestão **não** sobrescreve: aparece só como sugestão, com o botão.
- **Origem visível** (linha de apoio sob o campo): "Sugestão do Banco Central: **13,65% a.a.** (CDI de 24/09/2026)" e, para o IPCA, "(IPCA acumulado em 12 meses até **ago/2026**)". O valor sugerido no texto vem já formatado por `formatarPercentual`.
- **Usar sugestão:** um botão de texto ("Usar 13,65%") escreve o valor sugerido no campo (marca o campo como alterado, valida e devolve o foco), inclusive **depois** de a pessoa ter digitado outra coisa (é o "restaurar").
- **IPCA realizado, não projeção:** um texto curto e sempre visível sob o IPCA (decisão 4): "É o IPCA acumulado nos últimos 12 meses (já realizado), não uma projeção. Use como referência."
- **`desatualizado: true`:** um aviso discreto na mesma linha: "Dados do cache, podem estar defasados." O valor continua sendo sugerido e pré-preenchido.
- **`sugestao: null`:** "Sem sugestão do Banco Central disponível agora. Digite a taxa." (sem pré-preenchimento e sem botão).
- **Erro (503, rede, timeout):** "Não foi possível obter a sugestão do Banco Central agora. Digite a taxa." com **Tentar de novo** (refaz só aquela consulta). **A criação não depende do BACEN:** o botão de enviar nunca é bloqueado, e os campos seguem obrigatórios como sempre.
- **Carregando:** "Buscando a sugestão do Banco Central…" (região `aria-live="polite"`; quando a sugestão chega, o texto muda sem tirar o foco de quem está digitando).
- **Editar:** os valores gravados **nunca** são sobrescritos. Conforme a decisão 1, a sugestão aparece só como informação, com o botão "Usar", para quem quiser atualizar.
- **Sessão:** um `401` da consulta é da sessão (o client já cuida); `404`/`422` não ocorrem com as chamadas da SPA (índice e período fixos).
- **Acessibilidade:** o botão tem nome acessível com o índice ("Usar a sugestão do CDI: 13,65%"); o texto de origem não depende só de cor; o aviso de cache não é o único indicador (tem texto).

### Mocks e testes
- Mocks: `periodo` repetido, parâmetro desconhecido e a ordem 404 → 422; teste de contrato com os literais reais.
- `api/indices` (ambiente `node`): as duas chamadas, `periodo`, `401`, `404` do índice, `422` do período, `503`.
- `useIndice`: carrega, cache (a segunda montagem não refaz a chamada; controle com `staleTime` 0), `503` repetido uma vez e `404` nunca.
- `SugestaoDeTaxa`: cada estado (carregando, sugestão do CDI e do IPCA com a data certa, `desatualizado`, `sugestao: null`, erro com Tentar de novo), o botão Usar e o texto do IPCA.
- `FormularioSimulacao` / `SimulacaoForm` (com MSW): campos pré-preenchidos quando a sugestão chega; **não sobrescreve** o que foi digitado antes da resposta (nem se a pessoa apagou o campo e saiu dele); "Usar" restaura depois de editar; `desatualizado`, `sugestao: null` e `503`
  **não bloqueiam** o envio (a simulação é criada normalmente, com as taxas digitadas); na **edição** os valores gravados ficam intactos; a resposta tardia depois de enviar não quebra; o `POST` sai com o valor sugerido como **número** (`13,65` → `13.65`).
  Cada teste tem um controle (a versão sem o comportamento).

### Casos de borda
- **Resposta tardia:** a pessoa digita o rendimento antes de o CDI chegar → não é sobrescrito; a sugestão aparece só com o botão.
- **Apagar e sair:** a pessoa digita, apaga e sai do campo antes da resposta → o campo já foi "tocado": não é preenchido depois.
- **As duas consultas falham ou só uma:** cada linha de apoio é independente (o CDI pode estar disponível e o IPCA, não).
- **Sugestão em edição depois de salvar:** o `reset` do formulário mostra os valores salvos; a sugestão continua só como informação.
- **Backend lento na primeira chamada:** o backend pode esperar até 8 s pelo BACEN e o client tem 15 s de timeout; o formulário continua digitável durante a espera.
- **Cache da primeira abertura:** com `desatualizado: true` o valor pré-preenchido pode estar defasado: o aviso diz isso e o botão/edição permitem corrigir.
- **Valor com muitas casas:** o backend guarda até 6 casas; `numeroParaCampo` escreve o que veio, e a validação do campo (6 casas) já cobre.
- **Sessão que expira** durante a busca: fluxo normal da Etapa 2 (login com o aviso).

### Resíduos no banco de desenvolvimento do backend
A exploração desta spec usou uma **quinta conta descartável** (`sonda-<aleatório>@example.com`, só leituras; senha aleatória já descartada). O backend não exclui usuários; sem impacto para o app.

## Decisões em aberto
Resolvidas em 2026-09-26 (decisões do autor):
1. ~~Sugestão na tela de edição~~ **Mostrar, só como informação, com o botão "Usar":** na edição os valores gravados **nunca** são
   alterados sozinhos (nem quando a resposta chega); a linha de apoio mostra a sugestão e só o clique em "Usar" muda o campo.
   Duas consultas (CDI e IPCA) com cache de 30 minutos. Depois de salvar, o formulário mostra os valores salvos e a sugestão
   continua como informação.

2. ~~Como mostrar a sugestão junto ao campo~~ **Linha de apoio abaixo do campo, com botão de texto** ("Sugestão do Banco Central:
   **13,65% a.a.** (CDI de 24/09/2026)" e o botão **Usar 13,65%**). Fica visível sem passar o mouse nem tocar, quebra em duas
   linhas no celular, tem nome acessível ("Usar a sugestão do CDI: 13,65%") e comporta os estados (carregando, cache
   desatualizado, sem sugestão, erro com "Tentar de novo"). Sem botão dentro do campo e sem chip.

3. ~~Mini gráfico da série~~ **Não incluir agora:** o formulário fica limpo e a consulta usa **`periodo=1m`** (CDI ~1,6 kB em vez de
   ~15,7 kB; a `sugestao` é a mesma). O gráfico de verdade é o da Etapa 6; uma miniatura pode entrar na Etapa 8, se sobrar tempo,
   apenas mudando o `periodo` (os pontos já vêm da mesma chamada).

4. ~~Aviso de que o IPCA sugerido é realizado, não projeção~~ **Texto curto sempre visível** sob o campo de IPCA: "É o IPCA acumulado
   nos últimos 12 meses (já realizado), não uma projeção. Use como referência." Sem clique nem dica (tooltip), aparece em qualquer
   estado (inclusive com a sugestão indisponível), é lido junto com o campo por leitor de tela e não usa ícone novo.

Sem decisões em aberto: a spec está pronta para o `/plan`.

## Critérios de aceite
- [x] `npm run lint` (0 avisos), `npm test` e `npm run build` verdes; nenhuma dependência nova.
- [x] **No navegador, contra o backend real:** `/simulacoes/nova` já vem com o rendimento (CDI) e o IPCA sugeridos, cada um com a origem e a data; ambos editáveis; **Usar** restaura a sugestão depois de editar; um valor digitado antes da resposta não é sobrescrito.
- [x] O texto do IPCA deixa claro que é o acumulado de 12 meses **realizado**; a data do IPCA aparece como mês (`ago/2026`) e a do CDI como dia.
- [x] Com o **backend parado**, o formulário abre, mostra o aviso com **Tentar de novo** nos dois campos e permite digitar as taxas e criar a simulação (com o backend religado no envio).
- [x] `desatualizado`, `sugestao: null` e `503` estão implementados e testados e **nenhum bloqueia** o envio.
- [x] Na **edição**, os valores gravados nunca são sobrescritos (conforme a decisão 1).
- [x] O `POST` leva a taxa sugerida como **número** (`13.65`), com o formato de campo `13,65` na tela.
- [x] A consulta usa `periodo=1m` e o cache evita repetir a chamada ao reabrir o formulário.
- [x] Os mocks refletem o backend real nos dois pontos corrigidos, e o teste de contrato confere as mensagens do período.
- [x] Nomes em `PascalCase.jsx`/`camelCase.js`; nenhum `console.log`; nada de chamada direta ao Banco Central.
- [x] O `CLAUDE.md` é atualizado (estrutura, contrato dos índices, contagem de testes) e o `plano.md` marca a Etapa 4.

## Plano de Implementação

**Status:** executado (T1 a T11) · **Criado em:** 2026-09-26

São 13 tarefas pequenas, em cinco blocos. Cada uma indica **quem executa** (**Claude** ou **Você**), os arquivos, o que muda e como
validar. O código de cada módulo nasce **junto com os seus testes** (`*.test.js(x)` ao lado). Regras para todo o plano:
- O Claude **não** roda `git add`, `commit` nem `push` (os commits são seus).
- Ao fim de cada tarefa que altera código: `npm run lint` (0 avisos) e `npm test` verdes.
- Cada teste de comportamento tem um **controle** (a versão que não deve disparar) que prova que ele pode falhar.
- **Mensagens e formatos:** a referência são os literais da seção "Contrato real observado" desta spec, copiados do backend real (lição das Etapas 2 e 3).
- **`.gitignore`:** a T11 confere com `git status --ignored` e `git check-ignore -v` que nenhum arquivo novo foi ignorado por engano.
- **Sem dependência nova** e **sem ícone novo**: o bundle continua com os mesmos 5 ícones (a T8 confere).
- **Testes existentes:** o formulário da nova simulação passa a vir com CDI e IPCA preenchidos; os testes de tela da Etapa 3 que digitam nesses campos ou contam
  "Campo obrigatório." são ajustados **na tarefa que muda o comportamento** (T7), não deixados para depois.
- Segredos: a conta descartável da T9 (sexta; senha aleatória, nunca impressa) só faz leituras e apaga o que criar.

**Ordem e dependências:** A → B → C → D → E. A T4 usa a T3; a T5 usa a T2 (`formatarMesAno`) e o formato das consultas da T4; a T6 usa a T5; a T7 usa T4 e T6.
As tarefas que exigem **você** são a T10 (navegador) e a T12 (commit).

### Bloco A — Mocks e utilitário

**T1 · Claude · Mocks: `periodo` repetido e parâmetro desconhecido**
- Arquivos: `src/mocks/handlers/indices.js`, `src/mocks/handlers/leituras.test.js`.
- O que muda: `periodo` **repetido** responde `422 "Informe o parâmetro uma única vez."`, parâmetro **desconhecido** responde `422 "Campo desconhecido."` (chave = o nome do parâmetro), mantendo a ordem 401 → 404 do índice → 422; as mensagens de período e de `404` continuam iguais às reais.
- Validar: `npm test` com os literais reais (`"O período deve ser um destes: 1m, 3m, 6m, 12m, 24m, 60m."` para `2m`, `12M`, vazio e `abc`; `"Informe o parâmetro uma única vez."`; `"Campo desconhecido."`; `404 "Índice não encontrado"` para `selic`, `CDI`, `Ipca`, `xyz`, e o 404 vem **antes** do 422); controle: `periodo=1m` válido e a chamada sem parâmetro continuam `200`, e um parâmetro desconhecido **não** derruba o 404 do índice.

**T2 · Claude · `formatarMesAno`**
- Arquivos: `src/utils/formatar.js`, `src/utils/formatar.test.js`.
- O que muda: `formatarMesAno("2026-08-01")` → `"ago/2026"` (mês em português abreviado, sem ponto), lendo a data como **data local** (sem passar por `Date` em UTC), para o IPCA, que é mensal.
- Validar: `npm test`: os 12 meses (`jan` a `dez`), `"2026-01-01"` e `"2026-12-01"`, `criado_em` com hora e fuso, o teste com fusos diferentes (como o de `formatarData`, sem voltar um mês), e entradas vazias ou inválidas → traço (`—`); controle: um `new Date("2026-08-01")` ingênuo mostraria julho no fuso do Brasil.

### Bloco B — Dados

**T3 · Claude · `api/indices.js`**
- Arquivos: `src/api/indices.js`, `src/api/indices.test.js`.
- O que muda: `obterIndice(indice, { periodo, signal })` sobre o client (`GET /indices/{cdi|ipca}?periodo=`), com o índice em **minúsculas** e o `periodo` só quando informado.
- Validar: `npm test` (ambiente `node`, MSW): devolve o objeto completo e a `sugestao` de CDI e IPCA; envia `periodo=1m` na consulta; `401` chama o `aoExpirar` (controle: `404` do índice e `422` do período não chamam); `404` `"Índice não encontrado"` para `selic`; `422` do período com a mensagem real; `503` com `"Dados do Banco Central indisponíveis no momento"`; `desatualizado: true` e `sugestao: null` chegam intactos.

**T4 · Claude · `useIndice`**
- Arquivos: `src/hooks/useIndice.js`, `src/hooks/useIndice.test.jsx`.
- O que muda: consulta `['indices', indice, periodo]` (padrão `1m`), `staleTime` de **30 minutos** e sem `refetchOnWindowFocus`, usando a política de repetição do `queryClient` (`503` uma vez, `4xx` nunca).
- Validar: `npm test` (`renderizarHookComAuth`): carrega CDI e IPCA (e a `sugestao`); a **segunda montagem não refaz a chamada** (o `staleTime` do hook vence o do cliente de teste, que é 0; controle: com `staleTime: 0` no hook a chamada se repete); `503` repete **uma** vez e `404` nunca (cliente de produção); o `signal` cancela ao desmontar; índices diferentes têm chaves e caches separados.

### Bloco C — Interface

**T5 · Claude · `SugestaoDeTaxa`**
- Arquivos: `src/components/SugestaoDeTaxa.jsx`, `src/components/SugestaoDeTaxa.test.jsx`.
- O que muda: a linha de apoio sob o campo, recebendo a consulta (`isPending`/`isError`/`data`), o índice (`cdi`|`ipca`), `aoUsar(texto)` e `aoTentarNovamente`, com os estados da spec: **carregando** ("Buscando a sugestão do Banco Central…", região `aria-live="polite"`), **sugestão** ("Sugestão do Banco Central: **13,65% a.a.** (CDI de 24/09/2026)"; IPCA com o mês: "(IPCA acumulado em 12 meses até ago/2026)") e o botão **Usar 13,65%** com nome acessível ("Usar a sugestão do CDI: 13,65%"), **cache** ("Dados do cache, podem estar defasados."), **sem sugestão** ("Sem sugestão do Banco Central disponível agora. Digite a taxa.") e **erro** ("Não foi possível obter a sugestão do Banco Central agora. Digite a taxa." com **Tentar de novo**); e o texto fixo do IPCA ("É o IPCA acumulado nos últimos 12 meses (já realizado), não uma projeção. Use como referência.") **sempre visível**, em qualquer estado.
- Validar: `npm test`: cada estado com os textos exatos e as datas certas (`24/09/2026` no CDI, `ago/2026` no IPCA); `Usar` chama `aoUsar` com `"13,65"` (texto no formato de campo, via `numeroParaCampo`); `Tentar de novo` chama a ação; o texto do IPCA aparece nos cinco estados e **não** aparece no CDI (controle); o `desatualizado` mantém o botão; nenhum estado desabilita nada nem usa ícone.

**T6 · Claude · `FormularioSimulacao` aplica a sugestão**
- Arquivos: `src/components/FormularioSimulacao.jsx`, `src/components/FormularioSimulacao.test.jsx`.
- O que muda: recebe `sugestoes` (`{ taxaFundoRendimento, taxaIpcaProjetada }`, cada uma uma consulta) e `preencherSugestoes` (só na nova); mostra a `SugestaoDeTaxa` sob o rendimento e sob o IPCA; **pré-preenche uma vez** quando a resposta chega **e o campo ainda está intocado** (nem alterado nem com saída do campo), sem marcar o campo como alterado; o botão **Usar** escreve o valor, marca como alterado, valida e devolve o foco ao campo (também depois de digitar outra coisa e também na edição).
- Validar: `npm test` (formulário isolado com consultas simuladas): a resposta preenche `13,65` e `4,22` sem mexer no resto; **não sobrescreve** o que foi digitado **antes** da resposta e nem o campo em que se digitou, apagou e saiu (controle: campo intocado é preenchido); com `preencherSugestoes` falso (edição) **nada é escrito** e o valor gravado permanece; **Usar** restaura depois de editar; a sugestão aplicada uma vez **não** volta a sobrescrever quando a consulta é refeita; `desatualizado`, `sugestao: null` e erro **não** bloqueiam o envio (o corpo sai com as taxas digitadas); o valor sugerido sai no `aoEnviar` como **número** (`13.65`).

**T7 · Claude · Tela de criar e editar busca e usa as sugestões**
- Arquivos: `src/pages/SimulacaoForm.jsx`, `src/pages/SimulacaoForm.test.jsx`, `src/App.test.jsx`.
- O que muda: `NovaSimulacao` e `EditarSimulacao` chamam `useIndice('cdi')` e `useIndice('ipca')` (em paralelo, sem bloquear a tela) e passam as consultas ao formulário; a nova liga `preencherSugestoes`, a edição não; os testes de tela da Etapa 3 são ajustados ao formulário que agora vem preenchido (limpam o campo antes de digitar, e o "tudo vazio" espera 3 obrigatórios em vez de 5) e os de rota esperam a sugestão chegar.
- Validar: `npm test` (`renderizarComAuth` + MSW): a nova já vem com o rendimento e o IPCA preenchidos e a origem à vista; criar com os valores sugeridos faz o `POST` com `taxa_fundo_rendimento` e `taxa_ipca_projetada` **números** iguais à sugestão e vai à edição (URL, aviso e valores conforme a Etapa 3); a **edição** mantém os valores gravados e mostra a sugestão como informação, e **Usar** só muda o campo ao clicar; `503` (`indiceIndisponivel()`), `sugestao: null` (`indiceSemSugestao()`) e `desatualizado` (`indiceDesatualizado()`) **não impedem** criar a simulação; a resposta **tardia** (handler com atraso) não sobrescreve o que foi digitado; a **segunda** abertura do formulário não refaz as chamadas aos índices; `App.test` e `telas.test` verdes; `npm run build` verde.

### Bloco D — Verificação e fechamento

**T8 · Claude · Verificação completa**
- Arquivos: nenhum (só leitura, salvo correções).
- O que muda: rodo tudo de ponta a ponta.
- Validar: `lint` com 0 avisos; `npm test` verde **três vezes seguidas** (para pegar instabilidade das corridas de sugestão) com a contagem registrada; `npm run build` sem avisos e o tamanho do bundle; `npm ls --all` sem problemas; `git diff HEAD -- package.json package-lock.json` vazio (nenhuma dependência nova); por *sourcemap*, **exatamente os mesmos 5 ícones** (`Add`, `DeleteOutlined`, `EditOutlined`, `Visibility`, `VisibilityOff`); nenhum `console.log` nem dado de teste no `dist/`; `grep` confirma que **nenhum** arquivo do `src/` (fora dos mocks) chama o Banco Central (`bcb.gov.br`) nem `fetch` direto.

**T9 · Claude · Verificação por linha de comando com o backend real**
- Arquivos: nenhum.
- O que muda: só verificação; subo o `dev` e uso uma **conta descartável nova** (senha aleatória, nunca impressa) que só faz leituras e **apaga o que criar**.
- Validar: as rotas `/simulacoes/nova` e `/simulacoes/1/editar` respondem `200` (fallback de SPA); comparo o backend **real** com o que os testes esperam: as chaves de `IndiceEconomico` de CDI e IPCA (`periodo=1m`), a `sugestao` (`valor` número e `data_referencia`), o `periodo` repetido, o parâmetro desconhecido e o `404`, todos com os **literais** da spec; passo o valor real pelo **código real** do cliente (`numeroParaCampo`, `formatarPercentual`, `formatarData`, `formatarMesAno`) e mostro os textos resultantes (`13,65`, `24/09/2026`, `ago/2026`); crio, pelo `paraCorpoDaApi`, uma simulação com as taxas sugeridas e confirmo `201` e o valor devolvido, e a **apago** (`204`), deixando a conta sem simulações.

**T10 · Você · Verificação no navegador**
- Arquivos: nenhum.
- O que muda: com `npm run dev` (eu subo) e o backend no ar, você abre `http://localhost:5173`, entra e confere, com o console aberto (F12):
  1. **Nova simulação:** os campos *Rendimento do fundo* e *IPCA projetado* já vêm preenchidos (hoje `13,65` e `4,22`); cada um mostra "Sugestão do Banco Central: … a.a. (CDI de dd/mm/aaaa)" e "(IPCA acumulado em 12 meses até ago/2026)"; sob o IPCA aparece o texto de que **não é uma projeção**.
  2. **Editar e restaurar:** troque o rendimento por outro valor; o botão **Usar 13,65%** o restaura e devolve o foco ao campo; trocar de novo e usar de novo funciona.
  3. **Digitar antes da resposta:** no Chrome, DevTools → *Network* → *Throttling* "Slow 3G" e recarregue a nova; digite o rendimento **antes** de a sugestão chegar: o valor digitado é **mantido**, e a sugestão aparece só com o botão.
  4. **Cache:** com a aba *Network* aberta, navegue de `/simulacoes/nova` para `/simulacoes` e volte em menos de 30 minutos: **não** sai nova chamada a `/api/indices/…`.
  5. **Edição:** abra uma simulação existente: os valores gravados continuam intactos e a sugestão aparece só como informação; **Usar** muda o campo apenas quando você clica; salve.
  6. **Backend parado** (peça para eu parar o backend e abra `/simulacoes/nova`): o formulário abre, cada taxa mostra "Não foi possível obter a sugestão do Banco Central agora. Digite a taxa." com **Tentar de novo**, e você consegue digitar as duas taxas; religue (peça) e clique em **Tentar de novo**: a sugestão aparece **sem** apagar o que você digitou (com o botão Usar); crie a simulação.
  7. **Criar com os valores sugeridos:** vai à edição da nova simulação com as taxas salvas (`13,65` e `4,22`).
  8. **Celular:** estreite a janela: a linha de apoio quebra em duas (texto e botão) sem esconder nada.
- Validar: você me diz o resultado de cada item; qualquer falha vira correção antes da T11.

**T11 · Claude · Registrar a conclusão da etapa**
- Arquivos: `CLAUDE.md`, `plano.md` (Etapa 4), esta spec.
- O que muda: `CLAUDE.md` (estrutura com `api/indices.js`, `useIndice`, `SugestaoDeTaxa` e `formatarMesAno`; contrato real dos índices, incluindo `periodo`, `sugestao` anulável, `desatualizado`, o tamanho da resposta e a razão do `periodo=1m`; o comportamento do pré-preenchimento e as lições de teste; contagem de testes; resíduos); `plano.md` marca a Etapa 4 com "Validado" e notas (incluindo que os nomes finais dos componentes diferem do previsto: `SugestaoDeTaxa` em vez de `CampoTaxaSugerida` e `AvisoIndice`); a spec passa a "Concluída" com os critérios marcados.
- Validar: releitura dos três arquivos; `git status --ignored --short` e `git check-ignore -v` nas pastas com arquivos novos confirmam que **nada** foi ignorado por engano e que nada proibido (`node_modules/`, `dist/`, `.env`, `CLAUDE.md`, `api/`) é publicável.

**T12 · Você · Commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica. Sugestão: `git add .`, `git status`, `git commit` e `git push`.
- Validar: `git status` limpo; push sem erro.

### Bloco E — Publicação

**T13 · Claude · Confirmar a publicação, do zero**
- Arquivos: nenhum.
- O que muda: só verificação; clono o repositório público numa pasta limpa.
- Validar: o número de arquivos rastreados no GitHub bate com o do disco; `npm ci`, `npm ls`, `lint` (0 avisos), `npm test` e `npm run build` verdes no clone; a listagem do GitHub tem `src/api/indices.js`, `src/hooks/useIndice.js` e `src/components/SugestaoDeTaxa.jsx` e não tem `node_modules`, `dist`, `.env`, `CLAUDE.md`, `api` nem `.claude`.

### Mapa dos critérios de aceite
| Critério | Tarefas |
|---|---|
| `lint`, `test` e `build` verdes; nenhuma dependência nova | T8, T13 |
| Nova simulação já vem com CDI e IPCA sugeridos, com origem e data; editáveis; **Usar** restaura; valor digitado antes não é sobrescrito | T5, T6, T7, T9, T10 |
| Texto de que o IPCA é o realizado; data do IPCA como mês e a do CDI como dia | T2, T5, T9, T10 |
| Backend parado: aviso com Tentar de novo nos dois campos e criação possível | T5, T6, T7, T10 |
| `desatualizado`, `sugestao: null` e `503` implementados, testados e sem bloquear o envio | T5, T6, T7 |
| Na edição os valores gravados nunca são sobrescritos | T6, T7, T10 |
| O `POST` leva a taxa sugerida como número | T6, T7, T9 |
| `periodo=1m` e o cache evitam repetir a chamada | T3, T4, T7, T10 |
| Mocks iguais ao backend real e teste de contrato com as mensagens do período | T1, T9 |
| Nomes, `console.log` e nenhuma chamada direta ao Banco Central | T8 |
| `CLAUDE.md` e `plano.md` atualizados | T11 |

### Riscos
- **Corrida entre digitar e a sugestão chegar:** a regra "só preenche se o campo estiver intocado" depende do estado `dirty`/`touched` do React Hook Form; a T6 testa os quatro casos (chegou antes, digitou antes, digitou-apagou-saiu, edição) e a T7 repete um deles com atraso real no MSW.
- **`setValue` num campo controlado (`useController`):** o pré-preenchimento sem marcar o campo como alterado e o "Usar" marcando; a T6 confere os dois e o foco (assíncrono, como todo `setFocus`).
- **Testes existentes que digitam nos campos de taxa:** passam a receber o valor sugerido antes da digitação; a T7 os ajusta (limpam antes de digitar) e o critério é que a suíte fique verde **sem** relaxar nenhuma verificação.
- **Chamada chegando depois do fim do teste:** consultas de índice resolvem tarde e geram avisos de `act` (que viram erro pela trava de `console.error`); os testes esperam o texto da sugestão aparecer antes de terminar (lição da Etapa 3), e a T8 roda a suíte três vezes.
- **Cache de 30 min vs cliente de teste com `staleTime: 0`:** o `staleTime` do hook vence o do cliente, então o teste de "segunda abertura sem chamada" não precisa do cliente de produção; a T4 tem o controle.
- **Índices com 401:** a sessão expirada durante a busca segue o fluxo da Etapa 2 (uma só saída); coberto pelo teste de `api/indices` e pelo AuthProvider já existente.
- **Tamanho:** 13 tarefas; a T6 e a T7 são as maiores. Se preferir, executo por bloco e paro para a sua revisão ao fim de cada um.

### Registro da execução (2026-09-26)
- **Resultado:** 931 testes em 42 arquivos (estáveis em 3 execuções seguidas), `lint` sem avisos, `build` de 729 kB (230 kB gzip; era 726 kB); os mesmos 5 ícones do `@mui/icons-material`; nenhuma dependência nova; só `api/api.js` chama `fetch` no código de produção e nada no `src/` fala com o Banco Central; `dist/` sem `msw`, fixtures nem mensagens dos mocks.
- **Desvios do plano:** (1) o `CampoNumerico` ganhou `descritoPor` e um `id` próprio (`useId`) para o campo ser descrito **também** pela linha de apoio (`aria-describedby` junto com a ajuda), como a spec pedia para o texto do IPCA; (2) `useIndice` exporta `STALE_TIME_INDICE_MS` e `PERIODO_DA_SUGESTAO`, e a tela usa um `useSugestoes` local que junta CDI e IPCA no formato do formulário; (3) o botão "Usar" escreve com `shouldDirty` e `shouldValidate`, e o pré-preenchimento **não** marca o campo como alterado; (4) os dois testes de corrida usam uma "comporta" (o teste libera a resposta) em vez de atraso por tempo: com 400 ms a suíte completa falhou sob carga, porque a resposta chegava antes de terminar a digitação; (5) o `SugestaoDeTaxa` ficou no lugar de `CampoTaxaSugerida` e `AvisoIndice`.
- **Bugs achados pelos testes:** só o do item (4) acima (fragilidade de teste, não do código). Prova de sensibilidade: removida de propósito a checagem do "campo intocado" e a do modo edição, os testes de "não sobrescreve" e "edição intacta" falharam nas duas; o código voltou ao original.
- **Verificação automática com o backend real (T9):** 26 checagens, conta descartável, senha aleatória: as mesmas chaves das fixtures, `sugestao` como número e data, `periodo` repetido, desconhecido, inválido e vazio com as mensagens literais, o `404` do índice antes do `422`, `401` sem token; os textos que a tela mostra com o valor real (`13,65`, `24/09/2026`, `4,22`, `ago/2026`); o `POST` com as taxas sugeridas (números) deu `201` e o valor voltou igual; o `DELETE` deu `204` e a conta terminou com 0 simulações.
- **Verificação no navegador (T10, pelo autor):** todos os itens passaram. O item do backend parado precisou de mais de uma tentativa: recarregar a página com o backend fora do ar leva à tela de erro de sessão da Etapa 2 ("Não foi possível falar com o servidor"), e abrir o formulário antes de parar o backend faz as taxas virem do cache de 30 minutos (a causa mais provável da segunda tentativa; não foi confirmada com a aba *Network*). O procedimento que funciona: carga limpa com o backend no ar, ir à lista, parar o backend e só então clicar em "Nova simulação"; ao religar, **Tentar de novo** e a criação funcionaram.
- **Resíduos:** a T9 criou a sexta conta descartável (`sonda-...`), sem simulações; o backend não exclui usuários. A senha aleatória nunca foi impressa nem gravada.
