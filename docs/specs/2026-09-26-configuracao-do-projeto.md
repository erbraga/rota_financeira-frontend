# Configuração do projeto, client HTTP, tema, mocks e testes (Etapa 1) — Spec

**Criado em:** 2026-09-26
**Status:** Concluída em 2026-09-26 (decisões 1 a 10 resolvidas; critérios de aceite verificados)
**Etapa do plano:** 1 (`plano.md`) · **Requisito:** R1 (base para as chamadas HTTP)

## Problema
O repositório tem só documentação (Etapa 0): não há `package.json`, `src/`, build, lint nem testes. Sem uma base
comum, cada tela das próximas etapas teria de resolver por conta própria a URL da API, o token, o tratamento de
`401`, o formato de erro do backend, a formatação em reais e a maneira de testar sem depender do backend no ar.

## Objetivo
Entregar um projeto React (Vite) que **sobe, compila, passa no lint e nos testes**, com as rotas da SPA em telas
provisórias, o tema do Material UI, o **client HTTP centralizado** (token, `401`, `204`, erros tipados, timeout),
os utilitários de formatação, e a infraestrutura de testes com mocks (MSW) que reproduz o contrato da API,
inclusive os erros.

## Fora de escopo
- Telas de verdade (registro, login, histórico, formulários, resultado, amortização): **Etapas 2 a 7**.
- `AuthProvider`, `RotaProtegida`, `sessionStorage` do token: **Etapa 2** (a Etapa 1 só deixa o **ponto de
  encaixe** no client HTTP).
- Funções por recurso (`api/auth.js`, `api/simulacoes.js`...) e hooks do React Query por recurso: nas etapas de cada
  recurso. Nesta etapa só existe o hook/uso necessário ao indicador de estado da API.
- `Dockerfile`, `nginx.conf` (Etapa 10) e README (Etapa 11).
- Responsividade fina, acessibilidade, `ErrorBoundary` e catálogo de mensagens de erro (Etapa 8).
- `@mui/icons-material`, Recharts em uso (a dependência entra agora; o gráfico só na Etapa 6), TypeScript,
  Storybook, CI/CD.
- Modo de desenvolvimento com mocks **no navegador** (`dev:mock`) e `public/mockServiceWorker.js` (decisão 8).

## Proposta

### O que foi verificado (estado atual)
| Item | Situação |
|---|---|
| Repositório | Etapa 0 concluída; `main` publicada; `.nvmrc` = `24`; **sem** `package.json` nem `src/` |
| Node / npm | `v24.18.0` / `11.16.0` (satisfaz o `engines` de todas as dependências abaixo; `jsdom` exige `^24.15`) |
| Backend | no ar em `http://localhost:5000` (`/api/saude` 200); Swagger em `/apidocs/`, OpenAPI 3.0.2 em `/apispec.json` com **16 operações** |
| CORS do backend | libera `http://localhost:5173` e `:3000` (não `:4173`, a porta padrão do `vite preview`); expõe `Location`; preflight 600 s |
| Conta de teste | `teste@example.com` criada e validada (registro 201, login 200, perfil 200) |

### Contrato observado que o client e os mocks precisam refletir
- **Erro:** sempre `{"erro": "mensagem", "detalhes": {campo: [mensagens]}?}`, com `Content-Type: application/json`,
  inclusive nos 404/405/415/400. `401` traz `WWW-Authenticate: Bearer`. `422` de validação:
  `{"erro": "Dados inválidos", "detalhes": {"email": ["Campo obrigatório."], ...}}`.
- **Códigos por operação** (do OpenAPI): login `200/400/401/415/422`; registrar `201/400/409/415/422`; perfil
  `200/401`; índices `200/401/404/422/503`; simulações `GET 200`, `POST 201/400/401/415/422`, `GET id 200/404`,
  `PUT 200/400/404/415/422`, `DELETE 204/404`; financiamentos `GET 200/404`, `POST 201/400/404/409/415/422`,
  `PUT 200/…/422`, `DELETE 204/404`; parcelas `200/404`; resultado `200/404/422`.
- **Login:** `{access_token, token_type: "Bearer", expires_in: 3600, usuario: {id, nome, email}}`.
- **Simulação:** `{id, nome, valor_veiculo, valor_entrada, taxa_ipca_projetada, taxa_fundo_rendimento,
  prazo_meses_fundo, criado_em}` (sem `usuario_id`). Lista: `{itens, total}`.
- **Financiamento:** `{id, nome, taxa_juros_mensal, prazo_meses, sistema_amortizacao, valor_entrada}` (o
  `valor_financiado` só aparece no `/resultado`).
- **Parcela:** `{numero, valor_parcela, juros, amortizacao, saldo_devedor}` (dentro de `{financiamento, parcelas, totais}`).
- **Índices:** o caminho é minúsculo (`/api/indices/cdi`), mas o corpo traz `indice: "CDI" | "IPCA"` em
  **maiúsculas**; `sugestao` é **anulável** (o formulário precisa funcionar sem ela); `atualizado_em` também.
- **`GET /api/saude`** (pública): `{"banco": "ok", "status": "ok"}` (503 se o banco cair).
- Esses pontos devem ser levados ao `CLAUDE.md` ao concluir a etapa (a anulabilidade de `sugestao` e a caixa
  de `indice`, principalmente).

### Dependências (todas justificadas; versões do registro do npm em 2026-09-26)
| Pacote | Versão | Para quê |
|---|---|---|
| `react`, `react-dom` | 19.3.0 | biblioteca da SPA |
| `react-router-dom` | 7.18.4 | roteamento (`BrowserRouter`); mantido como no plano/proposta (a v7 o reexporta de `react-router`) |
| `@tanstack/react-query` | 5.104.0 | cache e estados de carregamento/erro do servidor |
| `react-hook-form` | 7.89.0 | formulários |
| `zod` | 4.6.5 | schemas de validação (com `@hookform/resolvers` 5.9.1, que aceita Zod 4) |
| `@mui/material` | 9.4.0 | biblioteca de componentes (com `@emotion/react` 11.14.0 e `@emotion/styled` 11.14.1) |
| `recharts` | 3.10.1 | gráficos (uso na Etapa 6; `react-is` é peer dependency dele) |
| **dev:** `vite` 8.3.1, `@vitejs/plugin-react` 6.1.1 | | build e dev server |
| **dev:** `vitest` 5.0.2, `jsdom` 30.1.1 | | testes e ambiente de DOM |
| **dev:** `@testing-library/react` 16.3.3, `@testing-library/dom` (peer), `@testing-library/user-event` 14.6.7, `@testing-library/jest-dom` 7.0.1 | | testes de componentes |
| **dev:** `msw` 2.15.0 | | mocks de HTTP (Node nos testes) |
| **dev:** `eslint` 10.11.0, `@eslint/js` 10.0.1, `eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-react-refresh` 0.5.7, `globals` 17.12.0 | | lint |

`package-lock.json` versionado; versões **fixas** pelo lock (o `package.json` usa `^`). A compatibilidade real
(Vite 8 + plugin-react 6 + Vitest 5 + MUI 9 + Recharts 3) é conferida com `npm install`, `build`, `lint` e `test`.

### Estrutura criada nesta etapa
```
package.json  package-lock.json  vite.config.js  eslint.config.js  index.html  .env.example
src/
  main.jsx            # providers: StrictMode > QueryClientProvider > ThemeProvider+CssBaseline > BrowserRouter > App
  App.jsx             # rotas da SPA
  config.js           # lê e valida VITE_API_URL
  queryClient.js      # QueryClient com a política de repetição e cache (decisão 5)
  theme.js            # tema do Material UI (pt-BR)
  api/
    api.js            # client HTTP centralizado (fetch)
    erros.js          # ErroApi e ErroRede
  utils/formatar.js   # reais, percentual, datas e leitura de números digitados
  pages/              # telas provisórias: Login, Registro, Simulacoes, SimulacaoForm, Resultado, Amortizacao, NaoEncontrada
  components/         # Layout (barra superior simples + área de conteúdo), EstadoApi (indicador temporário), TelaConfiguracao
  mocks/              # handlers e servidor MSW (Node), fixtures/
  setupTests.js
```

### Comportamento do client HTTP (`api.js`)
- **URL:** `urlApi` (de `VITE_API_URL`, sem barra final) + caminho (`/simulacoes`...). Só este módulo conhece a URL base.
- **Interface:** função central `requisicao(metodo, caminho, opcoes)` e atalhos `get`, `post`, `put`, `remover`
  (`delete` é palavra reservada). `opcoes`: `corpo`, `semAutenticacao` (true para login e registro), `signal`
  (cancelamento vindo do React Query) e `timeoutMs`.
- **Cabeçalhos:** `Accept: application/json`; `Content-Type: application/json` só quando há corpo;
  `Authorization: Bearer <token>` quando existe token e a chamada não é `semAutenticacao`.
- **Sessão (encaixe da Etapa 2):** `configurarSessao({ obterToken, aoExpirar })`. O `AuthProvider` registra as duas
  funções; o client **não importa** o contexto. Sem configuração, não envia token e `aoExpirar` é um no-op.
- **Resposta:** `204` → `null` (sem `.json()`); `2xx` com JSON → objeto; `2xx` com corpo inválido → `ErroApi`
  genérico; `4xx/5xx` → `ErroApi` com `status`, `erro` (mensagem do backend ou uma genérica por status quando o
  corpo não é o JSON esperado, ex.: página de erro de um proxy) e `detalhes` (objeto por campo, ou `undefined`).
- **401:** se a chamada não for `semAutenticacao`, chama `aoExpirar()` **uma vez** e lança `ErroApi(401)`. No login e
  no registro **não** chama (401 = "Credenciais inválidas").
- **Rede/timeout:** falha do `fetch` (servidor fora do ar, CORS bloqueado, DNS) → `ErroRede`; estouro do timeout →
  `ErroRede` com `porTimeout: true`. Cancelamento pelo chamador (`signal` abortado) **não** é convertido: o
  `AbortError` segue adiante para o React Query ignorá-lo. Timeout padrão de **15 s** (o backend espera até 8 s pelo
  BACEN); combina o `signal` do chamador com o do timeout.
- **Segurança:** nunca loga token, senha nem corpo; não guarda o token (quem guarda é a Etapa 2).

### React Query (`queryClient.js`)
Um único `QueryClient` com a política da decisão 5: função `retry` que **não repete** `ErroApi` com status `4xx`
(o `401` nunca), repete **no máximo 1 vez** erros de rede (`ErroRede`) e `5xx`; `staleTime` de 30 s;
`refetchOnWindowFocus: false`. Mutações não repetem. Nos testes, cada teste cria o seu próprio `QueryClient`
(sem repetição e sem cache compartilhado).

### Utilitários (`utils/formatar.js`)
- `formatarMoeda(n)` → `R$ 1.234,56` (`Intl.NumberFormat('pt-BR', BRL)`).
- `formatarPercentual(n)` → taxa **em percentual** (`12.5` → `12,50%`), 2 a 6 casas (sem zeros inúteis além das 2 primeiras).
- `formatarData(texto)` → `dd/mm/aaaa`. Datas só com dia (`"2026-09-01"`, `data_referencia`) são lidas **como
  data local**, não UTC (evita mostrar o dia anterior no Brasil); `criado_em` (ISO com fuso) é exibido no fuso do navegador.
- `lerNumero(texto)` → `{ valor }` (campo vazio: `valor: null`) ou `{ valor: null, erro }` para o que o usuário digita nos campos (regra na decisão 6; o retorno em objeto foi escolhido na implementação, para distinguir vazio de inválido).
- `numeroParaCampo(n)` → texto para preencher campos de edição (`12.5` → `"12,5"`).

### Tema (`theme.js`)
`createTheme` com `ptBR` do MUI (textos dos componentes em português), paleta primária azul e secundária verde-azulada
(valores ajustáveis na revisão), `shape.borderRadius` maior, botões sem caixa alta, tipografia conforme a decisão 4,
e `CssBaseline`. Apenas modo claro (o modo escuro não faz parte do escopo).

### Rotas e telas provisórias
`/` redireciona para `/simulacoes`; as demais rotas da tabela do `CLAUDE.md` renderizam um componente provisório com
título (`document.title` = "Rota Financeira") e o texto "em construção"; qualquer outra rota mostra
`NaoEncontrada` (404 da SPA). **Sem proteção de rota ainda** (a `RotaProtegida` é da Etapa 2). O `Layout` mostra o
`EstadoApi`, um indicador temporário que chama `GET /api/saude` pelo React Query e exibe "API conectada" ou o erro
(exercita `VITE_API_URL`, o client e o **CORS no navegador**, que o `curl` não prova).

### Configuração (`config.js`) e ambiente
- `.env.example` versionado com `VITE_API_URL=http://localhost:5000/api`; o `.env` real é ignorado pelo Git.
- Se `VITE_API_URL` faltar ou não for uma URL `http(s)` válida, o `main.jsx` renderiza uma tela clara de
  configuração ausente (`TelaConfiguracao`) em vez de uma tela em branco. Nos testes, a variável vem da
  configuração do Vitest.
- O Vite lê a variável **no build**: mudar a URL exige novo build (relevante para a Etapa 10).

### Scripts, Vite e lint
- `dev` (Vite, porta **5173** com `strictPort: true`, para falhar em vez de subir em outra porta que o CORS do
  backend recusaria); `build`; `preview` (porta **3000**, `strictPort`, já liberada no CORS do backend; a padrão 4173 não
  é); `lint` (`eslint . --max-warnings 0`); `test` (`vitest run`); `test:watch` (`vitest`).
- `package.json`: `name` `rota-financeira-frontend`, `private`, `type: module`, `engines.node` `>=24`.
- ESLint em *flat config* com as recomendações do JS, `react-hooks` e `react-refresh`, mais os globais do
  navegador e do Vitest; `dist/` e `coverage/` ignorados.
- `index.html`: `lang="pt-BR"`, título "Rota Financeira", `viewport` e um favicon SVG mínimo embutido (evita o 404 do
  `/favicon.ico` no console). Nenhum arquivo de demonstração do template do Vite (contador, logos, `App.css`).

### Mocks (MSW) e testes
- **Handlers** (`src/mocks/`) para as 16 operações do contrato, com armazenamento em memória reiniciado a cada teste:
  registro/login/perfil; simulações (CRUD, isoladas por usuário); financiamentos (CRUD, **409** no 4º, entrada
  menor que o veículo); `resultado` (com `null` nas séries e o modo `aporte_mensal`); `parcelas`; índices
  (`cdi`/`ipca`, **404** para outros, `desatualizado` e **503** por comando do teste). Todos os erros usam o
  formato `{"erro", "detalhes"}` do backend (`401` com `WWW-Authenticate`).
- **Fixtures** (`src/mocks/fixtures/`): dados fixos; nenhum teste calcula resultado financeiro (regra do projeto).
  Como obtê-las: decisão 7.
- **Ambiente dos testes:** `jsdom` para componentes; os testes do **client HTTP rodam em ambiente `node`**
  (docblock `@vitest-environment node`), porque o `AbortController`/`AbortSignal` do `jsdom` pode ser recusado pelo
  `fetch` nativo do Node. `globals: true` (necessário para a limpeza automática do Testing Library),
  `@testing-library/jest-dom/vitest` no `setupTests.js`, `onUnhandledRequest: "error"` no MSW (chamada sem handler
  quebra o teste, nunca vai à rede).
- **Testes desta etapa** (arquivos `*.test.js(x)` ao lado do código, decisão 9):
  - `api`: injeta o token; **não** injeta em `semAutenticacao`; `204` → `null`; `422` → `ErroApi` com `detalhes`;
    erro sem JSON (`502` HTML) → `ErroApi` genérico; `401` chama `aoExpirar` uma vez, mas **não** no login;
    servidor fora do ar → `ErroRede`; timeout → `ErroRede` com `porTimeout`; `signal` abortado → `AbortError`;
    barra final da URL base normalizada; `Content-Type` só com corpo.
  - `formatar`: moeda, percentual, datas (com `TZ` fixado em `America/Sao_Paulo`, incluindo `"2026-09-01"`),
    `lerNumero` (todos os casos da decisão 6) e `numeroParaCampo`.
  - `queryClient`: a função `retry` (nunca em `4xx`, 1 vez em rede/`5xx`, nunca no `401`) e os valores de `staleTime` e `refetchOnWindowFocus`.
  - `config`: URL ausente, inválida e com barra final.
  - `App`: cada rota renderiza sua tela provisória, `/` redireciona, rota desconhecida mostra a 404,
    `EstadoApi` mostra "conectada" (mock 200) e o erro (mock 503 e falha de rede).
  - `mocks`: cada handler responde no formato do contrato (proteção contra a deriva dos mocks).
- Todo teste que valida um comportamento precisa poder **falhar**: para os de `401` e `signal`, um controle
  (a mesma chamada com a opção invertida) prova que o teste é sensível.

### Casos de borda
- **`npm install` com conflito de peer dependencies** (versões muito novas): registrar a versão que foi preciso
  fixar e o motivo; não usar `--force` nem `--legacy-peer-deps` sem decisão.
- **Porta 5173 ocupada:** o `dev` falha (por `strictPort`) em vez de subir em 5174 e receber CORS recusado.
- **Backend fora do ar em desenvolvimento:** o `EstadoApi` mostra o erro de rede; a SPA continua navegável.
- **Backend recusando a origem** (CORS): no navegador aparece como falha de rede, não como erro da API; o
  `EstadoApi` deixa isso visível logo na Etapa 1.
- **`VITE_API_URL` com barra final** ou espaços: normalizada/recusada em `config.js`, com teste.
- **Resposta `204` e `.json()`:** nunca chamado sem checar.
- **Datas "só dia" em fuso negativo:** testadas com `TZ` do Brasil.

## Decisões em aberto
Resolvidas em 2026-09-26 (decisões do autor):
1. ~~Versões das dependências~~ **Usar as mais recentes da tabela, com recuo se falhar:** se um par não instalar ou
   não compilar, desce uma major só daquele pacote e o motivo é registrado nesta spec e no `CLAUDE.md` (a idade
   das majors atuais: Vitest 5 tem ~3 semanas; MUI 9, ~5 meses; Vite 8 e plugin-react 6, ~6 meses; ESLint 10, ~7 meses).

2. ~~Como criar o esqueleto~~ **Template `react` (JavaScript) do `create-vite`, gerado em pasta temporária fora do
   repositório, copiando só o necessário** (`vite.config.js`, `eslint.config.js`, `index.html` e o mínimo de `src/`);
   descartar o demo, o `README.md` e o `.gitignore` do template. Nunca rodar o `create-vite` dentro desta pasta
   (sobrescreveria o `.gitignore`).

3. ~~Prettier~~ **Não usar** (só o ESLint; menos dependências e configuração). Pode ser adicionado depois, sem
   retrabalho no código.

4. ~~Fonte do tema~~ **Pilha de fontes do sistema** (`system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial,
   sans-serif`), sem `@fontsource` e sem Google Fonts (a SPA não chama serviços externos).

5. ~~Política de repetição e cache do React Query~~ **Ajustada ao projeto:** **sem repetição** para erros `4xx`
   (o `401` nunca é repetido); no máximo **1 repetição** para erros de rede e `5xx`; `staleTime` de **30 s**;
   `refetchOnWindowFocus` **desligado**. Vale como padrão global do `QueryClient` (uma tela pode sobrescrever).

6. ~~Leitura de números digitados (`lerNumero`)~~ **Pontuação pt-BR estrita:** o **ponto só vale como separador de
   milhar, em grupos de exatamente 3 dígitos** (`95.000`, `1.234.567,89`), e a **vírgula é o decimal** (`95.000,50`,
   `0,85`). Qualquer outro uso do ponto (`12.5`, `0.85`) é inválido, com a mensagem "Use vírgula para decimais
   (ex.: 12,5)". Vale para todo campo de valor e taxa. Demais regras: espaços nas pontas ignorados; sinal `-` só no
   início (o IPCA pode ser negativo); campo vazio → `null`; notação científica, letras e mais de uma vírgula → inválido;
   nunca arredonda. Casos-limite testados: `1.234` → 1234, `12.500` → 12500, `12.5` → inválido, `1.23.456` →
   inválido, `.5` e `5.` → inválidos.

7. ~~Fixtures dos mocks~~ **Capturadas do backend real com uma conta descartável:** o Claude registra
   `mock-<aleatório>@example.com` com senha aleatória **que não é gravada em lugar nenhum**, cria uma simulação e 2
   opções de exemplo (uma Price e uma SAC), e salva em `src/mocks/fixtures/` as respostas de `/resultado` (com e sem
   `aporte_mensal`), `/parcelas`, listas, detalhe e índices. **Consequência aceita:** o backend não exclui usuários,
   então a conta e seus dados permanecem no banco de desenvolvimento. Nas fixtures só entram dados fictícios (o
   e-mail `@example.com` é trocado por um valor fixo, sem `id` de usuário real nem token). Um teste de formato
   (`mocks`) garante que os handlers continuam devolvendo a forma do contrato.

8. ~~Mocks no navegador (`npm run dev:mock`)~~ **Não agora:** os mocks (MSW) servem só aos testes, em Node; não há
   `public/mockServiceWorker.js` nem script `dev:mock`. O modo pode ser adicionado depois reaproveitando os handlers
   (por exemplo, se o frontend for avaliado sem o backend), sem retrabalho.

9. ~~Onde ficam os testes~~ **Ao lado do código** (`api.test.js` junto de `api.js`, dentro de `src/`); `mocks/` e
   `setupTests.js` continuam em `src/`. O Vitest só considera `src/**/*.test.{js,jsx}`.

10. ~~`EstadoApi` (indicador "API conectada")~~ **Temporário, removido na Etapa 2** (quando o login provar o mesmo
    caminho de verdade); na Etapa 8 a mensagem de "sem conexão com o servidor" nasce das chamadas reais, não de um
    selo permanente. Nunca aparece na interface final.

Sem decisões em aberto: a spec está pronta para o `/plan`.

## Critérios de aceite
- [x] `npm install` termina sem erro e **sem avisos de peer dependency**; `package-lock.json` existe; nenhum pacote
      fora da tabela (exceto o `@testing-library/dom` e o `react-is` exigidos como peers).
- [x] `npm run lint` passa com **zero avisos**; `npm run build` gera `dist/` sem avisos novos; `npm test` verde.
- [x] `npm run dev` sobe em `http://localhost:5173`; com o backend no ar, a página mostra **"API conectada"**
      **no navegador** (prova do CORS e da `VITE_API_URL`); com o backend parado, mostra o erro de rede; a página
      continua navegável.
- [x] Com `VITE_API_URL` ausente, a SPA mostra a tela de configuração (não fica em branco).
- [x] As rotas `/simulacoes`, `/simulacoes/nova`, `/simulacoes/1/editar`, `/simulacoes/1/resultado`,
      `/simulacoes/1/financiamentos/1`, `/login` e `/registrar` mostram a tela provisória; `/` vai para
      `/simulacoes`; `/qualquer-coisa` mostra a 404; **recarregar** uma rota interna no `dev` funciona.
- [x] Os testes do client HTTP cobrem todos os comportamentos listados, incluindo os controles negativos.
- [x] `lerNumero` segue a decisão 6: `95.000` → 95000, `95.000,50` → 95000,5, `1.234` → 1234, `0,85` e `-1,5` válidos,
      `12.5`, `0.85`, `1.23.456`, `.5`, `5.`, `1e3`, `abc` e `1,2,3` inválidos, vazio → `null`.
- [x] As fixtures em `src/mocks/fixtures/` vêm do backend real (conta descartável), não contêm token, senha nem
      e-mail real, e o teste de formato dos handlers passa.
- [x] O `EstadoApi` existe só nesta etapa e está listado para remoção na Etapa 2 (decisão 10).
- [x] O `dist/` de produção contém a URL da API embutida e **não** contém `.env` nem o `mockServiceWorker.js`.
- [x] `.env.example` está versionado e o `.env` é ignorado (`git check-ignore -v .env`); `git ls-files`
      (após o seu commit) não lista `node_modules/`, `dist/` nem `.env`.
- [x] Nomes conforme o R6: componentes e páginas em `PascalCase.jsx`, demais módulos em `camelCase.js`.
- [x] Nenhum arquivo de demonstração do template do Vite permanece; nenhum `console.log` no código entregue.
- [x] O `CLAUDE.md` é atualizado com o estado da etapa, a contagem de testes, as decisões desta spec e os dois
      pontos do contrato (`sugestao` anulável e `indice` em maiúsculas).

## Plano de Implementação

**Status:** executado em 2026-09-26 (T1 a T27) · **Criado em:** 2026-09-26

São 27 tarefas pequenas, em blocos. Cada tarefa indica **quem executa** (**Claude** ou **Você**), os arquivos, o que
muda e como validar. O código de cada módulo nasce **junto com os seus testes** (arquivos `*.test.js(x)` ao lado).
Regras para todo o plano:
- O Claude **não** roda `git add`, `commit` nem `push` (os commits são seus); os arquivos ficam no working tree.
- **Recuo de versão (decisão 1):** se um par de pacotes não instalar, não compilar ou quebrar os testes, a tarefa
  **para**, eu relato o erro, desço uma major só daquele pacote, registro o motivo na spec e no `CLAUDE.md` e sigo.
  Sem `--force` nem `--legacy-peer-deps`.
- Nenhum teste calcula resultado financeiro; cada teste que valida um comportamento tem um **controle** que prova que
  ele pode falhar.
- Segredos: a conta descartável (T18) usa senha aleatória que **não** é impressa nem gravada; nenhum token, senha ou
  e-mail real entra em arquivo.
- Ao fim de cada tarefa que altera código: `npm run lint` (zero avisos) e `npm test` verdes, exceto onde indicado.

**Ordem e dependências:** A → B → C → D → E. Dentro do bloco B, T8 a T10 formam a construção do client HTTP em
passos. T18 (fixtures) precisa do **backend no ar** (está rodando desde a Etapa 0). T24 é a única verificação que
exige o navegador, e é sua.

### Bloco A — Esqueleto e ferramentas

**T1 · Claude · Gerar o template do Vite fora do repositório**
- Arquivos: nenhum do repositório (pasta de rascunho fora dele).
- O que muda: gero o template `react` (JavaScript) do `create-vite` na pasta de rascunho e listo o que ele trouxe.
- Validar: a lista de arquivos e as versões do template estão anotadas; o repositório não recebeu nenhum arquivo
  novo (`git status --short` inalterado).

**T2 · Claude · Criar o `package.json`**
- Arquivos: `package.json` (novo).
- O que muda: nome `rota-financeira-frontend`, `private`, `type: module`, `engines.node >=24`, scripts (`dev`,
  `build`, `preview`, `lint` com `--max-warnings 0`, `test` = `vitest run`, `test:watch` = `vitest`) e as
  dependências da tabela da spec (mais `@testing-library/dom` e `react-is`, exigidos como peers).
- Validar: `node -e "JSON.parse(require('fs').readFileSync('package.json'))"` sem erro; os scripts listados existem;
  nenhum pacote fora da tabela.

**T3 · Claude · Instalar e checar as dependências**
- Arquivos: `package-lock.json` (novo); `node_modules/` (ignorado).
- O que muda: `npm install` com as versões da spec.
- Validar: `npm install` sem erro **nem aviso de peer dependency**; `npm ls` sem `invalid`/`UNMET`/`extraneous`;
  `git check-ignore -v node_modules` confirma o ignore; se algo falhar, aplico o recuo da decisão 1 e registro.

**T4 · Claude · Configurar Vite, ESLint e `index.html`**
- Arquivos: `vite.config.js`, `eslint.config.js`, `index.html`, `.env.example` (novos), `.env` (local, ignorado).
- O que muda: `dev` na porta 5173 e `preview` na 3000, ambos com `strictPort`; bloco `test` do Vitest (`jsdom`,
  `globals`, `setupFiles`, `include: src/**/*.test.{js,jsx}`, `VITE_API_URL` de teste, `TZ` do Brasil); ESLint
  *flat* (JS recomendado, `react-hooks`, `react-refresh`, globais de navegador e Vitest, ignorando `dist/` e
  `coverage/`); `index.html` com `lang="pt-BR"`, título "Rota Financeira", `viewport` e favicon SVG embutido;
  `.env.example` com `VITE_API_URL=http://localhost:5000/api` (o `.env` recebe o mesmo valor).
- Validar: `git check-ignore -v .env` ignora e `git check-ignore .env.example` não (controle); `node -e "import('./vite.config.js')"`
  carrega sem erro; a validação completa do lint, do build e do Vitest vem na T5, com código real.

**T5 · Claude · Infra de testes e teste de fumaça**
- Arquivos: `src/setupTests.js`, `src/main.jsx` e `src/App.jsx` mínimos, `src/fumaca.test.jsx` (temporário).
- O que muda: `setupTests.js` com o `jest-dom` e uma trava que falha o teste em `console.error` inesperado (ex.: aviso
  de `act`); `main.jsx`/`App.jsx` renderizam só um título, apenas para o build e o teste terem o que compilar; um teste
  de fumaça renderiza o `App` num `ThemeProvider` do MUI.
- Validar: `npm test` verde (prova Vitest 5 + jsdom 30 + React 19 + Testing Library + MUI 9 juntos); `npm run lint`
  e `npm run build` verdes; `npm run dev` sobe em 5173 (`curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`
  = 200) e uma **segunda** instância (`npm run dev` de novo) falha por `strictPort`, sem subir em 5174 (controle).

### Bloco B — Núcleo: configuração, erros, client HTTP, cache, formatação

**T6 · Claude · `config.js`**
- Arquivos: `src/config.js`, `src/config.test.js`.
- O que muda: lê `VITE_API_URL`, remove a barra final, recusa vazia, sem `http(s)` ou com espaços, e devolve
  `{ urlApi }` ou o motivo do erro (para a `TelaConfiguracao`).
- Validar: `npm test` cobre URL ausente, inválida, com espaços e com barra final; o teste da URL válida serve de
  controle (sem ele, o teste de "inválida" passaria por engano).

**T7 · Claude · `erros.js`**
- Arquivos: `src/api/erros.js`, `src/api/erros.test.js`.
- O que muda: `ErroApi` (`status`, `erro`, `detalhes`) e `ErroRede` (`porTimeout`), mais um auxiliar para reconhecer
  cada um (sem depender de `instanceof` entre módulos).
- Validar: `npm test` cobre construção, mensagens, `detalhes` opcional e os auxiliares.

**T8 · Claude · Client HTTP, parte 1: URL, cabeçalhos e sucesso**
- Arquivos: `src/api/api.js`, `src/api/api.test.js`, `src/mocks/servidor.js` (servidor MSW em Node, sem handlers).
- O que muda: `requisicao`, `get`, `post`, `put`, `remover`; junta a URL base ao caminho; `Accept`; `Content-Type`
  só com corpo; `Authorization` quando há token e a chamada não é `semAutenticacao`; `204` → `null`; JSON → objeto;
  `configurarSessao({ obterToken, aoExpirar })`. Os testes registram os próprios handlers (`servidor.use`), sem
  depender dos handlers grandes da T19. `onUnhandledRequest: "error"`.
- Validar: `npm test` (arquivo em ambiente `node`, por docblock) cobre: token injetado, **não** injetado em
  `semAutenticacao` (controle), `Content-Type` só com corpo, `204` → `null`, barra final da base normalizada.

**T9 · Claude · Client HTTP, parte 2: erros da API e `401`**
- Arquivos: `src/api/api.js`, `src/api/api.test.js`.
- O que muda: `4xx/5xx` → `ErroApi` com `erro` e `detalhes`; corpo que não é o JSON esperado (ex.: `502` em HTML) →
  `ErroApi` com mensagem genérica por status; `2xx` com corpo inválido → `ErroApi` genérico; `401` chama `aoExpirar()`
  **uma vez** e lança `ErroApi(401)`, exceto em `semAutenticacao`.
- Validar: `npm test` cobre `422` com `detalhes`, `404`, `409`, `502` HTML, `2xx` inválido; `401` chama `aoExpirar`
  exatamente uma vez e o **mesmo** `401` com `semAutenticacao` **não** chama (controle); sem `configurarSessao`, o
  `401` não quebra.

**T10 · Claude · Client HTTP, parte 3: rede, timeout e cancelamento**
- Arquivos: `src/api/api.js`, `src/api/api.test.js`.
- O que muda: falha do `fetch` → `ErroRede`; timeout (padrão 15 s, configurável por `timeoutMs`) → `ErroRede` com
  `porTimeout: true`; `signal` do chamador combinado com o do timeout; cancelamento pelo chamador mantém o `AbortError`.
- Validar: `npm test` cobre servidor fora do ar (`Failed to fetch`), timeout curto (50 ms) contra handler lento,
  `signal` abortado → `AbortError` (e **não** `ErroRede`), e o controle: sem abortar, a mesma chamada retorna normalmente.
  Se o `fetch` recusar o `signal` no ambiente de teste, aplico o plano B da spec (ambiente `node`, já em uso).

**T11 · Claude · `queryClient.js`**
- Arquivos: `src/queryClient.js`, `src/queryClient.test.js`.
- O que muda: `QueryClient` com `retry` (nunca em `4xx`, incluindo `401`; 1 vez em `ErroRede` e `5xx`), `staleTime`
  30 s, `refetchOnWindowFocus: false`, mutações sem repetição; e uma função `criarQueryClient()` para os testes
  criarem o seu (sem repetição).
- Validar: `npm test` cobre a função `retry` para `404`, `401`, `422`, `409` (nunca), `ErroRede` e `503` (uma vez,
  não na segunda tentativa) e os valores de `staleTime` e `refetchOnWindowFocus`.

**T12 · Claude · `formatar.js`, parte 1: moeda, percentual e data**
- Arquivos: `src/utils/formatar.js`, `src/utils/formatar.test.js`.
- O que muda: `formatarMoeda`, `formatarPercentual` (2 a 6 casas) e `formatarData` (data só com dia lida como data
  local; `criado_em` no fuso do navegador).
- Validar: `npm test` cobre `R$ 1.234,56`, `0`, negativos, `12,50%` e `0,850000` → `0,85%`, e `"2026-09-01"` → `01/09/2026`
  com `TZ=America/Sao_Paulo` (a `vite.config.js` fixa o fuso); controle: um `new Date("2026-09-01")` ingênuo devolve o
  dia 31 nesse fuso, provando que o teste detectaria o erro; roda também com `TZ=UTC npm test` para conferir que o
  resultado não depende do fuso da máquina.

**T13 · Claude · `formatar.js`, parte 2: `lerNumero` e `numeroParaCampo`**
- Arquivos: `src/utils/formatar.js`, `src/utils/formatar.test.js`.
- O que muda: `lerNumero` com a pontuação pt-BR estrita da decisão 6 e `numeroParaCampo` (`12.5` → `"12,5"`).
- Validar: `npm test` com a tabela de casos: `95000`, `95.000`, `95.000,50`, `1.234.567,89`, `1234,56`, `0,85`,
  `-1,5`, ` 12 `, vazio → `null`; inválidos: `12.5`, `0.85`, `1.23.456`, `.5`, `5.`, `1e3`, `abc`, `1,2,3`, `--1`;
  `1.234` → 1234 e `12.500` → 12500; ida e volta `lerNumero(numeroParaCampo(n)) === n`.

### Bloco C — Tema, telas provisórias e rotas

**T14 · Claude · Tema do Material UI**
- Arquivos: `src/theme.js`, `src/theme.test.js`.
- O que muda: `createTheme` com `ptBR`, paleta (primária azul, secundária verde-azulada), `borderRadius`, botões sem
  caixa alta e a pilha de fontes do sistema (decisão 4); só modo claro.
- Validar: `npm test` confere a pilha de fontes (`system-ui` primeiro, sem Roboto exclusivo), o locale `ptBR` e
  `text-transform: none` nos botões; `npm run lint` verde.

**T15 · Claude · Telas provisórias e página 404**
- Arquivos: `src/pages/{Login,Registro,Simulacoes,SimulacaoForm,Resultado,Amortizacao,NaoEncontrada}.jsx`,
  `src/components/TelaConfiguracao.jsx`, testes ao lado.
- O que muda: cada tela provisória mostra um título e "em construção"; `NaoEncontrada` é a 404 da SPA;
  `TelaConfiguracao` explica como definir `VITE_API_URL`.
- Validar: `npm test` renderiza cada componente e confere o título; nomes em `PascalCase.jsx`.

**T16 · Claude · `Layout` e `EstadoApi`**
- Arquivos: `src/components/{Layout,EstadoApi}.jsx`, `src/components/{Layout,EstadoApi}.test.jsx`.
- O que muda: `Layout` (barra superior simples e área de conteúdo com `<Outlet />`) exibe o `EstadoApi`, que chama
  `GET /saude` por React Query e mostra "API conectada", "sem conexão com o servidor" (`ErroRede`) ou o erro da API.
- Validar: `npm test` com `servidor.use` cobrindo `200` → "API conectada", `503` → erro da API e servidor fora
  do ar → mensagem de rede; o teste de `200` é o controle dos outros dois.

**T17 · Claude · `App.jsx` e `main.jsx`**
- Arquivos: `src/App.jsx`, `src/main.jsx`, `src/App.test.jsx`; remoção de `src/fumaca.test.jsx`.
- O que muda: rotas da tabela do `CLAUDE.md` (`/` redireciona para `/simulacoes`, `*` mostra a 404) dentro do
  `Layout`; providers `StrictMode > QueryClientProvider > ThemeProvider + CssBaseline > BrowserRouter`; se `config.js`
  falhar, renderiza a `TelaConfiguracao`; o teste de fumaça da T5 sai.
- Validar: `npm test` cobre cada rota, o redirecionamento de `/`, a 404, e `EstadoApi` dentro do `Layout`;
  `npm run build` verde; `npm run dev` + `curl` em `/simulacoes/1/resultado` devolve o `index.html` (fallback do
  Vite) com 200.

### Bloco D — Mocks (MSW)

**T18 · Claude · Capturar as fixtures do backend real**
- Arquivos: `src/mocks/fixtures/*.json` (novos); script descartável na pasta de rascunho (não versionado).
- O que muda: registro uma conta `mock-<aleatório>@example.com` com senha aleatória **que não é impressa nem
  gravada**, crio uma simulação e 2 opções (Price e SAC) e salvo as respostas de detalhe, listas, `/resultado`
  (sem e com `aporte_mensal`), `/parcelas` (Price e SAC) e índices `cdi` e `ipca`; troco e-mail e `id` de
  usuário por valores fixos; o token não é gravado.
- Validar: `grep -rniE "token|senha|password|mock-.*@|Bearer" src/mocks/fixtures` sem resultado; os arquivos são JSON
  válidos (`node -e`); `resultado` traz `null` nas séries e as chaves de `saldo_devedor` por `id`; o backend continua
  sem alterações versionadas (`git -C ../rota_financeira-backend status --short` vazio). A conta descartável fica no
  banco de desenvolvimento (consequência aceita na decisão 7).

**T19 · Claude · Handlers MSW: saúde, auth, simulações e financiamentos**
- Arquivos: `src/mocks/handlers/{saude,auth,simulacoes,financiamentos}.js`, `src/mocks/{banco,erros}.js` (armazenamento
  em memória e respostas de erro no formato do backend), testes ao lado.
- O que muda: handlers de `GET /saude`; `POST /auth/registrar` (201, 409, 422), `POST /auth/login` (200, 401, 422),
  `GET /auth/perfil`; CRUD de simulações isolado por usuário (404 uniforme); CRUD de financiamentos com **409** no 4º
  e entrada menor que o veículo; `401` com `WWW-Authenticate: Bearer` sem token; erros como `{erro, detalhes}`.
- Validar: `npm test` chama cada handler e confere status, cabeçalhos e forma; outro usuário recebe 404; o 4º
  financiamento recebe 409 e o 3º **não** (controle); o armazenamento é zerado a cada teste (`resetHandlers`/`reiniciar`).

**T20 · Claude · Handlers MSW: resultado, parcelas e índices**
- Arquivos: `src/mocks/handlers/{resultado,parcelas,indices}.js`, testes ao lado.
- O que muda: `resultado` e `parcelas` devolvem as fixtures da T18 (sem recalcular), com o modo `aporte_mensal`
  (e 422 para parâmetro inválido); índices `cdi` e `ipca` (404 para qualquer outro, incluindo `selic`), com atalhos
  de teste para `desatualizado: true`, `sugestao: null` e **503**.
- Validar: `npm test` confere que a resposta é igual à fixture, que `selic` → 404, `periodo` inválido → 422, os três
  modos de índice e que `resultado` mantém `null` nas séries; o teste do caso feliz é o controle dos de erro.

**T21 · Claude · Teste de formato dos mocks**
- Arquivos: `src/mocks/contrato.test.js`.
- O que muda: um teste percorre todos os handlers e confere as **chaves obrigatórias** de cada resposta contra o
  contrato observado (Simulação, Financiamento, Parcela, Resultado, Índice, Erro), em `src/mocks/contrato.js`.
- Validar: `npm test` verde; controle: remover uma chave de uma fixture em memória (dentro do teste) faz o teste
  de formato **falhar**, provando que ele detecta deriva.

### Bloco E — Verificação e fechamento

**T22 · Claude · Verificação completa**
- Arquivos: nenhum (só leitura, salvo correções).
- O que muda: rodo a suíte e o build de ponta a ponta.
- Validar: `npm run lint` com zero avisos; `npm test` verde (registro a contagem); `npm run build` sem avisos;
  `npm ls` sem problemas; `dist/` contém a URL da API e **não** contém `.env` nem `mockServiceWorker.js`
  (`grep -r "localhost:5000" dist` acha; `find dist -name "mockServiceWorker*"` não acha); nenhum arquivo do template
  do Vite (`App.css`, `assets/react.svg`, `public/vite.svg`) nem `console.log` (`grep -rn "console\.log" src`).

**T23 · Claude · Verificação do servidor de desenvolvimento e do `preview`**
- Arquivos: nenhum.
- O que muda: só verificação por linha de comando.
- Validar: `npm run dev` responde 200 em `/`, `/login`, `/simulacoes/nova` e `/qualquer-coisa` (fallback de SPA);
  `npm run build && npm run preview` serve na **3000** e uma segunda instância falha por `strictPort`; a origem
  `http://localhost:3000` recebe `Access-Control-Allow-Origin` do backend (preflight) e a `:4173` **não** (controle).

**T24 · Você · Verificação no navegador**
- Arquivos: nenhum.
- O que muda: com `npm run dev` rodando (eu subo) e o backend no ar, você abre `http://localhost:5173` e confere,
  com o console do navegador aberto (F12):
  1. aparece **"API conectada"** e o console **não** mostra erro de CORS;
  2. navegar por `/login`, `/registrar`, `/simulacoes`, `/simulacoes/nova`, `/simulacoes/1/editar`,
     `/simulacoes/1/resultado`, `/simulacoes/1/financiamentos/1` mostra as telas provisórias, e **recarregar (F5)**
     em uma rota interna continua funcionando; `/qualquer-coisa` mostra a 404;
  3. com o backend **parado** (peça-me para pará-lo), o indicador mostra "sem conexão com o servidor" e a SPA
     continua navegável; depois peça para religá-lo e recarregue: volta a "API conectada";
  4. com o `.env` **renomeado** (`mv .env .env.off`) e o `dev` reiniciado, aparece a tela de configuração (e não uma
     página em branco); depois desfaça o nome.
- Validar: você me diz o resultado de cada item; qualquer falha vira correção antes da T25.

**T25 · Claude · Registrar a conclusão da etapa**
- Arquivos: `plano.md` (Etapa 1), `CLAUDE.md`, esta spec.
- O que muda: marco a Etapa 1 como concluída no `plano.md` (com versões finais e recuos, se houve); o `CLAUDE.md`
  ganha as versões, a contagem de testes, os comandos reais (`npm test`, `npm run lint`, `dev` 5173 e `preview`
  3000), as decisões desta spec e os dois pontos do contrato (`sugestao` anulável e `indice` em maiúsculas); a spec
  passa a "Concluída" com os critérios marcados.
- Validar: releitura dos três arquivos; `git ls-files --others --exclude-standard` lista **só** o que deve ser
  publicado (código, configuração, `package-lock.json`, `.env.example`, docs) e **não** `node_modules/`, `dist/`, `.env`
  nem `CLAUDE.md`.

**T26 · Você · Commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica a etapa. Sugestão: `git add .` (o `.gitignore` já exclui o que não deve ir),
  conferir com `git status`, `git commit` e `git push`.
- Validar: `git status` limpo; push sem erro.

**T27 · Claude · Confirmar a publicação**
- Arquivos: nenhum.
- O que muda: só verificação do que foi publicado.
- Validar: `git ls-remote origin main` devolve o novo hash; a listagem de conteúdo do repositório na API pública do
  GitHub mostra `package.json`, `package-lock.json`, `src`, `.env.example` e **não** `node_modules`, `dist`, `.env`,
  `CLAUDE.md`, `api` nem `.claude`.

### Mapa dos critérios de aceite
| Critério | Tarefas |
|---|---|
| `npm install` sem avisos de peer e sem pacotes fora da tabela | T2, T3 |
| `lint` zero avisos, `build` sem avisos, `test` verde | T5, T22 |
| `dev` em 5173, "API conectada" no navegador, erro de rede com o backend parado | T5, T16, T24 |
| Sem `VITE_API_URL` → tela de configuração | T6, T15, T17, T24 |
| Rotas provisórias, redirecionamento, 404 e recarga de rota interna | T15, T17, T23, T24 |
| Testes do client HTTP e controles negativos | T8, T9, T10 |
| `lerNumero` conforme a decisão 6 | T13 |
| Fixtures do backend real, sem token/senha/e-mail real, teste de formato | T18, T21 |
| `EstadoApi` só nesta etapa | T16, T25 |
| `dist/` com a URL embutida, sem `.env` nem `mockServiceWorker.js` | T22 |
| `.env.example` versionado e `.env` ignorado; `git ls-files` limpo | T4, T25, T27 |
| Nomes conforme o R6 e nenhum arquivo de demo nem `console.log` | T15, T22, T25 |
| `CLAUDE.md` atualizado | T25 |

### Riscos
- **Pares novos** (Vitest 5, Vite 8, plugin-react 6, MUI 9): a T5 é o teste de fumaça que revela incompatibilidade
  cedo; a decisão 1 dá a regra de recuo.
- **`AbortSignal` no `jsdom`:** os testes do client rodam em ambiente `node`; se ainda assim o `fetch` recusar o
  sinal, a T10 registra o motivo e decide com você antes de trocar de abordagem.
- **Ruído de `act` do React 19** nos testes: a trava da T5 falha o teste em vez de deixar o aviso passar; se ficar
  barulhenta demais, eu proponho relaxá-la (nunca desligá-la sem avisar).
- **Fixtures e banco de desenvolvimento:** a T18 cria uma conta descartável que permanece no banco (decisão 7).
- **CORS só se prova no navegador:** por isso a T24 é sua e obrigatória antes de encerrar a etapa.
- **Tamanho do plano:** 27 tarefas; as T8 a T10 e as T19 a T21 são as mais longas. Se preferir, posso executar cada
  bloco e parar para a sua revisão ao fim dele.

---
*Plano aguardando aprovação. Nenhuma tarefa foi executada.*

### Registro da execução (2026-09-26)
- **Versões:** todas as da tabela instalaram sem recuo; 324 testes em 15 arquivos, `lint` sem avisos, `build` de ~450 kB (143 kB gzip).
- **Desvios do planejado:** o template do `create-vite` 9.2 trouxe **oxlint** (não ESLint), então `eslint.config.js` foi escrito à mão; o risco do `AbortSignal` no `jsdom` **não** se materializou no Vitest 5 (os testes de componente usam `fetch` e MSW no `jsdom`), mas os testes do client seguem em ambiente `node`; foram criados `Raiz.jsx` (providers e tela de configuração testáveis), `testUtils.jsx` e `mocks/chamar.js`; uma 10ª fixture (`resultado-aporte-insuficiente.json`) foi capturada ao descobrir que o modo aporte tem dois casos; `ignoreRestSiblings` foi ligado no ESLint.
- **Descobertas de contrato** (já no `CLAUDE.md`): `sugestao` e `atualizado_em` anuláveis e `indice` em maiúsculas; `alcanca_a_meta` só é falso no modo aporte quando a meta não é atingida em 60 meses.
- **Verificação no navegador (T24, pelo autor):** "API conectada" sem erro de CORS; rotas e recarga de rota interna; backend parado mostra "Sem conexão com o servidor"; sem `.env`, tela "Configuração ausente".
- **Resíduo:** 2 contas descartáveis (`mock-...@example.com`) ficaram no banco de desenvolvimento do backend.
- **Publicação (T26 e T27):** o primeiro push (`cfb2501`) saiu **sem `src/api/`**, porque a regra `api/` do `.gitignore` ignorava também essa pasta; corrigida para `/api/` e publicada em `a392936`. **Verificação do zero:** clone do repositório público numa pasta limpa, com `npm ci`, `npm ls`, `lint` (0 avisos), `test` (324 em 15 arquivos) e `build` verdes (62 arquivos em `src/`, URL da API embutida, sem `.env` nem `mockServiceWorker.js` no `dist/`).

