# Opções de financiamento (Etapa 5) — Spec

**Criado em:** 2026-09-26
**Status:** Concluída em 2026-09-27 (decisões 1 a 4 resolvidas em 2026-09-26; plano executado, T1 a T14)
**Etapa do plano:** 5 (`plano.md`) · **Requisito:** R1 (`POST`, `PUT` e `DELETE` também pelas opções), R4 (feedback visual)

## Problema
A simulação só é útil se puder ser comparada com **financiamentos**: o segundo cenário do produto (2 ou 3 opções, Price e SAC). Hoje a tela de
edição (`/simulacoes/:id/editar`) só cuida dos dados do veículo e do fundo; o botão **Ver resultado** leva a uma tela provisória e não há como
cadastrar, alterar ou excluir uma opção de financiamento pela interface. O backend já oferece as quatro rotas e o frontend ainda não as usa.

## Objetivo
Na edição de uma simulação, permitir **listar, adicionar, editar e excluir** as opções de financiamento (até 3), com validação igual à do backend,
mensagens de erro junto ao campo, estados de carregando/erro/vazio e as regras de estado do backend (limite de 3, entrada menor que o veículo) explicadas
com clareza. Deixar a simulação pronta para a Etapa 6 (resultado) e a 7 (amortização).

## Fora de escopo
- Cálculo de qualquer valor financeiro (parcela, valor financiado, juros, totais): tudo isso vem de `/resultado` e `/parcelas` (**Etapas 6 e 7**). A lista de opções
  mostra só o que a API devolve (`nome`, `sistema_amortizacao`, `taxa_juros_mensal`, `prazo_meses`, `valor_entrada`); **não** mostra "valor financiado" nem "parcela",
  que a API só entrega no resultado (e o frontend não calcula).
- Tela de resultado e de amortização (Etapas 6 e 7); os links **Ver resultado** e "abrir parcelas" só passam a existir quando essas telas existirem.
- Duplicar opção, reordenar, arrastar e soltar, comparar opções lado a lado nesta tela.
- Pré-preencher as taxas do financiamento com dados de mercado (o backend só tem CDI e IPCA).
- Alterações no repositório do backend.

## Proposta

### O que foi verificado (estado atual)
| Item | Situação |
|---|---|
| Tela de edição | `EditarSimulacao` (`pages/SimulacaoForm.jsx`) mostra só o `FormularioSimulacao` e as ações **Ver resultado** e **Voltar ao histórico**; o `PUT` da simulação já trata o `422` em `valor_veiculo` por causa da entrada de uma opção (Etapa 3) |
| Mocks | `mocks/handlers/financiamentos.js` já implementa as 4 rotas (dono → corpo → estado, limite de 3, entrada < veículo), mas com **mensagens aproximadas** (ver "Desvios dos mocks") |
| Reaproveitável | `CampoNumerico` (`dinheiro`, `taxa`, `inteiro`), `aplicarErrosDoServidor` (mapa de campos), `ConfirmarExclusao` (hoje com texto de simulação), `EstadoErro`/`EstadoVazio`/`EsqueletoLista`, `useAviso`, o padrão de cartões do histórico, os 5 ícones já em uso (`Add`, `EditOutlined`, `DeleteOutlined`, `Visibility`, `VisibilityOff`) |
| Dependências | tudo instalado; **nenhuma dependência nova e nenhum ícone novo** |
| Backend | no ar; contrato conferido abaixo com uma conta descartável nova (54 chamadas) |

### Contrato real observado (backend, 2026-09-26)
Rotas (todas com JWT): `GET` e `POST /api/simulacoes/:id/financiamentos`, `PUT` e `DELETE /api/simulacoes/:id/financiamentos/:fid`. `GET` de **uma** opção não existe
(`405 "Método não permitido"`). Corpo da opção (`POST` e `PUT`, mesmo corpo; o `PUT` substitui tudo): `nome`, `taxa_juros_mensal`, `prazo_meses`, `sistema_amortizacao`, `valor_entrada`.
A resposta (e cada item da lista) traz `id, nome, prazo_meses, sistema_amortizacao, taxa_juros_mensal, valor_entrada` (**sem** `valor_financiado`), com `taxa` e `valor_entrada` como número JSON.

| Situação | Resposta real |
|---|---|
| `POST` válido | `201`, `Location` **relativo** (`/api/simulacoes/27/financiamentos/7`), corpo da opção |
| `GET` lista | `200 {"itens": [...], "total": N}`, **em ordem de criação** |
| `sistema_amortizacao` em minúsculas (`"sac"`, `"Sac"`) | aceito; devolve **maiúsculas** (`SAC`) |
| taxa como texto (`"2.5"`) | aceita (número **ou** texto numérico) |
| `valor_entrada` omitido | vale `0` (no `PUT` também: **volta a 0**); `valor_entrada: null` → `422 "Campo obrigatório."` (a SPA sempre envia um número) |
| `taxa_juros_mensal` = 20 | aceita (limite); `-0,01` e `20,01` → `"A taxa de juros mensal deve estar entre 0 e 20."`; 7 casas → `"Use no máximo 6 casas decimais."`; `"abc"` → `"Número inválido."` |
| `prazo_meses` | 0 e 73 → `"O prazo (em meses) deve estar entre 1 e 72."`; **texto** (`"48"`) e `12,5` → `"Número inteiro inválido."` (só número inteiro JSON) |
| `sistema_amortizacao` inválido, vazio ou número | `"Sistema de amortização inválido. Use PRICE ou SAC."` |
| `nome` | vazio ou 121 → `"O nome deve ter entre 1 e 120 caracteres."`; não-texto → `"Nome inválido."` |
| `valor_entrada` | −1 ou > 9.999.999 → `"O valor da entrada deve estar entre 0,00 e 9.999.999,00."`; 3 casas → `"Use no máximo 2 casas decimais."` |
| **entrada ≥ valor do veículo** | `"A entrada deve ser menor que o valor do veículo (R$ 95.000,00); com a entrada igual ao valor não há o que financiar."` (chave `valor_entrada`; vale para igual **e** para maior; a **faixa** vem antes desta regra) |
| campos ausentes (`{}`) | `"Campo obrigatório."` em `nome`, `prazo_meses`, `sistema_amortizacao` e `taxa_juros_mensal` (a entrada é opcional) |
| campo desconhecido (`extra`, `usuario_id`) | `"Campo desconhecido."` |
| 4ª opção (válida) | `409 "Uma simulação aceita no máximo 3 opções de financiamento"` (sem `detalhes`) |
| 4ª opção **inválida** | `422` (a validação vem **antes** do `409`) |
| opção inexistente ou de id `0` (`PUT`/`DELETE`) | `404 "Opção de financiamento não encontrada"`; id não numérico (`abc`) → `404 "Recurso não encontrado"` |
| `PUT` de opção inexistente com corpo inválido | `404` (o dono/recurso vem antes do corpo) |
| simulação inexistente, de outra pessoa ou `0` | `404 "Simulação não encontrada"` (`abc` → `"Recurso não encontrado"`) |
| `DELETE` | `204` sem corpo |
| `PUT /simulacoes/:id` com veículo ≤ entrada de uma opção | `422` em `valor_veiculo`: `"O valor do veículo deve ser maior que a entrada da opção de financiamento \"limite20\" (R$ 10.000,00). Ajuste a opção antes."` (já tratado na Etapa 3) |
| corpo `[]`, `null`, vazio ou JSON inválido | `400 "Corpo da requisição deve ser um objeto JSON"` (a **mesma** mensagem nos quatro casos) |
| `Content-Type` que não é JSON (ou ausente) | `415 "Tipo de conteúdo não suportado"` |

### Desvios dos mocks a corrigir nesta etapa
Repetida a mesma sequência de 54 chamadas contra os mocks, **17 respostas diferem**; o resto (status, `Location`, ordem dos erros, 409, 404, lista em ordem de criação) é igual:
1. **Mensagens de 422 da opção** (13 casos): o mock usa textos curtos ("Deve estar entre 0 e 20.", "Deve ter entre 1 e 120 caracteres.", "Deve ser um texto.", "O sistema de amortização deve ser PRICE ou SAC.",
   "Deve estar entre 0 e 9999999.") no lugar das mensagens reais da tabela acima. Passam a ser as reais (a mensagem do prazo e a da taxa mensal são próprias da opção).
2. **400 e 415 do corpo** (compartilhados por todos os handlers: auth, simulações e opções): o mock diz `"JSON inválido"` e `"O corpo da requisição deve ser um objeto JSON"` (400) e
   `"O corpo da requisição deve ser JSON (Content-Type: application/json)"` (415); o real diz `"Corpo da requisição deve ser um objeto JSON"` (400, sempre) e `"Tipo de conteúdo não suportado"` (415).
3. **`GET` de uma opção só**: o mock não tem handler (o teste cai em "requisição sem handler"); o real responde `405 {"erro": "Método não permitido"}`.
Nenhum teste atual depende das mensagens antigas (conferido por busca). O teste dos mocks passa a usar os literais reais como referência (não os handlers).

### Estrutura criada e alterada
```
src/
  api/financiamentos.js            # listar, criar, atualizar, excluir (corpo em snake_case; sobre o client)
  hooks/chavesSimulacoes.js        # + financiamentos(id) = ['simulacoes', String(id), 'financiamentos'] e resultado(id), reservado para a Etapa 6
  hooks/useFinanciamentos.js       # a lista de uma simulação (staleTime padrão)
  hooks/useCriarFinanciamento.js   # POST: acrescenta ao cache da lista; sem repetição
  hooks/useAtualizarFinanciamento.js # PUT: troca a opção no cache; 404 = já não existe
  hooks/useExcluirFinanciamento.js # DELETE: tira do cache; 404 conta como sucesso
  schemas/financiamento.js         # esquema (Zod, mensagens reais; recebe o valor do veículo), paraCorpoDaApi, deFinanciamentoParaForm, CAMPOS_DA_API
  components/
    SecaoFinanciamentos.jsx        # a seção da tela: título, texto de apoio, botão Adicionar, avisos, estados e a lista
    CartaoFinanciamento.jsx        # uma opção (dados e ações Editar e Excluir)
    FormularioFinanciamento.jsx    # o diálogo (modal) com os 5 campos e o envio, para adicionar e para editar
    ConfirmarExclusao.jsx          # passa a receber título e texto (hoje é só de simulação)
  pages/SimulacaoForm.jsx          # EditarSimulacao mostra a seção depois do formulário da simulação
  utils/formatar.js                # rótulo do sistema ("Price", "SAC"), se preciso
  mocks/                           # os 3 ajustes acima
```
Os nomes previstos no `plano.md` (`ListaFinanciamentos`, `FormFinanciamento`, `useSalvarFinanciamento`) mudam para os acima, como na Etapa 4.

### Comportamento
- **Onde:** só na **edição** (`/simulacoes/:id/editar`). Na criação a pessoa não vê a seção: o `POST` da simulação leva à edição da nova (Etapa 3), que é onde as opções passam a caber (elas precisam do `id`).
- **Seção "Opções de financiamento"** (abaixo do formulário da simulação, em coluna única; cartões em grade; cadastro e edição em diálogo): explica em uma frase que compara-se a compra à vista, o financiamento e o fundo, e que **cada opção é salva na hora** (não depende do botão "Salvar alterações" da simulação).
- **Lista:** `GET /simulacoes/:id/financiamentos`, em ordem de criação, **independente** do formulário da simulação: se a lista falhar, a simulação continua editável (e o contrário). Cada opção mostra nome, sistema (Price ou SAC), taxa **"1,50% a.m."**, prazo **"48 meses"** e entrada; ações **Editar** e **Excluir**.
- **Estados:** carregando (esqueleto), erro (rede/5xx: mensagem clara e **Tentar de novo**, só da lista) e vazio ("Nenhuma opção ainda", com o botão de adicionar).
- **Incentivar 2 ou 3 opções:** com 0 ou 1 opção, um aviso informativo discreto ("Adicione ao menos 2 opções para comparar financiamentos"); **não bloqueia** nada: o backend aceita 0 a 3 e **Ver resultado** continua habilitado.
- **Limite de 3:** com 3 opções, o botão **Adicionar opção** fica desabilitado e o texto explica "Limite de 3 opções: exclua uma para adicionar outra". Se, mesmo assim, o `POST` der `409` (outra aba adicionou), o formulário mostra a mensagem do backend com a orientação e **atualiza a lista**.
- **Formulário da opção** (5 campos, React Hook Form + Zod com as mensagens reais): `nome` (1–120), `taxa_juros_mensal` (0 a 20, **% a.m.**, 6 casas), `prazo_meses` (inteiro 1–72), `sistema_amortizacao` (escolha entre **Price** e **SAC**; ver a decisão 3) e `valor_entrada` (0,00 a 9.999.999,00, **menor que o valor do veículo**, vazio vale 0).
  A regra "entrada < veículo" usa o valor do veículo **salvo** da simulação (o do servidor, não o que está digitado e ainda não salvo), e a ajuda do campo mostra esse valor.
- **Enviar:** o botão fica desabilitado durante o envio ("Salvando…"); erros de campo (`detalhes`) vão **ao campo**, o foco vai ao primeiro campo com erro, e erro sem campo (`409`, rede) aparece como aviso no próprio formulário, com os dados mantidos.
  Sucesso: fecha o formulário, atualiza a lista **sem recarregar** e mostra "Opção adicionada.", "Opção salva." ou "Opção excluída.".
- **Excluir:** confirmação (título com o nome da opção), `DELETE` (204 sem `.json()`); `404` conta como sucesso ("já tinha sido excluída"). Excluir uma opção libera vaga se havia 3.
- **Editar:** o formulário abre preenchido com o formato dos campos (`1,5`, `48`, `10.000,00`); o `PUT` leva o corpo **completo**. Um `404` (excluída em outra aba) fecha o formulário, atualiza a lista e avisa "Esta opção não existe mais.".
- **Cache:** lista em `['simulacoes', id, 'financiamentos']`; criar, editar e excluir **atualizam o cache com o que o servidor devolveu** (sem novo `GET`) e invalidam `['simulacoes', id, 'resultado']` (o resultado de uma simulação depende das opções; a chave só passa a ter dados na Etapa 6). Excluir a simulação já remove tudo o que começa com `['simulacoes', id]`.
- **Sessão:** um `401` segue o fluxo da Etapa 2 (uma só saída para o login).
- **Acessibilidade:** o diálogo tem título e foco inicial no primeiro campo; as ações têm nome com o da opção ("Editar opção Banco A"); o sistema é um grupo de botões de escolha com nome de grupo ("Sistema de amortização"); a validação não depende só de cor.

### Mocks e testes
- **Mocks:** os três ajustes acima; teste com os literais reais (a tabela do contrato) como referência, inclusive o `405`, a ordem 404 → 422 → 409 e as mensagens dos 400/415.
- `api/financiamentos` (ambiente `node`): as quatro chamadas, corpo e `Location`, `401`, `404` da simulação e da opção, `409`, `422` e o `204`.
- `schemas/financiamento`: limites (taxa 0 e 20, prazo 1 e 72), casas, vírgula, sistema em qualquer caixa, entrada `<` veículo (igual recusa, com a mensagem real e o valor formatado), entrada vazia = 0 e a conversão para o corpo (número, prazo inteiro, sistema em maiúsculas).
- Hooks: lista, cache atualizado em criar/editar/excluir sem novo `GET`, `404` do `DELETE` = sucesso, `404` do `PUT` = "já não existe", sem repetição nas mutações; o resultado é invalidado.
- Componentes e tela (MSW): lista nos três estados (carregando, erro com "Tentar de novo", vazio), aviso de menos de 2 opções, botão desabilitado com 3 opções, criar, editar (formato dos campos) e excluir (com confirmação e 204); `409` do 4º cadastro (mesmo com o botão habilitado por lista antiga), `422` nos campos certos com foco, entrada ≥ veículo (cliente e servidor), `404` da opção, rede fora do ar com os dados mantidos, duplo envio, e a lista independente do formulário da simulação (uma falha não derruba a outra).
  Cada teste de comportamento tem um controle (a versão sem o comportamento).

### Casos de borda
- **Limite atingido em outra aba:** a lista da tela mostra 2, o `POST` dá `409`; a mensagem aparece no formulário e a lista é atualizada (passa a mostrar 3 e o botão desabilita).
- **Valor do veículo alterado em outra aba** depois de abrir a tela: o cliente valida com o valor que conhece e o servidor tem a palavra final (`422` na entrada, mostrado no campo).
- **Simulação excluída em outra aba:** a lista dá `404 "Simulação não encontrada"`; a seção mostra o erro com a mensagem (a tela inteira já lida com a simulação sumida quando o `GET` ou o `PUT` dão 404).
- **Taxa 0:** válida ("0,00% a.m."). **Entrada 0:** o campo vem "0,00" e o corpo leva `0`. **Nome longo:** quebra a linha (`overflowWrap`), sem estourar o cartão.
- **Editar sem mudar nada** e salvar: o `PUT` sai igual e o servidor devolve a mesma opção.
- **Fechar o diálogo** (Esc, clique fora, Cancelar) não descarta nada no servidor; durante o envio não fecha.
- **Estado do formulário da simulação:** abrir, editar ou excluir uma opção **não** perde o que foi digitado (e ainda não salvo) no formulário da simulação, que é outro componente.
- **Número de opções no cache desatualizado** (lista velha): o limite de 3 é validado pelo servidor; a tela só se antecipa.

### Resíduos no banco de desenvolvimento do backend
A exploração desta spec usou uma **sétima conta descartável** (`sonda-<aleatório>@example.com`; senha aleatória já descartada, nunca impressa). Criou uma simulação com 3 opções para provar as regras e **apagou a simulação** ao fim (a conta terminou com 0 simulações).
O backend não exclui usuários; sem impacto para o app.

## Decisões em aberto
Resolvidas em 2026-09-26 (decisões do autor):
1. ~~Como cadastrar e editar uma opção~~ **Diálogo (modal) sobre a própria tela:** "Adicionar opção" e **Editar** abrem uma janela com os 5 campos; ao salvar, ela fecha e a lista atualiza. A tela por trás
   não muda de lugar (o que foi digitado no formulário da simulação fica como está) e, no celular, o diálogo ocupa a tela toda. Esc, clique fora e Cancelar fecham sem enviar; durante o envio não fecha.
   Sem painel dentro da tela e sem página própria (a rota `/simulacoes/:id/financiamentos/nova` colidiria com a da amortização, Etapa 7).
2. ~~Como mostrar a lista~~ **Cartões em grade**, no estilo do histórico: nome em destaque, rótulo do sistema, taxa "1,50% a.m.", prazo "48 meses", entrada e as ações Editar e Excluir (ícones já em uso).
   Lado a lado no computador e empilhados no celular, sem rolagem horizontal. Sem tabela.
3. ~~Como escolher o sistema de amortização~~ **Botões de escolha (`RadioGroup`) só com o nome, "Price" e "SAC", sem texto explicativo e sem nada marcado de início.** Sem marcação prévia, a pessoa escolhe de propósito;
   se enviar sem escolher, o campo mostra **"Campo obrigatório."** (a mesma mensagem que o backend dá quando o campo falta) e o foco vai ao grupo. O corpo envia sempre `PRICE` ou `SAC` em maiúsculas.
4. ~~Onde fica a seção~~ **Abaixo do formulário da simulação, em coluna única**, igual no computador e no celular: primeiro os dados da simulação e os botões (Salvar alterações, Ver resultado, Voltar ao histórico) e, depois, a seção de opções.
   O texto da seção avisa que cada opção é salva na hora. **Ver resultado** não é repetido dentro da seção.

Sem decisões em aberto: a spec está pronta para o `/plan`.

## Critérios de aceite
- [x] `npm run lint` (0 avisos), `npm test` e `npm run build` verdes; nenhuma dependência nova e nenhum ícone novo.
- [x] **No navegador, contra o backend real:** na edição de uma simulação, adicionar 3 opções (uma Price e uma SAC entre elas), editar e excluir uma; a lista atualiza sem recarregar; cada ação mostra o aviso de sucesso.
- [x] A 4ª opção é impedida com clareza (botão desabilitado e texto), e um `409` provocado (outra aba) é explicado no formulário e atualiza a lista.
- [x] Erros do servidor aparecem junto ao campo certo (entrada igual ao veículo, taxa acima de 20, prazo acima de 72), com as mensagens reais e o foco no primeiro campo com erro; os valores digitados são mantidos.
- [x] Reduzir o valor do veículo abaixo da entrada de uma opção e salvar a simulação mostra o `422` no campo **Valor do veículo** (Etapa 3) e a orientação de ajustar a opção antes.
- [x] Com o backend parado, a lista mostra o erro com **Tentar de novo** e o formulário da simulação continua editável; ao religar, a lista carrega.
- [x] Com 0 ou 1 opção há o aviso de incentivo, sem bloquear **Ver resultado**.
- [x] A entrada da opção `≥` valor do veículo é recusada no cliente, com a mensagem real, e a opção **nunca** mostra valor financiado nem parcela calculados no cliente.
- [x] Os mocks refletem o backend real nos três pontos corrigidos, e o teste de contrato confere as mensagens literais.
- [x] Nomes em `PascalCase.jsx`/`camelCase.js`; nenhum `console.log`; nada de chamada direta a API externa.
- [x] O `CLAUDE.md` é atualizado (estrutura, contrato das opções, contagem de testes) e o `plano.md` marca a Etapa 5.

## Plano de Implementação

**Status:** executado (T1 a T14) · **Criado em:** 2026-09-27

São 16 tarefas pequenas, em cinco blocos. Cada uma indica **quem executa** (**Claude** ou **Você**), os arquivos, o que muda e como validar. O código de cada módulo nasce **junto com os seus testes**
(`*.test.js(x)` ao lado). Regras para todo o plano:
- O Claude **não** roda `git add`, `commit` nem `push` (os commits são seus).
- Ao fim de cada tarefa que altera código: `npm run lint` (0 avisos) e `npm test` verdes.
- Cada teste de comportamento tem um **controle** (a versão que não deve disparar) que prova que ele pode falhar; os testes de guarda (limite de 3, entrada < veículo) são provados também **removendo a checagem do código por um instante**, como na Etapa 4.
- **Mensagens:** a referência são os literais da tabela "Contrato real observado" desta spec, copiados do backend real (lição das Etapas 2 a 4), nunca o próprio handler ou esquema testado.
- Testes de corrida usam uma **comporta** controlada pelo teste (nunca `delay` por tempo, que falhou sob carga na Etapa 4).
- **Nenhuma aritmética financeira no cliente:** a lista mostra só os campos que a API devolve; a única comparação numérica é a regra de formulário "entrada < veículo" (o backend tem a palavra final).
- **Sem dependência nova e sem ícone novo:** a T11 confere que o bundle continua com os mesmos 5 ícones e que o `package.json` não mudou.
- **`.gitignore`:** a T14 confere com `git status --ignored` e `git check-ignore -v` que nenhum arquivo novo foi ignorado por engano.
- **Testes existentes:** a T1 muda mensagens compartilhadas dos mocks (400 e 415 do corpo) e a T6 generaliza o `ConfirmarExclusao`; os testes atuais que dependem disso são ajustados **na mesma tarefa** que muda o comportamento, sem relaxar nenhuma verificação.
- **Segredos:** a conta descartável da T12 (oitava; senha aleatória, nunca impressa) cria e **apaga** o que usar.

**Ordem e dependências:** A → B → C → D → E. A T3 usa a T2; a T4 usa a T3; a T5 é independente dos hooks; a T8 usa a T5 e a T4; a T9 usa T3, T4, T7 e T8; a T10 usa a T9.
As tarefas que exigem **você** são a T13 (navegador) e a T15 (commit).

### Bloco A — Mocks

**T1 · Claude · Mocks alinhados ao backend real**
- Arquivos: `src/mocks/validacao.js`, `src/mocks/handlers/financiamentos.js`, `src/mocks/handlers/handlers.test.js`.
- O que muda: as regras da opção passam a ter as **mensagens reais** (taxa mensal, prazo, sistema, entrada, nome), o leitor de corpo compartilhado passa a dar `400 "Corpo da requisição deve ser um objeto JSON"` (para `[]`, `null`, vazio e JSON inválido) e `415 "Tipo de conteúdo não suportado"`, e o `GET` de uma opção só responde `405 "Método não permitido"`.
- Validar: `npm test` com um novo bloco de testes ("financiamentos: mensagens e regras iguais às do backend real") que confere **todos os literais da tabela do contrato** (uma linha por caso: os 13 de 422, os 400 e 415, o `405`, a ordem 404 → 422 → 409, a 4ª opção inválida = 422, `PUT` sem `valor_entrada` volta a 0, `null` = "Campo obrigatório.", sistema em qualquer caixa devolvido em maiúsculas, `Location` relativo);
  controle: um corpo válido continua `201`, e as mensagens de auth e de simulação (Etapas 2 e 3) seguem iguais; a suíte inteira verde prova que nenhum teste antigo dependia dos textos velhos.

### Bloco B — Dados

**T2 · Claude · `api/financiamentos.js`**
- Arquivos: `src/api/financiamentos.js`, `src/api/financiamentos.test.js`.
- O que muda: `listar`, `criar`, `atualizar` e `excluir` opções de uma simulação, finas sobre o client (`/simulacoes/:id/financiamentos[/:fid]`), no mesmo estilo de `api/simulacoes.js`.
- Validar: `npm test` (ambiente `node`, MSW): a lista `{itens, total}` em ordem de criação; o `POST` devolve a opção e o `Location`; o `PUT` leva o corpo completo; o `DELETE` devolve `null` (204 sem `.json()`); `401` chama o `aoExpirar` (controle: `404` e `409` e `422` não chamam); `404` da simulação e da opção com as mensagens reais; `409` sem `detalhes`; `422` com `detalhes` por campo; a opção de **outra pessoa** dá o mesmo `404`; falha de rede vira `ErroRede`.

**T3 · Claude · Chaves de cache e `useFinanciamentos`**
- Arquivos: `src/hooks/chavesSimulacoes.js`, `src/hooks/useFinanciamentos.js`, `src/hooks/useFinanciamentos.test.jsx`, `src/hooks/useSimulacoes.test.jsx` (chaves).
- O que muda: as chaves `financiamentos(id)` = `['simulacoes', String(id), 'financiamentos']` e `resultado(id)` (reservada à Etapa 6), e o hook da lista de uma simulação, que só busca quando há id.
- Validar: `npm test`: carrega a lista na chave normalizada (id como texto ou número dá a mesma chave); erro `503` fica em erro e repete **uma** vez com a política de produção, e o `404` nunca é repetido; sem id não busca; cancela ao desmontar; a chave da lista **não** colide com a do detalhe (`['simulacoes', '7']` e `['simulacoes', '7', 'financiamentos']` são caches separados, e a lista de simulações não é invalidada por elas).

**T4 · Claude · Mutações das opções**
- Arquivos: `src/hooks/useCriarFinanciamento.js`, `useAtualizarFinanciamento.js`, `useExcluirFinanciamento.js`, `src/hooks/mutacoesFinanciamento.test.jsx`.
- O que muda: criar, editar e excluir **atualizam o cache da lista com o que o servidor devolveu** (acrescenta, troca, tira; sem novo `GET`), invalidam `['simulacoes', id, 'resultado']` e não repetem; o `DELETE` com `404` conta como sucesso (`{ jaExcluida: true }`) e o `PUT` com `404` sobe como erro.
- Validar: `npm test` com o cache de produção (`criarQueryClient`): depois de criar, a lista em cache tem a opção **sem** novo `GET` (controle: sem o `setQueryData` a lista não teria); editar troca a opção pelo mesmo `id`; excluir a tira; `404` do `DELETE` = sucesso e mexe no cache igual; falha de rede e `5xx` sobem **sem mexer no cache**; `409` e `422` sobem sem mexer no cache; a chave `resultado` é invalidada (uma consulta de teste nessa chave passa a "stale"); excluir a **simulação** (hook existente) remove também a lista das opções, por começar com o mesmo prefixo.

**T5 · Claude · Esquema e conversão do formulário da opção**
- Arquivos: `src/schemas/financiamento.js`, `src/schemas/financiamento.test.js`.
- O que muda: o esquema Zod (fábrica que recebe o valor do veículo salvo) com as mensagens reais e a ordem do backend (leitura → inteiro → faixa → casas), a regra "entrada < veículo" com a mensagem real e o valor formatado (`R$ 95.000,00`), o sistema vazio = "Campo obrigatório.", e a conversão única `paraCorpoDaApi` / `deFinanciamentoParaForm` mais o mapa `CAMPOS_DA_API`.
- Validar: `npm test`: limites (taxa 0 e 20 válidas; `-0,01`, `20,01`; prazo 1 e 72 válidos, 0 e 73 não), casas (7 na taxa, 3 na entrada), vírgula estrita (`1,5` sim, `1.5` não), prazo `12,5` = "Número inteiro inválido.", entrada `=` e `>` veículo recusadas com a mensagem real (e a faixa vem antes), entrada vazia vale 0, entrada `0` aceita, nome só com espaços = obrigatório, sistema não marcado = "Campo obrigatório."; a conversão devolve **números**, prazo **inteiro**, sistema em **maiúsculas**, nome aparado, e nunca `id` nem `simulacao_id`; `deFinanciamentoParaForm` escreve `1,5`, `48` e `10.000,00`;
  **paridade:** cada mensagem do esquema é igual à literal da tabela do contrato (lista escrita no teste).

### Bloco C — Interface

**T6 · Claude · `ConfirmarExclusao` genérico**
- Arquivos: `src/components/ConfirmarExclusao.jsx`, `src/components/ConfirmarExclusao.test.jsx`, `src/pages/Simulacoes.jsx`.
- O que muda: o diálogo passa a receber o título e o texto (a simulação continua com os mesmos textos de hoje, agora vindos de quem chama), para servir também à exclusão de uma opção.
- Validar: `npm test`: os testes atuais do diálogo e da lista de simulações passam **sem alterar o que verificam** (título com o nome, texto "As opções de financiamento dela também serão excluídas", botões, bloqueio durante o envio); um teste novo com título e texto de **opção**; controle: sem título/texto informados o diálogo não mostra o texto da simulação.

**T7 · Claude · `CartaoFinanciamento`**
- Arquivos: `src/components/CartaoFinanciamento.jsx`, `src/components/CartaoFinanciamento.test.jsx`.
- O que muda: o cartão de uma opção (nome, sistema, taxa "1,50% a.m.", prazo "48 meses", entrada) com as ações Editar e Excluir (`aoEditar`, `aoExcluir`), no estilo do `CartaoSimulacao`, sem ícone novo.
- Validar: `npm test`: mostra cada dado formatado (Price e SAC; prazo 1 = "1 mês"; taxa 0 = "0,00% a.m."; entrada 0 = "R$ 0,00"); os botões têm o nome com a da opção ("Editar opção Banco A", "Excluir opção Banco A") e chamam as ações com a opção; nome longo (120 caracteres) não estoura (`overflowWrap`); **nenhum** texto de valor financiado, parcela ou total.

**T8 · Claude · `FormularioFinanciamento` (diálogo)**
- Arquivos: `src/components/FormularioFinanciamento.jsx`, `src/components/FormularioFinanciamento.test.jsx`.
- O que muda: o diálogo com os 5 campos (`CampoNumerico` para taxa, prazo e entrada; grupo de botões de escolha **Price** e **SAC**, nada marcado; nome), que serve para adicionar e para editar, valida com o esquema da T5, mostra erros do servidor no campo (foco no primeiro), aviso geral para `409` e rede, bloqueia o envio duplo e ocupa a tela toda no celular.
- Validar: `npm test`: abre vazio (entrada `0,00`, sistema sem marca, foco no nome) ou preenchido (edição, no formato dos campos); validação no cliente sem chamar a API (sistema não marcado, entrada igual ao veículo com a mensagem real, taxa `20,01`, prazo 73); os valores digitados **sobrevivem** a um erro do servidor; `422` do servidor em cada campo com foco no primeiro (`aplicarErrosDoServidor` com o mapa); `409` = aviso no diálogo, dados mantidos; rede fora do ar = aviso próprio e dá para tentar de novo; **duplo envio** (clique forçado e Enter) sai **uma** chamada; Esc, clique fora e Cancelar fecham sem enviar, mas **não** fecham durante o envio; o corpo enviado tem números, prazo inteiro e sistema em maiúsculas; reabrir para outra opção não traz valores da anterior (controle).

**T9 · Claude · `SecaoFinanciamentos`**
- Arquivos: `src/components/SecaoFinanciamentos.jsx`, `src/components/SecaoFinanciamentos.test.jsx`.
- O que muda: a seção da tela: título, texto de apoio (compara à vista, financiamento e fundo; "cada opção é salva na hora"), botão **Adicionar opção**, aviso de menos de 2 opções, limite de 3, os três estados da lista (esqueleto, erro com **Tentar de novo**, vazio), os cartões em grade, os diálogos de cadastro/edição e de exclusão, e os avisos de sucesso ("Opção adicionada.", "Opção salva.", "Opção excluída.").
- Validar: `npm test` (MSW, `renderizarComAuth`): os três estados da lista; com 0 e 1 opção aparece o aviso de incentivo, com 2 e 3 não (controle); com **3 opções** o botão fica desabilitado com o texto "Limite de 3 opções: exclua uma para adicionar outra", e excluir uma **libera** o botão; criar, editar (formato dos campos) e excluir (com confirmação, `404` do `DELETE` = "já tinha sido excluída") atualizam a lista **sem recarregar** e sem novo `GET`; `409` do 4º cadastro com o botão habilitado por lista antiga: mensagem no diálogo **e a lista é atualizada** (passa a mostrar 3 e o botão desabilita); `404` do `PUT` (excluída em outra aba) fecha o diálogo, atualiza a lista e avisa "Esta opção não existe mais."; `404 "Simulação não encontrada"` na lista mostra o erro; regra da entrada usa o valor do veículo **salvo** (detalhe em cache, não o digitado); a ajuda do campo mostra esse valor.

**T10 · Claude · A seção na tela de edição**
- Arquivos: `src/pages/SimulacaoForm.jsx`, `src/pages/SimulacaoForm.test.jsx`, `src/App.test.jsx`.
- O que muda: `EditarSimulacao` mostra a `SecaoFinanciamentos` **abaixo** do formulário da simulação (coluna única); a criação (`/simulacoes/nova`) continua sem a seção.
- Validar: `npm test` (`renderizarComAuth` + MSW): a edição mostra a seção depois dos botões da simulação; a nova simulação **não** mostra; a lista e o formulário da simulação são **independentes** (lista com erro e formulário salvando; e o contrário; controle: cada um funciona sozinho); adicionar, editar e excluir uma opção **não perde** o que foi digitado (e ainda não salvo) no formulário da simulação; salvar a simulação com valor do veículo menor ou igual à entrada de uma opção mostra o `422` **no campo do veículo** (Etapa 3, mensagem real com o nome da opção); depois de um `PUT` da simulação, o diálogo passa a validar com o **novo** valor do veículo; `Ver resultado` continua habilitado com 0 opção; testes existentes da tela e do `App` verdes; `npm run build` verde.

### Bloco D — Verificação e fechamento

**T11 · Claude · Verificação completa**
- Arquivos: nenhum (só leitura, salvo correções).
- O que muda: rodo tudo de ponta a ponta.
- Validar: `lint` com 0 avisos; `npm test` verde **três vezes seguidas** (para pegar instabilidade das corridas) com a contagem registrada; `npm run build` sem avisos e o tamanho do bundle; `npm ls --all` sem problemas; `git diff HEAD -- package.json package-lock.json` vazio (nenhuma dependência nova);
  os **mesmos 5 ícones** (`Add`, `DeleteOutlined`, `EditOutlined`, `Visibility`, `VisibilityOff`); nenhum `console.log` nem dado de teste no `dist/`; `grep` confirma que só `api/api.js` chama `fetch` no código de produção e que nenhum arquivo do `src/` (fora dos mocks e testes) calcula parcela, valor financiado ou total.

**T12 · Claude · Verificação por linha de comando com o backend real**
- Arquivos: nenhum.
- O que muda: só verificação; subo o `dev` e uso uma **conta descartável nova** (senha aleatória, nunca impressa) que cria uma simulação com opções e **apaga tudo** ao fim.
- Validar: as rotas `/simulacoes/nova` e `/simulacoes/1/editar` respondem `200` (fallback de SPA); **paridade cliente × backend** com o código real do cliente (`esquemaFinanciamento`, `paraCorpoDaApi`): cada caso recusado pelo cliente tem a **mesma mensagem** que o backend real devolve quando o corpo é enviado assim mesmo, e cada caso aceito dá `201`; `Location` relativo, o `PUT` sem `valor_entrada` (volta a 0), `409` da 4ª opção, `404`s e a ordem 404 → 422 → 409 confirmados; o formato de campo (`deFinanciamentoParaForm`) do que o servidor devolveu; a conta termina com 0 simulações.

**T13 · Você · Verificação no navegador**
- Arquivos: nenhum.
- O que muda: com `npm run dev` (eu subo) e o backend no ar, você abre `http://localhost:5173`, entra e confere, com o console aberto (F12):
  1. **Criar** uma simulação e, na edição dela, a seção **Opções de financiamento** aparece **abaixo** do formulário, vazia, com o botão **Adicionar opção** (na criação a seção não aparece).
  2. **Adicionar 3 opções** (uma **Price** e uma **SAC**): o diálogo abre com o foco no nome, o **sistema vem sem marcação**, a entrada vem `0,00`; cada uma aparece na lista sem recarregar, com "Opção adicionada."; com 0 ou 1 opção há o aviso de incentivo.
  3. **Limite:** com 3 opções o botão **Adicionar opção** fica desabilitado, com o texto do limite; excluir uma o libera.
  4. **Erros no campo:** entrada igual ao valor do veículo, taxa `20,01` e prazo `73` mostram a mensagem no campo certo, com o foco nele; enviar sem escolher o sistema mostra "Campo obrigatório."; os valores digitados são mantidos.
  5. **Editar** uma opção: o diálogo abre preenchido (`1,5`, `48`, `10.000,00`); salve e confira a lista e o aviso.
  6. **Excluir** uma opção: aparece a confirmação com o nome da opção; confirme.
  7. **409 provocado:** abra a mesma simulação em **duas abas**; numa, adicione a 3ª opção; na outra (ainda com 2 na lista), tente adicionar: a mensagem aparece no diálogo e a lista da outra aba passa a mostrar 3.
  8. **422 da simulação:** reduza o valor do veículo abaixo da entrada de uma opção e salve a simulação: o erro aparece no campo **Valor do veículo**, com o nome da opção.
  9. **Backend parado** (peça que eu pare o backend, com a tela já aberta): ao recarregar a **lista** a seção mostra o erro com **Tentar de novo** e o formulário da simulação segue editável; religue (peça) e clique em **Tentar de novo**.
  10. **Celular:** estreite a janela: os cartões empilham, o diálogo ocupa a tela toda e nada exige rolagem horizontal.
- Validar: você me diz o resultado de cada item; qualquer falha vira correção antes da T14. (Lembrete da Etapa 4: para ver o aviso de "backend parado" numa carga limpa, recarregue com o backend no ar, abra a edição e só então peça para parar o backend antes de clicar em **Tentar de novo**.)

**T14 · Claude · Registrar a conclusão da etapa**
- Arquivos: `CLAUDE.md`, `plano.md` (Etapa 5), esta spec.
- O que muda: `CLAUDE.md` (estrutura com `api/financiamentos.js`, hooks, esquema e componentes; contrato real das opções, com a tabela de mensagens, o `405` e os 400/415 compartilhados; comportamento da seção; lições de teste; contagem de testes; resíduos); `plano.md` marca a Etapa 5 como concluída com notas (incluindo os nomes finais, que diferem dos previstos: `SecaoFinanciamentos`, `CartaoFinanciamento`, `FormularioFinanciamento`); a spec passa a "Concluída" com os critérios marcados e o registro da execução.
- Validar: releitura dos três arquivos; `git status --ignored --short` e `git check-ignore -v` nas pastas com arquivos novos confirmam que **nada** foi ignorado por engano e que nada proibido (`node_modules/`, `dist/`, `.env`, `CLAUDE.md`, `api/`) é publicável.

**T15 · Você · Commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica. Sugestão: `git add .`, `git status`, `git commit` e `git push` (inclui a última linha da spec da Etapa 4, ainda não commitada).
- Validar: `git status` limpo; push sem erro.

### Bloco E — Publicação

**T16 · Claude · Confirmar a publicação, do zero**
- Arquivos: nenhum.
- O que muda: só verificação; clono o repositório público numa pasta limpa (a pasta temporária é apagada ao fim).
- Validar: o número de arquivos rastreados no GitHub bate com o do disco; `npm ci`, `npm ls`, `lint` (0 avisos), `npm test` e `npm run build` verdes no clone; a listagem do GitHub tem `src/api/financiamentos.js`, `src/schemas/financiamento.js` e `src/components/SecaoFinanciamentos.jsx` e não tem `node_modules`, `dist`, `.env`, `CLAUDE.md`, `api` nem `.claude`.

### Mapa dos critérios de aceite
| Critério | Tarefas |
|---|---|
| `lint`, `test` e `build` verdes; nenhuma dependência nova e nenhum ícone novo | T11, T16 |
| Adicionar 3 opções (Price e SAC), editar e excluir; lista sem recarregar; avisos de sucesso | T4, T8, T9, T10, T13 |
| 4ª opção impedida (botão e texto) e `409` provocado explicado e com a lista atualizada | T9, T12, T13 |
| Erros do servidor junto ao campo certo, com mensagens reais e foco; valores mantidos | T1, T5, T8, T12, T13 |
| `422` de `valor_veiculo` ao reduzir o veículo abaixo da entrada de uma opção | T10, T13 |
| Backend parado: erro na lista com **Tentar de novo**, formulário da simulação editável | T9, T10, T13 |
| 0 ou 1 opção: aviso de incentivo sem bloquear **Ver resultado** | T9, T10 |
| Entrada `≥` veículo recusada no cliente; nenhum valor financiado nem parcela calculados | T5, T7, T11 |
| Mocks iguais ao backend real nos três pontos e teste de contrato com os literais | T1, T12 |
| Nomes, `console.log` e nenhuma chamada a API externa | T11 |
| `CLAUDE.md` e `plano.md` atualizados | T14 |

### Riscos
- **Diálogo com React Hook Form:** os valores iniciais só são lidos na montagem; o diálogo precisa ser remontado a cada abertura (adicionar × editar × outra opção) para não trazer valores da anterior. A T8 testa "reabrir para outra opção" com controle.
- **Grupo de botões de escolha sem valor inicial:** o campo começa vazio e precisa de foco e mensagem acessíveis quando não escolhido; o `setFocus` do React Hook Form é assíncrono e o grupo não é um `input` único (a T8 confere o foco no primeiro botão do grupo).
- **Regra "entrada < veículo" depende de outro cache** (o detalhe da simulação): o esquema é recriado com o valor salvo e o diálogo revalida ao abrir; a T10 prova que, depois de um `PUT` da simulação, o diálogo usa o novo valor.
- **Lista antiga × servidor:** o limite de 3 e a existência da opção são validados pelo servidor; `409` e `404` precisam atualizar a lista (a T9 testa os dois com a lista velha).
- **Cache com prefixo comum:** as chaves da lista e do resultado começam por `['simulacoes', id]`, o mesmo do detalhe; a exclusão da simulação remove todas (desejado), e a invalidação do detalhe **não** pode refazer a lista sem necessidade (a T3 confere que os caches são separados).
- **Mudança dos mocks compartilhados (400 e 415):** afeta os handlers de auth, simulações e opções; a suíte inteira roda na T1 e qualquer teste que dependa do texto antigo é ajustado ali.
- **Diálogos e `aria-hidden` do MUI:** com o diálogo aberto o resto da página fica oculto para o leitor de tela e para `getByRole`; os testes consultam com `{ hidden: true }` ou esperam o diálogo sair (lição da Etapa 3), e a T11 roda a suíte três vezes para pegar avisos de `act`.
- **Tamanho:** 16 tarefas; T8, T9 e T10 são as maiores. Se preferir, executo por bloco e paro para a sua revisão ao fim de cada um.

### Registro da execução (2026-09-27)
- **Resultado:** 1121 testes em 49 arquivos (estáveis em 3 execuções seguidas), `lint` sem avisos, `build` de 759 kB (239 kB gzip; era 729 kB); os mesmos 5 ícones do `@mui/icons-material`; nenhuma dependência nova; só `api/api.js` chama `fetch` no código de produção; nenhum texto de valor financiado, parcela ou custo calculado no cliente (a busca só acha comentários que dizem que isso não existe); `dist/` sem `msw` nem `mockServiceWorker.js`.
- **Desvios do plano:** (1) `SecaoFinanciamentos` é um componente **com dados** (usa os hooks), como a spec previa, e não só de apresentação; (2) o `campoNumerico`, `OBRIGATORIO` e `MSG_NOME` de `schemas/simulacao.js` passaram a ser exportados para o esquema da opção reaproveitá-los; (3) o `Radio` do MUI 9 não aceita `inputRef`, então o `ref` do React Hook Form vai por `slotProps.input`; (4) o 409 é tratado em dois lugares: o **diálogo** explica ("... Exclua uma opção antes de adicionar outra.") e a **seção** atualiza a lista; (5) `ConfirmarExclusao` recebe `titulo` e `descricao` (a simulação passa os mesmos textos de antes, pela página do histórico); (6) `useExcluirFinanciamento` e a exclusão da simulação compartilham o prefixo de cache `['simulacoes', id]`, de modo que excluir a simulação remove também a lista das opções e o resultado.
- **Bugs achados pelos testes:** só fragilidades de teste ou do harness, nenhuma do código: `key={id}` duplicada entre irmãos na tela de edição (a trava de `console.error` avisou); o hook de teste lia `result.current` sem `waitFor` depois da mutação (o React Query agenda a notificação); os avisos em fila (um por vez) escondiam o 2º aviso do teste; a expectativa do campo reformatado (`80.000,00`). Prova de sensibilidade: removidas de propósito a regra "entrada < veículo" (`>=` e a regra inteira), o limite de 3, o refetch do 409 e a chave de remontagem do diálogo, os testes correspondentes falharam em todos e o código voltou ao original; uma das mutações mostrou um teste que passava à toa ("excluir libera o botão"), que foi reforçado.
- **Verificação automática com o backend real (T12):** 15 mensagens recusadas pelo cliente **idênticas** às do backend (taxa, prazo, entrada, faixa antes da regra, nome, sistema ausente), 12 casos aceitos com `201` e ida e volta igual (`deFinanciamentoParaForm` → `paraCorpoDaApi`), `Location` relativo, entrada vazia = 0, sistema em maiúsculas, `409` sem `detalhes`, `422` antes do `409`, lista em ordem de criação, `PUT` sem entrada volta a 0, `404` antes do `422`, `DELETE` `204` e depois `404`, e o `422` do `PUT` da simulação com o nome da opção; a conta terminou com 0 simulações. Diferença conhecida e intencional: nome vazio (o cliente diz "Campo obrigatório."). A primeira execução acusou uma falha do **próprio script** (veículo maior que a entrada, sem violação); corrigido e refeito com outra conta.
- **Verificação no navegador (T13, pelo autor):** todos os itens passaram (criação sem a seção e edição com ela, 3 opções, limite, erros no campo, edição, exclusão, `409` em duas abas, `422` do veículo, backend parado e celular).
- **Resíduos:** três contas descartáveis `sonda-...` (a da exploração da spec e duas da T12), todas com 0 simulações ao fim; o backend não exclui usuários. As senhas aleatórias nunca foram impressas nem gravadas.
- **Publicação (T15 e T16):** commit `e2d0526`. O GitHub tem os 158 arquivos rastreados (os mesmos do disco), com `src/api/financiamentos.js`, `src/schemas/financiamento.js`, `src/components/SecaoFinanciamentos.jsx`, `src/components/FormularioFinanciamento.jsx` e esta spec, e sem `node_modules`, `dist`, `api`, `.claude`, `CLAUDE.md`, `.env` nem `requisitos front-end.md`. **Verificação do zero:** clone do repositório público numa pasta limpa, com `npm ci`, `npm ls`, `lint` (0 avisos), `test` (1121 em 49 arquivos) e `build` (759 kB) verdes; `dist/` sem `msw` nem `mockServiceWorker.js`.
