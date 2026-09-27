# Histórico e CRUD de simulações (Etapa 3) — Spec

**Criado em:** 2026-09-26
**Status:** Concluída em 2026-09-26 (decisões 1 a 6 resolvidas; critérios de aceite verificados)
**Etapa do plano:** 3 (`plano.md`) · **Requisitos:** R1 (`PUT` e `DELETE` pela interface, além de `GET` e `POST`), R4 (feedback visual)

## Problema
Com a sessão pronta (Etapa 2), as telas `Simulacoes` e `SimulacaoForm` ainda são provisórias: a pessoa não consegue
ver o histórico, criar, editar nem excluir uma simulação. Sem isso não há o que comparar nas Etapas 5 a 7, e faltam
os métodos `PUT` e `DELETE` exigidos pelo R1.

## Objetivo
Permitir **listar, criar, abrir para edição, salvar alterações e excluir** as simulações da pessoa logada, com
estados claros de carregamento, erro e vazio, validação junto aos campos (no cliente e vinda do backend) e
confirmação antes de excluir.

## Fora de escopo
- Opções de financiamento dentro da simulação (**Etapa 5**); a tela de edição só recebe o formulário da simulação.
- Taxas sugeridas do BACEN (**Etapa 4**): nesta etapa `IPCA` e `rendimento` são digitados (campos vazios e obrigatórios).
- Tela de resultado e de amortização (**Etapas 6 e 7**): o botão "Ver resultado" leva à tela provisória atual.
- Paginação, ordenação e filtros no histórico (decisão do autor: o backend não os oferece).
- Duplicar simulação, exportar, busca, e o aviso de "alterações não salvas" ao sair (o `BrowserRouter` não suporta `useBlocker`).
- Catálogo geral de mensagens de erro e ajustes de responsividade fina (**Etapa 8**).
- Alterações no repositório do backend.

## Proposta

### O que foi verificado (estado atual)
| Item | Situação |
|---|---|
| Telas | `Simulacoes` e `SimulacaoForm` são `EmConstrucao`; as rotas e a proteção já existem |
| Reaproveitável | `lerNumero`/`numeroParaCampo`/`formatarMoeda`/`formatarData`, `aplicarErrosDoServidor`, `renderizarComAuth`, React Query (`queryClient`), MUI com ícones |
| Dependências | tudo já instalado; **nenhuma dependência nova** |
| Backend | no ar; contrato conferido abaixo **com uma conta descartável** (ver "Resíduos") |

### Contrato real observado (backend, 2026-09-26)
**Corpo (`POST` e `PUT`, idêntico; o `PUT` substitui tudo, sem `PATCH`)** e mensagens de `422` **reais**, em português:

| Campo | Regra | Mensagem real |
|---|---|---|
| `nome` | texto, 1 a 120, aparado (só espaços vale como vazio) | `"O nome deve ter entre 1 e 120 caracteres."`; não-texto: `"Nome inválido."` |
| `valor_veiculo` | 0,01 a 9.999.999,00; 2 casas | `"O valor do veículo deve estar entre 0,01 e 9.999.999,00."`; casas: `"Use no máximo 2 casas decimais."`; não numérico: `"Número inválido."` |
| `valor_entrada` | opcional (omitido → 0); 0,00 a 9.999.999,00; 2 casas; **≤ `valor_veiculo`** (igual é aceito) | `"O valor da entrada deve estar entre 0,00 e 9.999.999,00."`; `"A entrada não pode ser maior que o valor do veículo."`; **`null` → `"Campo obrigatório."`** |
| `taxa_ipca_projetada` | −20 a 100 (% a.a.); 6 casas | `"A taxa de IPCA projetada deve estar entre -20 e 100."`; `"Use no máximo 6 casas decimais."` |
| `taxa_fundo_rendimento` | 0 a 100 (% a.a.); 6 casas | `"A taxa de rendimento do fundo deve estar entre 0 e 100."` |
| `prazo_meses_fundo` | **inteiro JSON** de 1 a 60 | `"O prazo do fundo (em meses) deve estar entre 1 e 60."`; **texto `"12"` e `12.5` → `"Número inteiro inválido."`** |
| qualquer outro | — | `"Campo desconhecido."`; ausente: `"Campo obrigatório."` |

- **Dinheiro e taxas** aceitam número **ou texto numérico**; o **prazo só aceita número JSON** (a SPA envia sempre número).
- `PUT` recusado com `422` em `valor_veiculo` se o novo valor for **menor ou igual** à entrada de alguma opção:
  `"O valor do veículo deve ser maior que a entrada da opção de financiamento \"Banco X\" (R$ 50.000,00). Ajuste a opção antes."`
- `POST` → `201` com `Location` **relativo** (`/api/simulacoes/7`); corpo `{id, nome, valor_veiculo, valor_entrada, taxa_ipca_projetada, taxa_fundo_rendimento, prazo_meses_fundo, criado_em}` (números como `12.0`).
- `GET` da lista → `{itens, total}`, **mais recentes primeiro**; `DELETE` → `204` sem corpo (apaga as opções junto).
- `404` (dono/inexistente): `"Simulação não encontrada"` para ids numéricos (inclusive `0` e acima do `INTEGER`); para ids **não numéricos** (`abc`, `-1`): `"Recurso não encontrado"`. `PUT`/`DELETE` repetido: `404`.

### Desvios dos mocks a corrigir nesta etapa
Comparando com o backend real, os mocks da Etapa 1 diferem em: (1) todas as **mensagens** de `422` da simulação (usam textos genéricos);
(2) o **`Location`** (absoluto; o real é relativo); (3) o **prazo** como texto (o mock o aceita; o real recusa);
(4) `valor_entrada: null` (o real recusa com "Campo obrigatório."); (5) ids **não numéricos** (o mock diz "Simulação não encontrada"; o real, "Recurso não encontrado");
(6) a mensagem do `PUT` contra a entrada de uma opção (o mock é genérica). O teste dos mocks passa a usar como referência literal as
mensagens acima.

### Estrutura criada e alterada
```
src/
  api/simulacoes.js        # listar, obter, criar, atualizar, excluir (sobre o client)
  hooks/
    useSimulacoes.js  useSimulacao.js                  # consultas: ['simulacoes'] e ['simulacoes', id]
    useCriarSimulacao.js  useAtualizarSimulacao.js  useExcluirSimulacao.js   # mutações (invalidam o cache)
  schemas/simulacao.js     # esquema Zod + ÚNICO ponto de conversão camelCase (formulário) <-> snake_case (API)
  components/
    CampoNumerico.jsx      # campo de valor/taxa: texto com vírgula, reformata ao sair (decisão 4)
    CartaoSimulacao.jsx    # cartão do histórico (dados + ações)
    ConfirmarExclusao.jsx  # diálogo de confirmação
    EstadoVazio.jsx  EstadoErro.jsx  EsqueletoLista.jsx     # vazio, erro com "Tentar de novo", carregando
    AvisosProvider.jsx  (decisão 5)                          # Snackbar global reutilizável (useAviso)
  pages/Simulacoes.jsx  pages/SimulacaoForm.jsx             # telas reais (substituem as provisórias)
  utils/errosDeFormulario.js                                 # aceita mapa { campo_da_api: campoDoFormulario }
```

### Histórico (`/simulacoes`)
- Título "Minhas simulações" e botão **Nova simulação**. Consulta `GET /simulacoes` (React Query; a lista já vem do mais recente ao mais antigo, **sem** paginação, ordenação nem filtros).
- **Carregando:** esqueletos dos cartões. **Erro:** mensagem clara com **Tentar de novo** (rede, timeout e `5xx`; `401` é da sessão). **Vazio:** texto e botão "Criar a primeira simulação".
- **Cartão (decisão 1):** nome, valor do veículo, entrada e "Criada em dd/mm/aaaa"; ações **Ver resultado**, **Editar** e **Excluir** (as duas últimas como ícone com nome acessível e dica).
- **Excluir:** diálogo "Excluir a simulação "X"?" com o aviso de que as opções de financiamento dela também serão apagadas e que não há como desfazer; **Cancelar** / **Excluir**
  (desabilitado e "Excluindo…" durante a requisição). Sucesso (`204`): fecha, atualiza a lista e mostra o aviso. `404` (já excluída em outro lugar): trata como sucesso com aviso próprio. Rede/`5xx`: o diálogo continua aberto com o erro e permite tentar de novo.

### Formulário (`/simulacoes/nova` e `/simulacoes/:id/editar`)
- **Campos e rótulos** (as unidades explícitas): *Nome da simulação*; *Valor do veículo (R$)*; *Valor da entrada (R$)*; *Rendimento do fundo (% a.a.)*; *Prazo para juntar o valor (meses)*; *IPCA projetado (% a.a.)*.
  Ajudas curtas com os limites (ex.: "de 0,01 a 9.999.999,00") e para a entrada: "é o valor que você já tem e que rende no fundo".
- **Validação no cliente = backend:** mesmos limites e **mesmas mensagens reais**; entrada **≤** veículo (igual vale); casas decimais **rejeitadas, nunca arredondadas**
  (2 no dinheiro, 6 nas taxas; conta as casas do número, como o backend: `12,5000000` tem 1 casa); prazo inteiro; números lidos com `lerNumero` (pontuação pt-BR estrita: `95.000,50`, `0,85`; `12.5` é inválido).
- **Entrada** (decisão 6): começa em "0,00"; campo vazio vale 0 e o corpo sempre leva `valor_entrada` numérico (o backend recusa `null`).
- **Corpo enviado:** os 6 campos, com `nome` aparado, **dinheiro e taxas como número** e **`prazo_meses_fundo` como número inteiro** (nunca texto); nunca `id`, `usuario_id` nem `criado_em`.
- **Criar:** `POST` → `201`; **editar:** carrega por `GET /simulacoes/:id` (que **não** traz as opções) e envia o corpo **completo** por `PUT`. Erros de `422` (e `400`) vão para o campo certo (`detalhes` mapeados de `snake_case` para o formulário) e o resto para um alerta geral; falha de rede tem mensagem própria; envio desabilitado durante a requisição (sem duplo envio); foco no primeiro campo inválido.
- **Depois de salvar:** criar → edição da nova simulação, com o aviso "Simulação criada." (decisão 2); salvar alterações → continua na edição, com o aviso "Alterações salvas." (decisão 3).
- **Editar, estados:** carregando (esqueleto), `404` ("Simulação não encontrada" com link para o histórico, igual para a de outro usuário), rede/`5xx` (Tentar de novo). Um `404` no `PUT` mostra o mesmo estado.
- Enquanto a Etapa 5 não existe, a tela de edição mostra só o formulário (sem seção de opções).
- **Formatação ao sair do campo** (decisão 4): um valor válido é reescrito no formato pt-BR (`95.000,00`); inválido fica como digitado, com o erro.

### Cache (React Query)
Chaves `['simulacoes']` (lista) e `['simulacoes', id]` (detalhe). Criar e excluir invalidam a lista; atualizar grava o detalhe novo e invalida a lista; excluir remove o detalhe. Depois de sair da sessão o cache é limpo (já é feito na Etapa 2).

### Avisos de sucesso (decisão 5)
"Simulação criada.", "Alterações salvas." e "Simulação excluída." em um Snackbar (`role="status"`), com o `AvisosProvider` reaproveitável pelas Etapas 5 e 8.

### Mocks e testes
- Mocks: mensagens reais, `Location` relativo, prazo só como número, `valor_entrada: null` recusado, ids não numéricos, mensagem do `PUT` contra a opção (com nome e valor), e um atalho de teste para semear simulações.
- `schemas/simulacao`: limites de cada campo com as mensagens reais (nome 0/1/120/121 e só espaços; veículo 0/0,01/9.999.999/10.000.000; entrada −1/veículo/veículo+0,01; IPCA −20,5/−20/100/100,1; fundo −0,1/0/100/100,1; prazo 0/1/60/61/12,5), casas decimais (2 e 6, com `12,5000000` válido), vírgula e milhar, `12.5` inválido, campos vazios, conversão para o corpo (prazo número, nome aparado, entrada vazia → 0) e o caminho de volta (`numeroParaCampo`).
- `api/simulacoes` (ambiente `node`): as cinco funções, `Location` relativo, `204`, `404`, `422` com detalhes.
- `Simulacoes`: carregando, vazio, lista (ordem, valores formatados, data), erro e **Tentar de novo** (controle: com sucesso não aparece), exclusão (confirma, cancela sem chamar, `204`, `404` tratado como sucesso, rede com o diálogo aberto), simulação de **outro usuário não aparece**, links de "Ver resultado" e "Editar".
- `SimulacaoForm`: criar com sucesso (corpo exato), validações no cliente sem chamar a API, `422` por campo (incluindo `valor_veiculo` ≤ entrada de opção), rede, sem duplo envio, foco no primeiro inválido, formatação ao sair, editar (preenchimento, `PUT` completo, `404`, rede) e o destino depois de salvar (decisões 2 e 3).
- `CampoNumerico`, `ConfirmarExclusao`, `EstadoErro`, `EstadoVazio`, `AvisosProvider`, `errosDeFormulario` (mapa) e o teste de contrato dos mocks (mensagens reais). Cada teste de comportamento tem um controle.

### Casos de borda
- **Duas abas / duas pessoas:** simulação excluída em outro lugar: `404` no `PUT`/`GET` mostra "não encontrada"; `404` no `DELETE` conta como excluída.
- **Sessão expira no meio do formulário:** os dados digitados se perdem (aceito; sem rascunho nesta etapa), com o aviso de sessão expirada.
- **Valores extremos:** `9.999.999,99`, `1e999999` digitado (recusado pela leitura), prazo `60`, IPCA negativo (`-20`) e `0`.
- **Entrada igual ao veículo:** aceita (o backend aceita); a mensagem de ajuda não diz "menor que".
- **Número longo demais ou com letras:** mensagem de pontuação, sem quebrar.
- **Nome só com espaços:** tratado como vazio; nome com 120 caracteres passa e 121 não.
- **`PUT` recusado por conta da entrada de uma opção (`422` em `valor_veiculo`):** aparece no campo, com a mensagem do backend (que cita a opção).
- **Excluir com a lista já vazia depois:** volta ao estado vazio.
- **Voltar do navegador** depois de criar: não reenvia o formulário (a navegação usa `replace`).
### Resíduos no banco de desenvolvimento do backend
Para conferir as mensagens reais, esta spec usou uma **terceira conta descartável** (`sonda-<aleatório>@example.com`, senha aleatória já descartada; o backend não exclui usuários). As requisições inválidas não criaram nada e as simulações de teste foram apagadas com `DELETE`, **exceto uma** (a do caso "veículo e entrada iguais"), que **ficou na conta descartável** por descuido. Sem impacto para o app; será registrado no `CLAUDE.md` ao concluir a etapa.

## Decisões em aberto
Resolvidas em 2026-09-26 (decisões do autor):
1. ~~Como mostrar o histórico~~ **Cartões em grade responsiva** (um por linha no celular, 2 a 3 colunas no desktop), com as
   ações sempre visíveis; os esqueletos de carregamento têm o mesmo formato. Sem tabela.

2. ~~Depois de criar a simulação~~ **Ir para a edição dela** (`/simulacoes/:id/editar`, com `replace`, para o Voltar não reenviar o
   formulário), com o aviso "Simulação criada.". É onde as opções de financiamento entram na Etapa 5; até lá a tela
   de edição mostra só o formulário, já preenchido.

3. ~~Depois de salvar alterações~~ **Continuar na edição**, com o aviso "Alterações salvas." e os campos mostrando os valores
   salvos (reformatados). A tela de edição tem sempre visíveis os botões **Ver resultado** (link para
   `/simulacoes/:id/resultado`) e **Voltar ao histórico**. A URL não muda; salvar de novo funciona quantas vezes for preciso.

4. ~~Campos de valor e taxa~~ **Texto com vírgula (`inputMode="decimal"`), lido pelo `lerNumero`, e reescrito no formato pt-BR ao
   sair do campo** (`95000,5` → `95.000,50`; dinheiro sempre com 2 casas; taxas com as casas digitadas, no mínimo 1 e
   sem zeros inúteis; prazo inteiro, sem casas). Um valor **inválido** fica como digitado, com o erro. Sem dependência nova
   (`react-number-format` e `type="number"` foram descartados). O erro de um campo aparece ao sair dele ou ao enviar.

5. ~~Avisos de sucesso~~ **Snackbar global:** um `AvisosProvider` na raiz (dentro do tema, acima do roteador) e o hook `useAviso()`
   com `mostrarAviso(texto)`. Sobrevive à navegação (criar navega para a edição), some sozinho depois de alguns segundos,
   tem botão de fechar, `role="status"`, e mostra um aviso por vez (os seguintes entram em fila). Reaproveitado nas
   Etapas 5 e 8. O `renderizarComAuth` passa a incluir o provedor.

6. ~~Valor da entrada no formulário~~ **Começa em "0,00" e campo vazio vale 0:** ao criar, o campo já vem com `0,00`; se a pessoa o
   apagar, a SPA envia `valor_entrada: 0` (o backend recusa `null`) e nunca mostra "Campo obrigatório." nele. Ao editar,
   mostra o valor salvo. A regra "entrada não pode ser maior que o valor do veículo" (igual é aceito) continua valendo.

Sem decisões em aberto: a spec está pronta para o `/plan`.

## Critérios de aceite
- [x] `npm run lint` (0 avisos), `npm test` e `npm run build` verdes; nenhuma dependência nova.
- [x] **No navegador, contra o backend real:** criar uma simulação, vê-la no histórico (mais recente primeiro), editá-la (dados preenchidos, `PUT` completo), excluí-la com confirmação e ver a lista esvaziar com o estado vazio.
- [x] Cancelar a exclusão não apaga; a exclusão avisa que as opções também serão apagadas; após excluir, o `GET` da simulação dá `404` ("não encontrada").
- [x] `422` do backend aparece no campo certo com a mensagem real (ex.: entrada maior que o veículo; prazo fora de 1 a 60), e a validação do cliente mostra as mesmas mensagens **sem** chamar a API.
- [x] Números: `95.000,50`/`95000,5` valem; `12.5` mostra a mensagem de vírgula; casas em excesso são recusadas (não arredondadas); o prazo vai como **número inteiro** (nunca texto).
- [x] Um `404` por id inexistente (`/simulacoes/999999/editar`) e por simulação de **outro usuário** mostra "Simulação não encontrada", com o mesmo texto; simulações de outra conta **não** aparecem na lista.
- [x] Carregando (esqueleto), erro com **Tentar de novo** (backend parado) e vazio estão implementados e testados; o botão de envio é desabilitado durante a requisição.
- [x] `PUT` e `DELETE` são exercitados pela interface (R1), e os quatro métodos (`GET`, `POST`, `PUT`, `DELETE`) já aparecem nos fluxos.
- [x] Os mocks refletem o backend real nos seis pontos corrigidos, e o teste de contrato confere as mensagens de simulação.
- [x] Conversão `camelCase` ↔ `snake_case` só em `schemas/simulacao.js`; nomes em `PascalCase.jsx`/`camelCase.js`; nenhum `console.log`.
- [x] O `CLAUDE.md` é atualizado (estrutura, contrato real das simulações, mensagens, contagem de testes) e o `plano.md` marca a Etapa 3.

## Plano de Implementação

**Status:** executado em 2026-09-26 (T1 a T18; T19 e T20 são do commit e da confirmação) · **Criado em:** 2026-09-26

São 20 tarefas pequenas, em sete blocos. Cada uma indica **quem executa** (**Claude** ou **Você**), os arquivos, o que muda e como
validar. O código de cada módulo nasce **junto com os seus testes** (`*.test.js(x)` ao lado). Regras para todo o plano:
- O Claude **não** roda `git add`, `commit` nem `push` (os commits são seus).
- Ao fim de cada tarefa que altera código: `npm run lint` (0 avisos) e `npm test` verdes.
- Cada teste de comportamento tem um **controle** (a versão que não deve disparar) que prova que ele pode falhar.
- **Mensagens de erro:** a referência são os literais da tabela "Contrato real observado" desta spec, copiados do backend real
  (lição da Etapa 2: os mocks divergiam nas mensagens e só o teste com literais reais mostra isso).
- **`.gitignore`:** a T18 confere com `git status --ignored` e `git check-ignore -v` que nenhum arquivo novo foi ignorado por engano.
- **Ícones:** só por caminho (`@mui/icons-material/EditOutlined`, `DeleteOutline`, `Add`); a T15 confere no bundle que entram **só** os usados.
- Atualizar/mover **testes existentes** que dependem das telas provisórias (`App.test.jsx`, `telas.test.jsx`) é parte das tarefas que substituem essas telas (T12 e T14).
- Segredos: nada de senha em arquivo; a conta descartável da T16 (senha aleatória, nunca impressa) apaga tudo o que criar.

**Ordem e dependências:** A → B → C → D → E → F → G. A T5 e a T6 usam a T4; a T7 usa `formatar.js` (já existe); a T13 usa T3, T7, T9 e T10; a T14 usa
T5, T6, T8, T10 e T13; a T12 usa T5, T6, T8 e T10 a T11. As tarefas que exigem **você** são a T17 (navegador) e a T19 (commit).

### Bloco A — Mocks e utilitário alinhados ao backend real

**T1 · Claude · Mocks: tipos e mensagens de `422` da simulação**
- Arquivos: `src/mocks/validacao.js`, `src/mocks/handlers/handlers.test.js`.
- O que muda: `validar` passa a: tratar `null` como `"Campo obrigatório."` (só `undefined` cai no valor padrão); exigir **número JSON** no tipo `inteiro` (`"12"` e `12.5` → `"Número inteiro inválido."`); aceitar exponente em texto numérico e cair na mensagem de faixa (`"1e999999"`); usar `"Nome inválido."` para nome que não é texto; e as regras de simulação recebem as **mensagens reais** da tabela (nome 1 a 120, veículo, entrada, IPCA, fundo, prazo, casas).
- Validar: `npm test` com um bloco "simulações: mensagens iguais às do backend real" (uma linha por caso da sonda: nome vazio/só espaços/121/não-texto, veículo 0/−1/10.000.000/95000.123/'abc'/true/null/'1e999999', entrada −1/>veículo/20000.001/null, IPCA −20,5/100,1/12,1234567, fundo −0,1/100,1, prazo 0/61/12.5/'abc'/'12', campo desconhecido); controles: os valores **limite válidos** (mínimos, máximos e texto numérico) dão `201`, e `valor_entrada` **omitido** vale 0; os testes de registro, login e financiamentos continuam verdes.

**T2 · Claude · Mocks: `Location`, ids e o `PUT` contra a entrada de uma opção**
- Arquivos: `src/mocks/handlers/{simulacoes,financiamentos}.js`, `src/mocks/handlers/handlers.test.js`, `src/mocks/contrato.test.js`.
- O que muda: `Location` relativo (`/api/simulacoes/7`, e o mesmo para financiamentos); id **não numérico** (`abc`, `-1`) responde `404 "Recurso não encontrado"` e id numérico inexistente/`0`/acima do `INTEGER` responde `404 "Simulação não encontrada"`; o `PUT` recusado por opção traz a mensagem real com **nome e valor da opção** (`... "Banco X" (R$ 50.000,00). Ajuste a opção antes.`, a primeira opção que conflita).
- Validar: `npm test` atualiza os testes de `Location` (agora relativo) e cobre as duas mensagens de `404`, o `PUT` com a mensagem literal (e o controle: valor acima da entrada é aceito); o teste de contrato confere o `Location` relativo; comparação manual das mensagens com o backend real feita na sonda desta spec.

**T3 · Claude · `errosDeFormulario` aceita um mapa de campos**
- Arquivos: `src/utils/errosDeFormulario.js`, `src/utils/errosDeFormulario.test.js`.
- O que muda: o terceiro argumento pode ser a lista atual **ou** um mapa `{ campo_da_api: campoDoFormulario }` (para `valor_veiculo` → `valorVeiculo`); a lista continua funcionando.
- Validar: `npm test` cobre o mapa (uma chave, várias, chave fora do mapa vira mensagem geral) e mantém verdes todos os testes atuais da lista (controle de compatibilidade); Login e Registro seguem passando.

### Bloco B — Camada de dados

**T4 · Claude · `api/simulacoes.js`**
- Arquivos: `src/api/simulacoes.js`, `src/api/simulacoes.test.js`.
- O que muda: `listar({ signal })`, `obter(id, { signal })`, `criar(corpo)`, `atualizar(id, corpo)` e `excluir(id)` sobre o client (`get`, `post`, `put`, `remover`), sem lógica de negócio.
- Validar: `npm test` (ambiente `node`, MSW): a lista vem no envelope e do mais recente ao mais antigo; `criar` devolve o objeto (`201`) e o corpo enviado é **exatamente** o recebido; `atualizar` envia o corpo completo; `excluir` devolve `null` (`204`, sem `.json()`); `404` (dono e inexistente com a mesma mensagem), `422` com `detalhes` e `401` (chama o `aoExpirar`, controle: `404` não chama).

**T5 · Claude · Hooks de consulta**
- Arquivos: `src/hooks/{chavesSimulacoes,useSimulacoes,useSimulacao}.js`, testes ao lado, `src/testUtils.jsx`.
- O que muda: as chaves (`['simulacoes']` e `['simulacoes', String(id)]`), a consulta da lista, a do detalhe (`enabled` só com `id`) e `renderizarHookComAuth` no `testUtils` (provedores + sessão de teste).
- Validar: `npm test` com `renderHook`: carrega a lista; erro `503` deixa `isError`; o detalhe `404` **não repete** (uma só chamada; controle: `503` repete uma vez, pela política do `queryClient`); o `signal` cancela; sem sessão o token não é enviado.

**T6 · Claude · Hooks de mutação (com o cache)**
- Arquivos: `src/hooks/{useCriarSimulacao,useAtualizarSimulacao,useExcluirSimulacao}.js`, testes ao lado.
- O que muda: **criar** grava o detalhe novo e invalida só a lista (`exact`); **atualizar** grava o detalhe e invalida a lista; **excluir** remove o detalhe e invalida a lista, e um `404` no `DELETE` conta como sucesso (`{ jaExcluida: true }`); nenhuma repete.
- Validar: `npm test`: depois de criar, a lista buscada de novo traz a simulação e o detalhe já está em cache (sem nova chamada); depois de atualizar o detalhe reflete o `PUT`; depois de excluir o detalhe some do cache e a lista é atualizada; `404` no `DELETE` devolve `jaExcluida: true` e limpa o cache; rede fora do ar sobe o erro e **não** mexe no cache (controle).

### Bloco C — Esquema do formulário

**T7 · Claude · `schemas/simulacao.js`**
- Arquivos: `src/schemas/simulacao.js`, `src/schemas/simulacao.test.js`.
- O que muda: o esquema Zod do formulário (campos em texto: `nome`, `valorVeiculo`, `valorEntrada`, `taxaIpcaProjetada`, `taxaFundoRendimento`, `prazoMesesFundo`) com as **mensagens reais**, leitura por `lerNumero`, casas contadas pelo número (`12,5000000` vale), entrada vazia → 0, entrada **≤** veículo (igual vale, erro no campo da entrada) e prazo inteiro; e o **único ponto de conversão**: `valoresIniciais()` (entrada `"0,00"`), `paraCorpoDaApi(valores)` (dinheiro e taxas como número, **prazo como número inteiro**, nome aparado, nunca `id`/`usuario_id`/`criado_em`), `deSimulacaoParaForm(simulacao)` (via `numeroParaCampo`/formato pt-BR) e o mapa `CAMPOS_DA_API`.
- Validar: `npm test` com as tabelas de limites da spec (nome 0/1/120/121 e só espaços; veículo 0/0,01/9.999.999/10.000.000; entrada −1/veículo/veículo+0,01; IPCA −20,5/−20/100/100,1; fundo −0,1/0/100/100,1; prazo 0/1/60/61/12,5), casas (2 e 6), `95.000,50` e `12.5`, vazios, entrada vazia → 0 no corpo, ida e volta `deSimulacaoParaForm` → `paraCorpoDaApi` devolve os mesmos números, e o corpo nunca tem chaves extras; controle: dados válidos passam.

### Bloco D — Componentes reutilizáveis

**T8 · Claude · `AvisosProvider` e `useAviso`**
- Arquivos: `src/avisos/{contextoAvisos.js,AvisosProvider.jsx,useAviso.js}` (+ testes), `src/Raiz.jsx`, `src/testUtils.jsx`.
- O que muda: Snackbar global com `mostrarAviso(texto)`, `role="status"`, botão de fechar, some sozinho e mostra um aviso por vez (fila); o provedor entra na `Raiz` (dentro do tema, acima do roteador) e no `renderizar`/`renderizarComAuth`.
- Validar: `npm test`: o aviso aparece e some (relógios falsos), fecha pelo botão, dois avisos seguidos entram em fila (o segundo só depois do primeiro), sobrevive à troca de rota (renderizando um roteador de teste), `useAviso` fora do provedor lança erro claro; `Raiz` continua verde.

**T9 · Claude · `CampoNumerico`**
- Arquivos: `src/components/CampoNumerico.jsx`, `src/components/CampoNumerico.test.jsx`.
- O que muda: campo de valor/taxa/inteiro sobre o React Hook Form (`useController`): texto com `inputMode="decimal"` (`numeric` no inteiro), e **ao sair** reescreve um valor válido (dinheiro `95.000,50` com 2 casas; taxa por `numeroParaCampo`, sem zeros inúteis; inteiro sem casas) **só se as casas couberem** (nunca arredonda); inválido ou vazio fica como digitado; mostra o erro do campo.
- Validar: `npm test` com um formulário de teste: `95000,5` → `95.000,50`, `0` → `0,00`, taxa `12,50` → `12,5` e `0,850000` → `0,85`, prazo `36` → `36`; **`0,123` no dinheiro (3 casas) NÃO é reescrito** (o erro fica para o esquema); `12.5`, `abc` e vazio ficam como digitados; o rótulo, a ajuda e o erro aparecem e o foco por `setFocus` funciona (assíncrono).

**T10 · Claude · Estados: vazio, erro e carregando**
- Arquivos: `src/components/{EstadoVazio,EstadoErro,EsqueletoLista}.jsx` e testes ao lado.
- O que muda: `EstadoVazio` (texto e botão de ação), `EstadoErro` (título, mensagem e **Tentar de novo**), `EsqueletoLista` (esqueletos com o formato dos cartões).
- Validar: `npm test`: cada componente renderiza seus textos e chama a ação; o esqueleto tem `aria-busy` e não expõe conteúdo falso; controle: `EstadoErro` sem `aoTentarNovamente` não mostra o botão.

**T11 · Claude · `CartaoSimulacao` e `ConfirmarExclusao`**
- Arquivos: `src/components/{CartaoSimulacao,ConfirmarExclusao}.jsx` e testes ao lado.
- O que muda: o cartão (nome, valor do veículo, entrada e "Criada em dd/mm/aaaa"; **Ver resultado** e **Editar** como links, **Excluir** como botão, com ícones `EditOutlined`/`DeleteOutline`, nome acessível e dica) e o diálogo de confirmação (nome da simulação, aviso de que as opções também são apagadas e que não há como desfazer, **Cancelar**/**Excluir**, "Excluindo…" desabilitado e um alerta de erro).
- Validar: `npm test`: valores formatados em reais (`R$ 95.000,00`) e a data; os links apontam para `/simulacoes/:id/resultado` e `/simulacoes/:id/editar`; os botões têm nomes acessíveis com o nome da simulação; o diálogo chama `aoCancelar` sem confirmar, desabilita os botões durante a requisição e mostra o erro (controle: fechado não renderiza).

### Bloco E — Telas

**T12 · Claude · Tela do histórico**
- Arquivos: `src/pages/Simulacoes.jsx`, `src/pages/Simulacoes.test.jsx`, `src/pages/telas.test.jsx`, `src/App.test.jsx`.
- O que muda: substitui a tela provisória: título e **Nova simulação**; carregando (esqueletos), erro com **Tentar de novo**, vazio com **Criar a primeira simulação** e a grade de cartões (do mais recente ao mais antigo, sem paginação nem filtros); excluir com confirmação, aviso ("Simulação excluída."; se `jaExcluida`, aviso próprio), lista atualizada e volta ao estado vazio; os testes existentes que listavam `Simulacoes` como provisória são ajustados.
- Validar: `npm test` (`renderizarComAuth`): carregando → lista (ordem, valores, data, links); vazio; erro `503` e **Tentar de novo** com o backend de volta (controle: com sucesso o erro não aparece); simulação de **outro usuário não aparece**; excluir: cancelar **não chama** a API, `204` some o cartão e mostra o aviso, `404` é tratado como sucesso, rede fora do ar mantém o diálogo aberto com o erro, e excluir a última mostra o vazio; `App.test` e `telas.test` verdes; `npm run build` verde.

**T13 · Claude · `FormularioSimulacao`**
- Arquivos: `src/components/FormularioSimulacao.jsx`, `src/components/FormularioSimulacao.test.jsx`.
- O que muda: o formulário compartilhado (React Hook Form + Zod + `CampoNumerico`): seis campos com os rótulos e as ajudas da spec (unidades explícitas), botão de envio desabilitado durante a requisição, `422`/`400` mapeados por `CAMPOS_DA_API`, alerta geral para o resto e para a rede, foco no primeiro campo inválido e `reset` com os valores salvos após o sucesso; recebe `valoresIniciais`, `aoEnviar(corpo)` e o texto do botão.
- Validar: `npm test`: cada validação do cliente mostra a mensagem **real** e **não chama** o `aoEnviar`; entrada vazia envia `valor_entrada: 0`; o corpo tem os seis campos, prazo **número**; `422` do servidor vai ao campo certo (inclusive `valor_veiculo` com a mensagem da opção); rede fora do ar mostra o alerta e o botão volta; duplo envio (clique forçado e Enter) faz **uma** chamada; ao salvar, os campos mostram os valores reformatados; controle: dados válidos chamam `aoEnviar` uma vez.

**T14 · Claude · Tela de criar e editar**
- Arquivos: `src/pages/SimulacaoForm.jsx`, `src/pages/SimulacaoForm.test.jsx`, `src/pages/telas.test.jsx`, `src/App.test.jsx`.
- O que muda: `/simulacoes/nova` (formulário com `valoresIniciais()`; `POST`; sucesso → **`/simulacoes/:id/editar` com `replace`** e o aviso "Simulação criada.") e `/simulacoes/:id/editar` (`GET` por id; formulário preenchido; `PUT` completo; sucesso → **continua na tela** com "Alterações salvas."; botões **Ver resultado** e **Voltar ao histórico** sempre visíveis; estados: esqueleto, `404` "Simulação não encontrada" com link ao histórico, rede/`5xx` com **Tentar de novo**); os testes existentes são ajustados (a edição de `/simulacoes/1/editar` agora precisa da simulação semeada ou cai em `404`).
- Validar: `npm test`: criar navega para a edição da nova simulação (URL com o `id`, aviso, campos preenchidos, e o **Voltar** não reenvia: a navegação é `replace`); editar carrega, altera, salva e permanece (URL igual, aviso, valores reformatados) com o corpo **completo** no `PUT`; `404` para inexistente e para simulação de **outra pessoa** com o **mesmo** texto; um `404` no `PUT` mostra o mesmo estado; rede fora do ar na carga mostra **Tentar de novo**; os links **Ver resultado** e **Voltar ao histórico** apontam certo; `App.test` e `telas.test` verdes; `npm run lint` e `npm run build` verdes.

### Bloco F — Verificação e fechamento

**T15 · Claude · Verificação completa**
- Arquivos: nenhum (só leitura, salvo correções).
- O que muda: rodo tudo de ponta a ponta.
- Validar: `lint` com 0 avisos; `npm test` verde (registro a contagem); `npm run build` sem avisos e o tamanho do bundle; `npm ls --all` sem problemas; por *sourcemap*, **só** os ícones usados entram (`Visibility`, `VisibilityOff`, `EditOutlined`, `DeleteOutline`, `Add`); nenhum `console.log`, `EmConstrucao` nas duas telas substituídas, nem senha ou token fixo no `src/` além das senhas fictícias dos testes; `grep` no `dist/` sem dados de teste.

**T16 · Claude · Verificação por linha de comando com o backend real**
- Arquivos: nenhum.
- O que muda: só verificação; subo o `dev` e uso uma **conta descartável nova** (senha aleatória, nunca impressa) que **apaga tudo o que criar**.
- Validar: as rotas `/simulacoes`, `/simulacoes/nova` e `/simulacoes/1/editar` respondem `200` (fallback de SPA); comparo automaticamente o backend **real** com os literais dos testes (mensagens de `422`, `Location` relativo, `404` dos dois tipos, `PUT` contra a opção); crio, edito e excluo uma simulação pelas mesmas formas de corpo que a SPA envia (prazo **número**) e confirmo `201`/`200`/`204`; a conta fica sem simulações no fim (a conta em si permanece: o backend não exclui usuários).

**T17 · Você · Verificação no navegador**
- Arquivos: nenhum.
- O que muda: com `npm run dev` (eu subo) e o backend no ar, você abre `http://localhost:5173`, entra, e confere com o console aberto (F12):
  1. **Vazio:** em `/simulacoes` sem simulações aparece o estado vazio com **Criar a primeira simulação** (se sua conta já tiver simulações, veja o vazio no fim, depois de excluir todas).
  2. **Nova simulação:** a entrada já vem `0,00`; digite `95000,5` no veículo e saia do campo: vira `95.000,50`. Preencha IPCA `4,5`, rendimento `12`, prazo `36`, nome "Onix", e salve: vai a `/simulacoes/N/editar` com "Simulação criada." e os campos preenchidos; o botão Voltar do navegador **não** recria a simulação.
  3. **Validação (as mesmas mensagens do backend, sem chamar a API):** veículo `0`, entrada maior que o veículo, prazo `61` e `12,5`, IPCA `-21` e `101`, e `12.5` (com ponto) em uma taxa: a mensagem aparece junto ao campo e o foco vai para o primeiro inválido; entrada apagada vale 0.
  4. **Editar:** altere o valor do veículo e salve: continua na tela com "Alterações salvas.", valores reformatados; **Ver resultado** e **Voltar ao histórico** funcionam.
  5. **Histórico:** as simulações aparecem em cartões, a mais recente primeiro, com valores em reais e a data; redimensione a janela para largura de celular: os cartões empilham e as ações continuam visíveis.
  6. **Excluir:** **Cancelar** não apaga; **Excluir** apaga, mostra "Simulação excluída." e o cartão some; excluir a última mostra o vazio.
  7. **404:** `/simulacoes/999999/editar` mostra "Simulação não encontrada" com o link ao histórico.
  8. **Outra conta:** registre uma segunda conta; ela não vê as simulações da primeira, e abrir a URL de edição de uma simulação da primeira dá o mesmo "Simulação não encontrada".
  9. **Backend parado** (peça para eu parar o backend, e recarregue `/simulacoes`): aparece o erro com **Tentar de novo**; religue (peça para eu religar) e clique: a lista volta.
- Validar: você me diz o resultado de cada item; qualquer falha vira correção antes da T18.

**T18 · Claude · Registrar a conclusão da etapa**
- Arquivos: `CLAUDE.md`, `plano.md` (Etapa 3), esta spec.
- O que muda: `CLAUDE.md` (estrutura com `api/simulacoes.js`, hooks, `schemas/simulacao.js`, `avisos/`, `CampoNumerico` e os componentes novos; contrato real das simulações com as mensagens e as regras do prazo e da entrada; o padrão `useAviso`; contagem de testes; a conta descartável e a simulação que ficou nela); `plano.md` marca a Etapa 3 com "Validado" e notas; a spec passa a "Concluída" com os critérios marcados.
- Validar: releitura dos três arquivos; `git status --ignored --short` e `git check-ignore -v` nas pastas novas (`src/avisos/`, `src/hooks/`, `src/schemas/`) confirmam que **nada** foi ignorado por engano e que nada proibido (`node_modules/`, `dist/`, `.env`, `CLAUDE.md`, `api/`) é publicável.

**T19 · Você · Commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica. Sugestão: `git add .`, `git status`, `git commit` e `git push`.
- Validar: `git status` limpo; push sem erro.

**T20 · Claude · Confirmar a publicação, do zero**
- Arquivos: nenhum.
- O que muda: só verificação; clono o repositório público numa pasta limpa.
- Validar: o número de arquivos rastreados no GitHub bate com o do disco; `npm ci`, `npm ls`, `lint` (0 avisos), `npm test` e `npm run build` verdes no clone; a listagem do GitHub tem `src/avisos/` e os componentes novos e não tem `node_modules`, `dist`, `.env`, `CLAUDE.md`, `api` nem `.claude`.

### Mapa dos critérios de aceite
| Critério | Tarefas |
|---|---|
| `lint`, `test` e `build` verdes; nenhuma dependência nova | T15, T20 |
| Criar, listar (mais recente primeiro), editar e excluir com confirmação e vazio, contra o backend real | T12, T14, T16, T17 |
| Cancelar não apaga; aviso das opções; `GET` depois de excluir dá `404` | T11, T12, T16, T17 |
| `422` no campo com a mensagem real; validação do cliente igual e sem chamar a API | T1, T2, T7, T13, T16, T17 |
| Números (`95.000,50`, `12.5`, casas em excesso, prazo inteiro como número) | T7, T9, T13, T16 |
| `404` por id inexistente e por simulação de outro usuário, com o mesmo texto; lista isolada | T2, T12, T14, T17 |
| Carregando, erro com Tentar de novo e vazio; envio desabilitado durante a requisição | T10, T12, T13, T14, T17 |
| `PUT` e `DELETE` pela interface (R1) | T14, T12, T16, T17 |
| Mocks iguais ao backend real e teste de contrato com as mensagens | T1, T2 |
| Conversão `camelCase` ↔ `snake_case` só em `schemas/simulacao.js`; nomes e `console.log` | T7, T15, T18 |
| `CLAUDE.md` e `plano.md` atualizados | T18 |

### Riscos
- **React Hook Form + campo reformatado ao sair:** o `CampoNumerico` usa `useController` (`onChange` com o texto reformatado) e o `reset` depois de salvar; a T9 e a T13 cobrem a interação e o `setFocus` **assíncrono**.
- **Casas decimais:** reformatar só quando as casas cabem, para nunca arredondar em silêncio (o esquema mostra o erro); teste dedicado na T9.
- **Cache e navegação:** `criar` grava o detalhe e invalida só a lista (`exact`); com o prefixo inteiro a edição recém-aberta faria uma busca à toa; a T6 tem teste.
- **Duas navegações competindo** (lição da Etapa 2): criar navega uma vez, com `replace`; o aviso vive no `AvisosProvider` (não no estado da rota); a T14 confere URL e aviso.
- **Diálogo do MUI nos testes:** o foco preso e o `aria-hidden` do resto da página exigem consultas por papel dentro do diálogo; as atualizações fora de `act` viram erro pela trava de `console.error`.
- **Prazo como texto:** o backend só aceita **número** no prazo; a T7 garante o número e a T16 confirma contra o backend real.
- **Testes existentes:** `App.test.jsx` e `telas.test.jsx` assumem as telas provisórias; são ajustados nas tarefas que as substituem (T12 e T14).
- **Tamanho:** 20 tarefas; a T13 e a T14 são as maiores. Se preferir, executo por bloco e paro para a sua revisão ao fim de cada um.

---
*Plano aguardando aprovação. Nenhuma tarefa foi executada.*

### Registro da execução (2026-09-26)
- **Resultado:** 830 testes em 39 arquivos (estáveis em 3 execuções seguidas), `lint` sem avisos, `build` de 726 kB (229 kB gzip); exatamente 5 ícones do `@mui/icons-material` no bundle (`Add`, `DeleteOutlined`, `EditOutlined`, `Visibility`, `VisibilityOff`); nenhuma dependência nova; nenhum dado de teste no `dist/`.
- **Desvios do plano:** (1) o ícone se chama `DeleteOutlined` (não `DeleteOutline`) nesta versão do pacote; (2) `AvisosProvider` ganhou a propriedade `duracao` (padrão 5 s) porque o `Snackbar` do MUI não se comporta sob relógio falso e os testes usam relógio real com duração curta; (3) o `CampoNumerico` ganhou `depende` (revalidação cruzada da entrada quando o veículo muda), não prevista; (4) `renderizarHookComAuth` liga o token direto no client, sem `AuthProvider`, para não gerar avisos de `act` do `/perfil`; (5) `utils/mensagemDeErro.js` e `dinheiroParaCampo`/`casasDecimais` em `formatar.js` foram criados para compartilhar regras entre telas e esquema; (6) os testes dos três estados da lista ficaram em um só arquivo (`estadosDaLista.test.jsx`).
- **Bugs achados pelos testes:** (a) o `CampoNumerico` chamava `onBlur` antes de `onChange` ao reformatar e o React Hook Form **descartava** o resultado da validação por o valor ter mudado durante ela (o erro de "0" → "0,00" nunca aparecia); corrigido invertendo a ordem; (b) a captura de `useAuth` por `useEffect` nos testes da Etapa 2 deixava uma janela em que o teste lia a captura antes do efeito (falha intermitente sob carga); a espera passou a conferir a captura.
- **Verificação automática com o backend real (T16):** 27 casos gerados pelo **código real** do cliente (`esquemaSimulacao` e `paraCorpoDaApi`), enviados ao backend real com uma conta descartável: a mensagem do cliente é idêntica à do backend em todos os casos recusados, e os aceitos deram `201`; `Location` relativo, os dois `404`, a mensagem do `PUT` contra a opção e a entrada vazia → 0 confirmados. A conta terminou com 0 simulações.
- **Verificação no navegador (T17, pelo autor):** os 9 itens passaram.
- **Resíduos:** a conta `sonda-...` da exploração ficou com 1 simulação (descuido); a da T16 foi limpa. O backend não exclui usuários.

