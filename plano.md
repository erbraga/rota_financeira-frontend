# Plano de Implementação — Rota Financeira (Frontend)

**Criado em:** 2026-09-26
**Base:** `proposta-frontend-spa-react.md`, `requisitos front-end.md` e `CLAUDE.md`
**Contrato da API:** Swagger do backend (`/apidocs/`) e, como cópia de referência, `api/`

Este é o plano geral, em ordem de execução. Cada etapa deve virar uma spec em
`docs/specs/AAAA-MM-DD-nome.md` (fluxo `/spec` → `/plan` → `/implementar`)
antes de ser codada. Aqui ficam só o roteiro, os arquivos envolvidos e como
validar cada etapa. As decisões de tecnologia já estão fechadas no `CLAUDE.md`
(Material UI, `fetch`, Zod, Recharts, Context API, `sessionStorage`, Vitest + Testing
Library + MSW, só `Dockerfile` com nginx).

Convenção de status: `[ ]` pendente · `[x]` concluída.

## Visão geral

| # | Etapa | Requisitos |
|---|---|---|
| 0 | Preparação do repositório e ambiente | R6 |
| 1 | Configuração do projeto, client HTTP, tema, mocks e testes | R1 |
| 2 | Autenticação: registro, login, sessão e rotas protegidas | R1, R4 |
| 3 | Histórico e CRUD de simulações | R1 |
| 4 | Taxas sugeridas (CDI e IPCA) no formulário | R4 |
| 5 | Opções de financiamento | R1 |
| 6 | Tela de resultado: cartões e gráfico comparativo | R4 |
| 7 | Tela de amortização | R1, R4 |
| 8 | Tratamento de erros, responsividade e ajustes finais | R4 |
| 9 | Exportação por impressão (opcional) | R4 |
| 10 | Dockerfile (só `Dockerfile`, nginx) | R3 |
| 11 | README com fluxograma da arquitetura | R2, R5 |
| 12 | Revisão final e entrega | R6 |

**Dependências entre etapas:** 0 → 1 → 2 → 3 → (4, 5) → 6 → 7 → 8 → (9) → 10 → 11 → 12. As etapas 4 e 5 só
dependem da 3 e podem trocar de ordem. O Dockerfile (10) só precisa de um build que funcione, então pode ser
antecipado depois da 3 se sobrar tempo, mas o teste final é com o app completo.

**Cobertura do R1 (4 métodos HTTP diferentes)** — todos exercitados pela interface:

| Método | Onde |
|---|---|
| `GET` | Etapas 3, 4, 5, 6 e 7 (lista, detalhe, índices, resultado, parcelas) |
| `POST` | Etapas 2, 3 e 5 (registro, login, criar simulação e opção) |
| `PUT` | Etapas 3 e 5 (editar simulação e opção) |
| `DELETE` | Etapas 3 e 5 (excluir simulação e opção) |

---

## Etapa 0 — Preparação do repositório e ambiente
**Status: concluída em 2026-09-26** (spec: `docs/specs/2026-09-26-preparacao-repositorio-ambiente.md`).
**Arquivos:** `.gitignore`, `.nvmrc`

- [x] `git init -b main` no diretório do frontend.
- [x] `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `*.log`, `.env`, `.env.*` (menos `.env.example`), `.vscode/`, `.idea/`, `.DS_Store`, `/tmp`, a pasta **`/api/`** da raiz (cópia de referência do backend, que não vai para o repositório; a barra inicial é essencial, senão `src/api/` também seria ignorada) e, como no backend, `CLAUDE.md`, `.claude/` e `requisitos front-end.md`. Proposta, plano e `docs/` são publicados.
- [x] `.nvmrc` com `24` (Node 24 LTS; a Etapa 1 repete no `engines` do `package.json` e a Etapa 10 usa a mesma major no `Dockerfile`).
- [x] Repositório **público** vazio `erbraga/rota_financeira-frontend`, **criado por você** no GitHub (sem README, `.gitignore` nem licença); o Claude só liga o remoto (`git remote add origin ...`).
- [x] Backend local no ar para desenvolvimento: `docker start rota-financeira-db` (se parado) e `flask run` (porta 5000), com `CORS_ORIGINS` incluindo `http://localhost:5173` (já está no `.env` local do backend).
- [x] Conta de teste `teste@example.com` criada na API (Swagger ou `curl`); a senha não é escrita em nenhum arquivo do repositório.
- [x] Conferir o CORS com um preflight `OPTIONS` usando `Origin: http://localhost:5173`.
- **Commits e push são seus, manualmente:** o Claude não executa `git add`, `commit` nem `push`. Sem `LICENSE` e sem `.gitattributes` (decisões do autor).

**Validado:** `git remote -v` aponta para o repositório público; `git status --ignored` mostra `api/` ignorada e `git ls-files` (depois do seu primeiro `git add`) não lista `api/`, `.env*`, `CLAUDE.md` nem `.claude/`; `curl http://localhost:5000/api/saude` responde 200; o preflight devolve `Access-Control-Allow-Origin: http://localhost:5173`; login da conta de teste responde 200.
**Notas:** o repositório Git local e o primeiro commit/push (`361b52a`, "criação do repositório") foram feitos por você; o conteúdo publicado é só `.gitignore`, `.nvmrc`, `plano.md`, a proposta e `docs/`. O backend fica no ar (`flask run`, porta 5000) para as próximas etapas; o preflight de `http://localhost:9999` **não** recebe `Access-Control-Allow-Origin` (controle negativo). A origem `http://localhost:8080` só precisa entrar no `CORS_ORIGINS` do backend na Etapa 10 (Docker).

## Etapa 1 — Configuração do projeto, client HTTP, tema, mocks e testes
**Status: concluída em 2026-09-26** (spec: `docs/specs/2026-09-26-configuracao-do-projeto.md`).
**Arquivos:** `package.json`, `vite.config.js`, `index.html`, `eslint.config.js`, `.env.example`, `src/main.jsx`, `src/App.jsx`, `src/theme.js`, `src/api/api.js`, `src/utils/formatar.js`, `src/mocks/` (handlers e servidor MSW), `src/setupTests.js`

- [x] Projeto Vite + React (JavaScript, `.jsx`) com `<html lang="pt-BR">` e título do app.
- [x] Dependências, cada uma justificada na spec: `react-router-dom`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `recharts`; de desenvolvimento: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw`, `eslint` e plugins do React.
- [x] `.env.example` com `VITE_API_URL=http://localhost:5000/api`; leitura só por `import.meta.env.VITE_API_URL` (falha com mensagem clara se ausente).
- [x] `main.jsx` com os providers (`QueryClientProvider`, `ThemeProvider` + `CssBaseline`, `BrowserRouter`); `App.jsx` com as rotas da SPA em telas provisórias e página 404.
- [x] Tema do MUI em `theme.js` (paleta, tipografia, cores distinguíveis para o gráfico).
- [x] **Client HTTP** (`api.js`, `fetch`): base URL, `Authorization: Bearer`, JSON, timeout com `AbortController`, `204` sem corpo, erro tipado (`ErroApi` com `status`, `erro`, `detalhes`) e erro de rede distinto; `401` chama um callback de sessão expirada registrado pelo `AuthProvider` (exceto no login).
- [x] `utils/formatar.js`: reais (`Intl.NumberFormat pt-BR/BRL`), porcentagem, datas e leitura de número com vírgula decimal.
- [x] MSW com handlers baseados no contrato (auth, simulações, financiamentos, resultado, parcelas, índices) **incluindo os erros** (401, 404, 409, 422, 503), `null` nas séries, 204 sem corpo e envelope `itens`/`total`; usados nos testes e, opcionalmente, no `npm run dev:mock`.
- [x] Scripts: `dev`, `build`, `preview`, `lint`, `test`.

**Validado:** `npm run dev` abre a SPA em `http://localhost:5173`; `npm run build`, `npm run lint` e `npm test` verdes; testes do client HTTP (token injetado, 401, 204, 422 com `detalhes`, falha de rede, timeout) com MSW.
**Notas:** todas as versões da spec instalaram sem recuo (Vite 8.3, Vitest 5.0, MUI 9.4, ESLint 10.11...); 324 testes em 15 arquivos, ~4 s; o `create-vite` 9.2 trouxe oxlint, então o ESLint foi configurado à mão. Diferenças em relação ao plano original: sem `dev:mock` (decisão 8 da spec); `lerNumero` devolve `{ valor, erro }` (para distinguir campo vazio de inválido); a captura das fixtures achou o caso "aporte insuficiente" e corrigiu o `CLAUDE.md` (no modo aporte, `alcanca_a_meta` só é falso quando `mes_da_meta` é `null`); o `EstadoApi` é temporário e sai na Etapa 2. Arquivos além dos previstos: `Raiz.jsx`, `queryClient.js`, `config.js`, `testUtils.jsx`, `mocks/{banco,sessao,validacao,erros,chamar,contrato}.js`, `components/EmConstrucao.jsx`.

## Etapa 2 — Autenticação: registro, login, sessão e rotas protegidas
**Status: concluída em 2026-09-26** (spec: `docs/specs/2026-09-26-autenticacao.md`).
**Arquivos:** `src/auth/{AuthProvider,useAuth,RotaProtegida,tokenStorage}.jsx/js`, `src/api/auth.js`, `src/schemas/auth.js`, `src/pages/{Login,Registro}.jsx`, `src/components/{Layout,BarraSuperior}.jsx`

- [x] **Remover o `EstadoApi`** (indicador temporário da Etapa 1) e adaptar o `Layout` que já existe (barra superior; falta o nome do usuário e o logout); `Login` e `Registro` já existem como telas provisórias a substituir.
- [x] `AuthProvider` (Context): token, usuário, `entrar`, `sair`; espelha o token no **`sessionStorage`** (leituras/escritas em `try/catch`) e registra token e callback de 401 no client HTTP.
- [x] Ao iniciar com token guardado: validar com `GET /api/auth/perfil`; 401 descarta o token e vai ao login; enquanto valida, mostra carregamento (sem piscar a tela de login).
- [x] `RotaProtegida`: sem token → `/login`, lembrando a rota pedida para voltar depois do login.
- [x] Tela de **Registro** (`POST /api/auth/registrar`, 201 sem token): nome, e-mail, senha (8 a 128 caracteres), confirmação; 409 (e-mail já cadastrado) e 422 junto aos campos; depois do sucesso, leva ao login com aviso.
- [x] Tela de **Login** (`POST /api/auth/login`): 401 "Credenciais inválidas" é mostrado **no formulário, sem redirecionar** (sem loop); guarda `access_token` e `usuario`; volta à rota pedida.
- [x] Layout com barra superior (nome do usuário, **logout**, link para as simulações); logout apaga o token (Context e `sessionStorage`) e limpa o cache do React Query.
- [x] Toda 401 fora do login encerra a sessão, limpa o cache e leva ao `/login` com aviso de "sessão expirada".

**Validado:** testes de `RotaProtegida`, `AuthProvider` (validação do `perfil`, storage indisponível), formulários (Zod + `detalhes` do backend). No navegador contra o backend real: registrar, logar, recarregar a página (sessão mantida), logout, acessar `/simulacoes` sem token (vai ao login), apagar o token no storage e ver o redirecionamento, senha errada sem loop.
**Notas:** 516 testes em 26 arquivos; única dependência nova: `@mui/icons-material` 9.4.0 (só `Visibility` e `VisibilityOff` no bundle). Decisões do autor: pós-registro vai ao login com aviso e e-mail preenchido; login e registro em cartão centralizado (`LayoutPublico`, também na 404); ícone de olho; só reagir ao 401 (sem relógio); "E-mail ou senha incorretos."; logado em `/login` é redirecionado; senha só com as regras do backend (8 a 128); aviso "Você saiu da sua conta.". Desvios de implementação: o `AuthProvider` **não navega** (só guarda o aviso) e o `SoVisitantes` é o único redirecionamento depois do login, para não haver duas navegações competindo; a ligação com o client HTTP usa `useLayoutEffect` (bug achado pelos testes: com `useEffect` o primeiro `/perfil` saía sem token); os mocks foram alinhados ao backend real (login valida o e-mail, mensagens reais, esquema `Bearer`, 401 do login sem `WWW-Authenticate`).

## Etapa 3 — Histórico e CRUD de simulações
**Status: concluída em 2026-09-26** (spec: `docs/specs/2026-09-26-historico-e-crud-de-simulacoes.md`).
**Arquivos:** `src/api/simulacoes.js`, `src/hooks/{useSimulacoes,useSimulacao,useSalvarSimulacao,useExcluirSimulacao}.js`, `src/schemas/simulacao.js`, `src/pages/{Simulacoes,SimulacaoForm}.jsx`, `src/components/{CampoMoeda,CampoPercentual,CampoInteiro,ConfirmarExclusao,EstadoVazio,EstadoErro}.jsx`

- [x] **Minhas simulações** (`GET /api/simulacoes` → `{itens, total}`, mais recentes primeiro): cartões ou tabela com nome, valor do veículo, data; ações **abrir resultado**, **editar**, **excluir**; estados carregando, erro (com "tentar de novo") e vazio (com chamada para criar a primeira). **Sem** paginação, ordenação nem filtros.
- [x] **Excluir** com diálogo de confirmação (`DELETE`, 204 sem `.json()`), atualizando o cache e mostrando aviso de sucesso.
- [x] **Formulário** (`/simulacoes/nova` e `/simulacoes/:id/editar`, React Hook Form + Zod): `nome` (1–120), `valor_veiculo` (> 0, até 9.999.999,00), `valor_entrada` (0 a `valor_veiculo`, **inclusive**, padrão 0), `taxa_ipca_projetada` (−20 a 100 % a.a.), `taxa_fundo_rendimento` (0 a 100 % a.a.), `prazo_meses_fundo` (inteiro 1–60). Campos com máscara/entrada aceitando vírgula decimal, no máximo 2 casas (dinheiro) e 6 (taxas), com rótulos que deixam explícito **% a.a.**
- [x] `POST` (201 + `Location`) e `PUT` (**corpo completo**); erros 422/400 mapeados para os campos por `detalhes`, com `setError`; botão desabilitado durante o envio.
- [x] Editar carrega a simulação por `GET /api/simulacoes/:id` (que **não** traz opções); 404 mostra "simulação não encontrada" (também para a de outro usuário).
- [x] Conversão `camelCase` (estado do formulário) ↔ `snake_case` (API) em um único ponto.
- [x] **Decisão para a spec:** depois de criar a simulação, para onde ir? (Sugestão: para a edição da própria simulação, onde aparece a seção de opções da Etapa 5, pois as opções precisam do `id`.)

**Validado:** testes dos schemas (limites, casas decimais, vírgula) e da lista (vazio, erro, exclusão); no navegador: criar, listar, editar, excluir com confirmação, 422 provocado (ex.: entrada maior que o veículo), 404 por id inexistente, sessão de outro usuário não enxerga as simulações.
**Notas:** 830 testes em 39 arquivos; nenhuma dependência nova (só os ícones `Add`, `DeleteOutlined` e `EditOutlined`, que já vinham do pacote). Decisões do autor: cartões em grade; criar → edição da nova (`replace`); salvar → continua na edição; texto com vírgula reformatado ao sair do campo; Snackbar global (`AvisosProvider`); entrada começa em `0,00` e vazio vale 0. Achados do backend real (mocks corrigidos): mensagens de 422 da simulação, `prazo_meses_fundo` só como **número** JSON, `valor_entrada: null` recusado, `Location` relativo, `404` "Recurso não encontrado" para id não numérico e a mensagem do `PUT` contra a entrada da opção. Bugs pegos pelos testes: o React Hook Form descarta a validação se o valor muda durante ela (`CampoNumerico` reformata antes de sair do campo) e uma fragilidade de teste da Etapa 2 (captura de `useAuth`). Verificação automática: 27 casos de paridade cliente x backend real, 0 diferenças. A Etapa 5 herda o formulário de opções na tela de edição; o `FormularioSimulacao` recebe o `depende` de campos ligados e o `aplicarErrosDoServidor` aceita mapa de campos.

## Etapa 4 — Taxas sugeridas (CDI e IPCA) no formulário
**Status: concluída em 2026-09-26** (spec: `docs/specs/2026-09-26-taxas-sugeridas.md`).
**Arquivos:** `src/api/indices.js`, `src/hooks/useIndice.js`, `src/components/SugestaoDeTaxa.jsx`, `src/components/{FormularioSimulacao,CampoNumerico}.jsx`, `src/pages/SimulacaoForm.jsx`, `src/utils/formatar.js`, `src/mocks/handlers/indices.js`

- [x] `GET /api/indices/cdi` e `/api/indices/ipca` (minúsculas), com cache de 30 min no React Query e **`periodo=1m`** (só a `sugestao` interessa; a resposta fica ~10x menor que a do padrão `12m`).
- [x] Na **nova** simulação, pré-preencher **CDI → `taxa_fundo_rendimento`** e **IPCA → `taxa_ipca_projetada`** com `sugestao.valor`; os campos continuam **editáveis**, a linha de apoio mostra a origem (índice e `data_referencia`) e o botão **Usar** restaura a sugestão.
- [x] Texto sempre visível de que o IPCA sugerido é o **acumulado de 12 meses realizado**, não uma projeção.
- [x] `desatualizado: true` → aviso discreto; `sugestao: null`, **503** e falha de rede → aviso e digitação manual, com **Tentar de novo** (a criação **não depende** do BACEN); nunca bloqueia o formulário.
- [x] Ao **editar**, os valores gravados nunca são sobrescritos: a sugestão é só informação e o botão **Usar** é a única forma de mudar o campo.
- [x] Não sobrescreve o que o usuário já digitou (nem o campo em que digitou, apagou e saiu) se a resposta chegar depois.
- [ ] (Extra do R4) miniatura da série (`pontos`) do índice: **fora desta etapa por decisão do autor** (fica para a Etapa 6 ou, se sobrar tempo, a 8; os pontos já vêm da mesma chamada, basta mudar o `periodo`).

**Validado:** testes com MSW (sugestão aplicada, edição preservada, `desatualizado`, `sugestao: null`, 503, resposta tardia, cache); no navegador pelo autor: o formulário novo já vem preenchido, o valor digitado é mantido, o backend parado mostra o aviso com **Tentar de novo**, criar com a sugestão leva à edição com as taxas salvas, o cache evita repetir a chamada e o celular quebra a linha de apoio.
**Notas:** 931 testes em 42 arquivos; nenhuma dependência nova nem ícone novo (continuam os 5). Decisões do autor: mostrar a sugestão também na edição, só como informação; linha de apoio abaixo do campo com botão de texto; sem miniatura da série; texto do IPCA sempre visível. O componente se chama `SugestaoDeTaxa` (no lugar de `CampoTaxaSugerida` e `AvisoIndice`). Achados do backend real (mocks corrigidos): `periodo` repetido → `"Informe o parâmetro uma única vez."` e parâmetro desconhecido → `"Campo desconhecido."`; a resposta do CDI com `periodo=12m` tem ~15,7 kB e com `1m`, ~1,6 kB; a `sugestao` não depende do período. Verificação automática: 26 checagens contra o backend real, 0 diferenças, e o POST com as taxas sugeridas vai como número (`13.65`). A Etapa 5 herda o `FormularioSimulacao` com `sugestoes` e o padrão de linha de apoio.

## Etapa 5 — Opções de financiamento
**Status: concluída em 2026-09-27** (spec: `docs/specs/2026-09-26-opcoes-de-financiamento.md`).
**Arquivos:** `src/api/financiamentos.js`, `src/hooks/{useFinanciamentos,useCriarFinanciamento,useAtualizarFinanciamento,useExcluirFinanciamento}.js`, `src/schemas/financiamento.js`, `src/components/{SecaoFinanciamentos,CartaoFinanciamento,FormularioFinanciamento}.jsx`, `src/pages/SimulacaoForm.jsx`

- [x] Seção de opções na edição da simulação: `GET /api/simulacoes/:id/financiamentos` (`{itens, total}`, ordem de criação); **não** existe `GET` de uma opção só (o backend responde 405).
- [x] Formulário de opção em **diálogo**: `nome` (1–120), `taxa_juros_mensal` (0 a 20 % a.m., 6 casas, rótulo **% a.m.**), `prazo_meses` (inteiro 1–72), `sistema_amortizacao` (botões **Price** e **SAC**, sem marca inicial e sem explicação) e `valor_entrada` (padrão 0, **estritamente menor** que o `valor_veiculo` salvo da simulação).
- [x] `POST` (201), `PUT` (corpo completo) e `DELETE` (204) com confirmação; a lista atualiza sem recarregar (cache atualizado com a resposta do servidor, sem novo `GET`).
- [x] Incentivar **2 ou 3** opções (aviso informativo com 0 ou 1), sem impedir salvar nem o botão **Ver resultado**: o backend aceita 0 a 3.
- [x] **409 no 4º cadastro** (limite de 3): não é erro de campo; mensagem no diálogo com a orientação e a lista é atualizada; botão "Adicionar opção" desabilitado, com o texto do limite, quando já há 3.
- [x] Editar a simulação: o `PUT` pode dar **422 em `valor_veiculo`** se o novo valor for menor ou igual à entrada de alguma opção → mostrado junto ao campo, com o nome da opção (Etapa 3; agora testado com a seção na tela).
- [x] Ordem de erros do backend respeitada na UI: 404 (dono) → 400/415/422 (corpo) → 409 (estado).
- [x] Mocks alinhados ao backend real (mensagens de 422 da opção, 400/415 do corpo em todos os handlers, `405` do `GET` de uma opção).

**Validado:** testes dos schemas (limites, casas, vírgula, entrada = e > veículo, sistema não marcado), das mutações (cache), da seção (estados, limite, 409 com lista velha, 404 do PUT e do DELETE, rede) e da tela (independência entre a lista e o formulário da simulação); paridade automática com o backend real (15 mensagens recusadas iguais, 12 casos aceitos com ida e volta igual); no navegador pelo autor: criar 3 opções (Price e SAC), tentar a 4ª, editar, excluir, `409` provocado em duas abas, `422` do veículo, backend parado, celular.
**Notas:** 1121 testes em 49 arquivos; nenhuma dependência nova nem ícone novo (continuam os 5). Decisões do autor: diálogo (não painel nem página, cuja rota colidiria com a da amortização); cartões em grade; botões de escolha só com "Price" e "SAC", sem explicação e sem marca inicial; seção abaixo do formulário, coluna única. Nomes finais (diferentes dos previstos): `SecaoFinanciamentos`, `CartaoFinanciamento`, `FormularioFinanciamento`, `useCriar/Atualizar/ExcluirFinanciamento`. O `ConfirmarExclusao` virou genérico (título e texto). Achados do backend real (mocks corrigidos): 17 respostas diferiam, entre elas as mensagens de 422 da opção, a mensagem única dos 400 do corpo e o `415 "Tipo de conteúdo não suportado"` (que valem para auth e simulações também). A Etapa 6 herda a chave `chavesSimulacoes.resultado(id)`, invalidada ao criar, editar ou excluir uma opção.

## Etapa 6 — Tela de resultado: cartões e gráfico comparativo
**Status: concluída em 2026-09-27** (spec: `docs/specs/2026-09-27-resultado-comparativo.md`).
**Arquivos:** `src/api/resultado.js`, `src/hooks/useResultado.js`, `src/pages/Resultado.jsx`, `src/components/{CartaoCenario,CartoesResumo,GraficoComparativo,ControleAporte,SimulacaoNaoEncontrada}.jsx`, `src/utils/{aporteNaUrl,serieDoGrafico}.js`

- [x] `GET /api/simulacoes/:id/resultado`: o frontend **não recalcula nada**, só exibe (busca a cada abertura, cache de 30 s, invalidado ao mudar uma opção ou a simulação).
- [x] **Cartões-resumo** de cada cenário (à vista, cada financiamento, fundo) com `custo_total` e **destaque** do cartão indicado por `menor_custo` (`cenario` + `id`): etiqueta escrita "Menor custo" e borda mais forte; uma frase sempre visível explica que `custo_total` é **o que se paga pelo carro** (nominal), inclusive para o fundo.
- [x] Detalhes por cenário **sempre visíveis** no cartão: financiamento (`valor_financiado`, primeira e última parcela, `total_pago`, `total_juros`, sistema, prazo, entrada) e fundo (`aporte_mensal`, `mes_da_meta`, `preco_na_compra`, `total_aportado`, `rendimento`, `saldo_final`); frase do arredondamento na Price e "parcelas decrescentes" na SAC.
- [x] **Gráfico de linhas comparativo** (Recharts): saldo devedor de cada financiamento, saldo do fundo e preço corrigido, num eixo comum de meses; `null` **não liga lacunas** e nunca vira 0; legenda própria (botões) que oculta e mostra cada linha; tooltip em reais; cor e traço diferentes; título e resumo em texto; largura responsiva.
- [x] Link **Ver parcelas** em cada cartão de financiamento (rota da Etapa 7, ainda provisória) e **Editar simulação** no cabeçalho.
- [x] **Modo `?aporte_mensal=X`** (criatividade R4): campo "E se eu guardar (R$ por mês)?" no cartão do fundo, com o valor no endereço (`?aporte_mensal=1500,5`), "Voltar ao valor calculado" e o Voltar do navegador; mostra o mês da meta ou "não alcança a meta em 60 meses" (`custo_total` e `preco_na_compra` `null` como "—", fundo fora do destaque); aporte inválido (campo ou endereço) nunca vai ao servidor; `422` junto ao campo.
- [x] Simulação sem opções: só à vista e fundo, com o convite e o link para adicionar opções.
- [x] Estados de carregamento (esqueleto), erro (**Tentar de novo**) e 404 (o mesmo estado da edição).

**Validado:** testes com fixtures reais (destaque no à vista, no fundo e num financiamento; empate; 0, 2 e 3 opções; modo aporte com `null`; série com `null`; aporte no endereço, cache, Voltar do navegador e valores inválidos sem chamada); paridade automática com o backend real (formato, mensagens do aporte, séries vivas no código do gráfico); no navegador pelo autor (12 itens: números iguais aos do Swagger, gráfico e legenda, aporte, valores inválidos, sem opções, fundo vence, atualização depois de mudar, erros e celular).
**Notas:** 1381 testes em 59 arquivos; nenhuma dependência nova nem ícone novo (continuam os 5); **bundle 1.126 kB** (o Recharts entrou; o build já avisa de chunk grande e a divisão do código fica como possibilidade da Etapa 8). Decisões do autor: detalhes dentro do cartão, sempre visíveis; campo do aporte no cartão do fundo com o valor no endereço; um único gráfico com legenda clicável; texto fixo do custo total mais etiqueta e borda; link "Ver parcelas" já nesta etapa. Nomes finais (diferentes dos previstos): `DadosDaSimulacao` virou o cabeçalho de `Resultado.jsx`; entraram `SimulacaoNaoEncontrada` (extraído da edição), `utils/aporteNaUrl.js` e `utils/serieDoGrafico.js`. Achados do backend real: `menor_custo` só assume `a_vista` ou `fundo`, empate vai para o à vista, o fundo vence com IPCA negativo, três mensagens do aporte diferiam dos mocks (corrigidas), `saldo_devedor` vem `{}` sem opções. A Etapa 7 herda os links "Ver parcelas" e o `formatarMes`/`formatarPrazo`.

## Etapa 7 — Tela de amortização
**Arquivos:** `src/api/parcelas.js` (ou em `financiamentos.js`), `src/hooks/useParcelas.js`, `src/pages/Amortizacao.jsx`, `src/components/{TabelaAmortizacao,ResumoFinanciamento}.jsx`

- [ ] `GET /api/simulacoes/:id/financiamentos/:fid/parcelas` → `{financiamento, parcelas, totais}`: uma linha por mês (parcela, juros, amortização e `saldo_devedor` **após** o pagamento), exibida como vem (parcelas 0,00 após quitação antecipada incluídas).
- [ ] Cabeçalho com dados da opção (nome, sistema, taxa % a.m., prazo, valor financiado) e linha de **totais** vinda da API.
- [ ] Tabela com rolagem horizontal no celular, cabeçalho fixo, valores em reais e, se ajudar a leitura, mini-gráfico da amortização (extra do R4).
- [ ] 404 (simulação ou opção inexistente/alheia) e carregamento/erro tratados; botão de voltar ao resultado.
- [ ] Ordem de erros: dono da simulação (404) → opção (404).

**Validar:** teste da tabela com fixture (linhas e totais como vêm); no navegador: Price e SAC de uma simulação real, comparando primeira/última parcela e totais com o `/resultado`.

## Etapa 8 — Tratamento de erros, responsividade e ajustes finais
**Arquivos:** `src/components/{ErrorBoundary,Aviso,EstadoErro,Carregando}.jsx`, `src/pages/NaoEncontrada.jsx`, ajustes transversais, `src/theme.js`

- [ ] Camada única de mensagens de erro em pt-BR: rede fora do ar, timeout, 401, 404, 409, 422 (por campo), 500 genérico e 503; nunca mostrar detalhe técnico nem corpo cru do servidor.
- [ ] `ErrorBoundary` global e página 404 da SPA.
- [ ] Feedback visual consistente (R4): *snackbars* de sucesso/erro, esqueletos, botões com progresso, estados vazios ilustrados, avisos de índice desatualizado.
- [ ] Revisão de **responsividade** (largura de celular, tablet e desktop) em todas as telas, incluindo formulários, cartões, gráfico e tabela.
- [ ] Acessibilidade básica: rótulos nos campos, foco visível, contraste, `aria-label` em ícones, gráfico com descrição textual, navegação por teclado nos diálogos.
- [ ] Revisão dos textos, formatação (reais, %) e títulos de página (`document.title`); nenhum `console.log` esquecido; sem `dangerouslySetInnerHTML`.
- [ ] Desempenho: divisão por rota (`React.lazy`) se o bundle do gráfico pesar; sem chamadas repetidas desnecessárias (cache do React Query com `staleTime` adequado).
- [ ] Cobertura de testes das lacunas: mapeamento de `detalhes`, mensagens de erro, `ErrorBoundary`.

**Validar:** roteiro manual de erros (backend parado, token apagado no meio da sessão, 409, 422, 503 dos índices, id inexistente na URL) em desktop e em largura de celular; `npm test`, `npm run lint` e `npm run build` verdes.

## Etapa 9 — Exportação por impressão (opcional)
**Status: só se houver tempo, depois da Etapa 8.**
**Arquivos:** `src/pages/Resultado.jsx`, `src/components/BotaoImprimir.jsx`, estilos `@media print` (no tema ou em `sx`)

- [ ] Botão "Imprimir / salvar em PDF" (`window.print()`) na tela de resultado.
- [ ] Estilos de impressão: esconde barra superior e botões, mantém cartões, gráfico e tabela, evita quebra no meio de cartão, título e data no topo.
- [ ] Sem biblioteca de geração de PDF.

**Validar:** pré-visualização de impressão do navegador (Chrome e Firefox) mostrando resultado legível em A4.

## Etapa 10 — Dockerfile (só `Dockerfile`, sem docker-compose)
**Arquivos:** `Dockerfile`, `nginx.conf`, `.dockerignore`

- [ ] **Multi-stage:** estágio de build (`node`, `npm ci`, `npm run build`, `ARG VITE_API_URL`) e estágio final `nginx:alpine` servindo `dist/` na porta 80.
- [ ] `nginx.conf` com **fallback de SPA** (qualquer rota → `index.html`), cache longo para os arquivos com hash em `assets/` e sem cache para o `index.html`; cabeçalhos básicos de segurança.
- [ ] `.dockerignore`: `node_modules`, `dist`, `.env*`, `docs`, `api`, `*.md`, `.git`, `coverage`.
- [ ] Sem segredos na imagem; a `VITE_API_URL` entra como `--build-arg` (o Vite a embute no build).
- [ ] `HEALTHCHECK` simples (resposta 200 em `/`); usuário não-root se a imagem escolhida permitir.
- [ ] Comandos documentados (para o README):

```
docker build --build-arg VITE_API_URL=http://localhost:5000/api -t rota-financeira-web .
docker run -d --name rota-financeira-web -p 8080:80 rota-financeira-web
```

**Validar:** `docker build` e `docker run`; abrir `http://localhost:8080`, **recarregar uma rota interna** (`/simulacoes`) para provar o fallback, e exercitar o fluxo completo (registrar → login → criar → opções → resultado → excluir) contra o backend, que precisa ter `http://localhost:8080` no `CORS_ORIGINS`. Conferir que a imagem não contém `.env` nem `node_modules`.

## Etapa 11 — README com fluxograma da arquitetura
**Arquivos:** `README.md`, `docs/img/arquitetura.dot` (ou outra fonte), `docs/img/arquitetura.png`, `docs/img/arquitetura.svg`

- [ ] `README.md` bem formatado (cabeçalhos, listas, blocos de código), com: título e descrição; funcionalidades; tecnologias; **pré-requisitos** (Node, backend no ar); **instalação e execução local** (`npm install`, `cp .env.example .env`, `npm run dev`); **variável** `VITE_API_URL`; **como subir o backend** (link para o repositório dele) e o `CORS_ORIGINS`; scripts (`test`, `lint`, `build`, `preview`); **execução em Docker** (build-arg, porta, CORS); telas e rotas da SPA; endpoints consumidos; estrutura de pastas; nota de que o cálculo é do backend.
- [ ] **Fluxograma da arquitetura** (obrigatório, R2) com um cenário de uso: usuário → SPA (React) → API Flask (JWT) → PostgreSQL e BACEN/SGS (cache), mostrando, por exemplo, "criar simulação com taxas sugeridas e ver o resultado". Se usar Graphviz, é só ferramenta de desenho, não dependência; incluir a imagem no README.
- [ ] Capturas de tela das principais telas (formulário, resultado com gráfico, amortização) em `docs/img/` (ajudam o R4).
- [ ] **Regra:** todo comando do README é executado do zero antes de entregar; ao mudar comando, variável ou porta, atualizar o README e refazer o teste.

**Validar:** clonar o repositório em pasta limpa e seguir o README literalmente, local e em Docker; conferir o fluxograma (legível, sem informação desatualizada).

## Etapa 12 — Revisão final e entrega
**Arquivos:** `CLAUDE.md`, `README.md`, `plano.md`, repositório

- [ ] Remover a pasta `api/` do repositório publicado (já no `.gitignore`) e conferir que não há segredos, `.env` nem arquivos do backend no histórico.
- [ ] Nomes conforme o R6: componentes e páginas em `PascalCase.jsx`, hooks em `useAlgo.js`, demais módulos em `camelCase`, pastas em minúsculas; nada fora do padrão.
- [ ] Estrutura de pastas clara e igual à descrita no `CLAUDE.md` e no README (atualizar o que mudou).
- [ ] Checklist dos requisitos: R1 (4 métodos exercitados pela interface), R2/R5 (README + fluxograma), R3 (Dockerfile testado), R4 (gráficos, cartões, feedback visual, sugestão de taxas, modo de aporte), R6 (repositório público separado).
- [ ] Suíte completa: `npm test`, `npm run lint`, `npm run build`, `docker build`; roteiro manual ponta a ponta contra o backend real e em celular.
- [ ] Atualizar o `CLAUDE.md` (situação dos requisitos, contagem de testes, estado atual) e marcar este plano como concluído.
- [ ] Você faz o commit e o push final para o GitHub (repositório público); depois conferir a página no navegador, sem login no GitHub.

**Validar:** clone limpo, README seguido do zero, todos os comandos verdes, requisitos marcados como atendidos no `CLAUDE.md`.

---

## Riscos e pontos de atenção

- **URL da API é fixada no build** (Vite): mudar a URL exige novo `build`; no Docker, via `--build-arg`.
- **CORS:** sem a origem da SPA em `CORS_ORIGINS` do backend (`:5173` no dev, `:8080` no Docker) o navegador bloqueia tudo; é a primeira coisa a checar quando "nada carrega".
- **401 do login não é sessão expirada:** tratar à parte para evitar loop de redirecionamento.
- **Divergência proposta × backend:** validação é 422 (não 400); entrada da simulação aceita `≤` o valor do veículo, a da opção exige `<`. Vale o backend.
- **Números:** nunca recalcular no cliente; `custo_total` tem significado próprio (o que se paga pelo carro) e precisa de explicação na tela.
- **Séries com `null`:** sem `connectNulls={false}` o gráfico mente sobre o fim dos financiamentos e do fundo.
- **Token de 60 min, sem refresh:** a sessão expira no meio do uso; a experiência de "sessão expirada" precisa ser clara.
- **Escopo:** sem paginação, ordenação nem filtros no histórico (decisão do autor); exportação é opcional.
- **Prazo:** se apertar, cortar nesta ordem: Etapa 9 (exportação), extras do R4 (modo de aporte, mini-gráficos), refinos de acessibilidade — nunca R1, R2, R3, R5 e R6.
