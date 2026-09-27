# Autenticação: registro, login, sessão e rotas protegidas (Etapa 2) — Spec

**Criado em:** 2026-09-26
**Status:** Concluída em 2026-09-26 (decisões 1 a 8 resolvidas; critérios de aceite verificados)
**Etapa do plano:** 2 (`plano.md`) · **Requisitos:** R1 (primeiros `POST` e `GET` pela interface), R4 (feedback visual)

## Problema
A SPA tem rotas e um client HTTP, mas nenhuma noção de **usuário**: as telas `Login` e `Registro` são provisórias, todas
as rotas são abertas, o client nunca recebe um token (`configurarSessao` não é chamada por ninguém) e um `401` da API
não leva a lugar nenhum. Sem sessão não há como chamar nenhuma rota protegida do backend, que é o que as Etapas 3 a 7
consomem. Há ainda um indicador temporário (`EstadoApi`) que só existia para provar a integração e precisa sair.

## Objetivo
Permitir que a pessoa **crie uma conta, entre, permaneça logada ao recarregar a página, saia** e seja levada ao login
quando a sessão expirar, com as rotas privadas protegidas e mensagens de erro claras junto aos campos (`422`/`409`) e
no formulário (`401`), sem loop de redirecionamento.

## Fora de escopo
- Qualquer tela de negócio (simulações, financiamentos, resultado): **Etapas 3 a 7**; elas continuam provisórias, agora atrás da proteção.
- Recuperação de senha, troca de senha, edição do perfil, exclusão de conta, verificação de e-mail e login social: o backend não os oferece.
- Refresh token e revogação: o backend não tem (o token dura 60 min e não é revogável; sair só descarta o token no cliente).
- Limitação de tentativas (*rate limiting*) e CAPTCHA: são do backend.
- Modo escuro, internacionalização e o catálogo completo de mensagens de erro (Etapa 8).
- Alterações no repositório do backend.

## Proposta

### O que foi verificado (estado atual)
| Item | Situação |
|---|---|
| Client HTTP | `api/api.js`: `configurarSessao({ obterToken, aoExpirar })` existe e nunca é chamada; `semAutenticacao` evita token e o tratamento de 401 |
| Rotas | `App.jsx`: tudo dentro do `Layout`, sem proteção; `Login` e `Registro` são `EmConstrucao` |
| `EstadoApi` | usado só pelo `Layout` e testado em `EstadoApi.test.jsx` (temporário, sai nesta etapa) |
| Mocks | handlers de `registrar`, `login` e `perfil` existem, mas divergem do backend real (ver abaixo) |
| Dependências | React Hook Form, Zod, `@hookform/resolvers`, MUI, Router e Query já estão instalados; a **única dependência nova** é `@mui/icons-material` 9.4.0 (decisão 3) |
| Backend | no ar; conta de teste `teste@example.com` existe |

### Contrato observado (backend real, 2026-09-26)
- `POST /api/auth/registrar` → `201 {id, nome, email, criado_em}` (sem token). `422` com `detalhes` por campo; `409 {"erro": "E-mail já cadastrado"}` (sem `detalhes`). A validação (`422`) vem **antes** do `409`. O e-mail é normalizado (minúsculas, sem espaços nas pontas).
- Mensagens reais de `422` (em português): `"Campo obrigatório."`, `"O nome deve ter entre 2 e 120 caracteres."`, `"E-mail inválido."`, `"A senha deve ter entre 8 e 128 caracteres."`, `"Campo desconhecido."`. Não há regra de composição de senha.
- `POST /api/auth/login` → `200 {access_token, token_type: "Bearer", expires_in: 3600, usuario: {id, nome, email}}`. `401 {"erro": "Credenciais inválidas"}` igual para e-mail inexistente e senha errada (**sem** `WWW-Authenticate` neste caso). **`422 "E-mail inválido."` também no login** (formato) e `"Campo obrigatório."`.
- `GET /api/auth/perfil` → `200 {id, nome, email, criado_em}`. `401` com `WWW-Authenticate: Bearer` e a mensagem `Token de autenticação ausente | Token inválido | Token expirado` (um esquema diferente de `Bearer`, como `Basic`, conta como "ausente").
- Tudo é JSON com `{erro, detalhes?}`; `415` sem `Content-Type: application/json`, `400` para JSON quebrado.

### Desvios dos mocks a corrigir nesta etapa
Os handlers da Etapa 1 foram escritos sem consultar cada mensagem do backend; três diferem do real e um teste de contrato não os pegou porque compara só as **chaves**:
1. O login dos mocks **não** valida o formato do e-mail (o real responde `422 "E-mail inválido."`).
2. Os `422` do registro usam mensagens genéricas (`"Deve ter entre 2 e 120 caracteres."`) em vez das reais acima.
3. Um esquema `Authorization` diferente de `Bearer` deve dar `"Token de autenticação ausente"` (hoje dá `"Token inválido"`); o `401` do login não deve trazer `WWW-Authenticate`.

### Estrutura criada e alterada
```
src/
  auth/
    tokenStorage.js      # lerToken / gravarToken / apagarToken no sessionStorage, tudo em try/catch
    contextoAuth.js      # createContext (separado para o react-refresh do ESLint)
    AuthProvider.jsx     # estado da sessão; liga o client HTTP; entrar / sair; validação do perfil
    useAuth.js           # hook do contexto
    RotaProtegida.jsx    # <Outlet /> só com sessão válida; senão, login ou tela de erro/carregamento
    SoVisitantes.jsx     # (decisão 6) redireciona quem já está logado para fora de /login e /registrar
  api/auth.js            # registrar(dados), login(dados), obterPerfil({ signal }) sobre o client
  schemas/auth.js        # esquemas Zod de registro e login (mensagens em pt-BR)
  utils/errosDeFormulario.js  # aplicarErrosDoServidor(erro, setError, campos) -> mensagem geral ou null
  pages/Login.jsx  pages/Registro.jsx          # telas reais (substituem as provisórias)
  components/Layout.jsx                        # barra com nome do usuário e Sair; sem EstadoApi
  components/{CampoSenha,LayoutPublico}.jsx     # LayoutPublico (decisão 2); CampoSenha com IconButton de olho (decisão 3)
  # removidos: components/EstadoApi.jsx e EstadoApi.test.jsx
```
`App.jsx` passa a: rotas públicas (`/login`, `/registrar` e a 404 `*`, no `LayoutPublico`) e rotas privadas (`/`, `/simulacoes...`) atrás da
`RotaProtegida`, no `Layout` com a barra. `Raiz.jsx` põe o `AuthProvider` dentro do `BrowserRouter`.

### `AuthProvider`: comportamento
- **Estado:** `token` (inicial vindo do `sessionStorage`) e o **usuário**, obtido por uma consulta React Query `['perfil']`
  (`GET /auth/perfil`, só quando há token, **sem repetição**). O React Query evita a duplicidade de chamadas que um
  `useEffect` teria sob o `StrictMode`. Expõe `{ status, usuario, entrar, sair }` com `status` = `sem-sessao` |
  `validando` | `autenticado` | `erro`.
- **Ligação com o client HTTP:** ao montar, chama `configurarSessao({ obterToken, aoExpirar })`; `obterToken` lê um
  **ref** (atualizado de forma síncrona, para a requisição logo depois do login já levar o token); ao desmontar, `configurarSessao({})`.
- **`entrar(email, senha)`:** `POST /auth/login` (`semAutenticacao`); em sucesso grava o token (memória e `sessionStorage`), semeia
  `['perfil']` com o `usuario` da resposta e devolve; **erros sobem** para o formulário tratar.
- **`sair()`:** apaga o token, cancela e limpa o cache do React Query (`cancelQueries` + `clear`) e leva a `/login`
  (`replace`, sem `de`). Não chama o backend (não há endpoint).
- **`aoExpirar` (qualquer `401` fora do login):** idempotente (várias respostas `401` em paralelo geram **uma** só
  saída): apaga o token, cancela e limpa o cache e leva a `/login` (`replace`) com `state: { motivo: 'sessao-expirada', de: <rota atual> }`.
- **Início com token guardado:** `status` = `validando` até o `perfil` responder; `401` → mesma saída de sessão
  expirada; erro de rede ou `5xx` → `status` = `erro` (a RotaProtegida mostra "Não foi possível verificar sua sessão",
  com **Tentar de novo** e **Sair**), sem apagar o token (o backend pode só estar fora do ar).
- **`sessionStorage`:** chave única; leitura, escrita e remoção em `try/catch`. Se o storage estiver indisponível
  (modo privado restrito, política do navegador), a sessão funciona **só em memória** (some ao recarregar), sem erro na tela.
- **Segurança:** o token nunca vai para URL, log, mensagem de erro nem chave de cache; a senha nunca é guardada nem logada.

### `RotaProtegida` e redirecionamentos
- `sem-sessao` → `<Navigate to="/login" replace state={{ de: <rota pedida> }} />`; `validando` → indicador de carregamento
  (`role="progressbar"`, "Verificando sua sessão…"), **sem piscar** a tela de login; `erro` → tela de erro com as duas ações; `autenticado` → `<Outlet />`.
- Depois do login, volta para `state.de` (só caminhos internos; ignora `/login` e `/registrar`) ou, sem ele, `/simulacoes`.
- A rota desconhecida (`*`) mostra a 404 para qualquer pessoa, no `LayoutPublico`.

### Telas
- **Login** (`/login`): e-mail e senha (React Hook Form + Zod). Envio desabilitado durante a requisição (sem duplo envio).
  `401` → alerta "E-mail ou senha incorretos." no formulário, **sem redirecionar** (decisão 5); `422` → mensagens junto aos campos; falha de
  rede/timeout → alerta com a mensagem do `ErroRede`. Mostra avisos vindos do estado da rota: sessão expirada
  ("Sua sessão expirou. Entre novamente."), conta criada e saída ("Você saiu da sua conta.", decisão 8). Link para **Criar conta**.
- **Registro** (`/registrar`): nome, e-mail, senha, **confirmação da senha** (só no cliente, nunca enviada). Regras espelham o
  backend (nome 2 a 120, e-mail válido, senha 8 a 128; senha **sem** `trim`). `409` → erro no campo e-mail
  ("E-mail já cadastrado"); `422` → junto aos campos; sucesso → login com o aviso "Conta criada" e o e-mail preenchido (decisão 1). Link para **Entrar**.
- **Barra superior (`Layout`, só nas telas privadas):** nome do app (link para `/simulacoes`), nome do usuário (oculto em telas estreitas) e **Sair**. As telas públicas usam o `LayoutPublico` (cartão centralizado).
- **Acessibilidade:** `label` em todo campo, `autoComplete` (`email`, `current-password`, `new-password`), `noValidate`
  (as mensagens são as do Zod, em português), foco no primeiro campo inválido, alertas com `role="alert"`, título `h1` por tela, Enter envia.

### Erros de formulário (`utils/errosDeFormulario.js`)
`aplicarErrosDoServidor(erro, setError, camposDoFormulario)`: cada chave de `detalhes` que é campo do formulário vira
`setError(campo, mensagem)` (primeira mensagem); chaves desconhecidas e erros sem `detalhes` viram **mensagem geral**
(o `erro` do backend ou, para `ErroRede`, a mensagem própria dele). Será reaproveitada pelos formulários das Etapas 3 e 5.

### Mocks e testes
- Corrigir os três desvios acima; o teste de contrato dos mocks passa a conferir também as **mensagens** de `422` e `409` de auth.
- Utilitário de teste `renderizar` ganha a opção de sessão (`autenticado: true` grava um token de teste e usa o `perfil` dos mocks), para as demais telas continuarem testáveis atrás da proteção.
- Testes (cada um com controle que prova que pode falhar):
  - `tokenStorage`: grava/lê/apaga; storage que **lança** (leitura, escrita e remoção) não quebra e cai para memória.
  - `errosDeFormulario`: `422` com campos, com campo desconhecido, `409`, erro sem `detalhes`, `ErroRede`.
  - `schemas/auth`: limites (nome 1/2/120/121, senha 7/8/128/129, e-mail), confirmação diferente, senha com espaços preservada.
  - `AuthProvider`/`RotaProtegida`: sem token → `/login` lembrando a rota; token válido → conteúdo; **carregando sem piscar o login**; `perfil` `401` → login com aviso e token apagado; rede/`5xx` → tela de erro com Tentar de novo (e o token **não** é apagado); **duas respostas `401` em paralelo geram uma saída**; `sair` limpa o token e o cache; `entrar` deixa o `perfil` semeado (sem chamada extra).
  - `Login`: sucesso volta à rota pedida (e vai a `/simulacoes` sem ela); `401` mostra o alerta **sem** navegar (controle: o mesmo `401` numa rota protegida **navega**); `422` por campo; rede fora do ar; sem duplo envio.
  - `Registro`: sucesso; `409` no campo e-mail; `422`; confirmação diferente não chama a API.
  - `Layout`: nome e Sair aparecem só com sessão; `EstadoApi` não existe mais.
  - `App`: rotas privadas exigem sessão, públicas não, 404 aberta a todos.

### Casos de borda
- **Token corrompido ou vencido no storage:** o `perfil` responde `401` e a sessão é descartada com o aviso, sem loop.
- **Backend fora do ar ao abrir a SPA com token:** tela de erro com **Tentar de novo**; o token é mantido.
- **Várias requisições recebendo `401` ao mesmo tempo:** uma só saída e um só aviso.
- **Sair com requisições em andamento:** são canceladas antes de limpar o cache (nada volta a preencher o cache depois).
- **Sessão expira com o formulário preenchido:** os dados digitados são perdidos (aviso claro; sem rascunho nesta etapa).
- **Botão Voltar depois de sair:** `replace` impede voltar a uma tela privada; se voltar, a proteção redireciona.
- **Duas abas:** o `sessionStorage` é por aba; cada aba tem a sua sessão (esperado, decisão do autor).
- **Redirecionamento aberto:** `de` só aceita caminho interno que começa com `/` e não com `//`.
- **`StrictMode`:** a ligação com o client HTTP e a consulta do `perfil` toleram a montagem dupla do modo de desenvolvimento.
- **E-mail:** o cliente só remove espaços das pontas; a normalização (minúsculas) é do backend.

## Decisões em aberto
Resolvidas em 2026-09-26 (decisões do autor):
1. ~~Depois de criar a conta~~ **Ir ao login, com o aviso "Conta criada! Entre com seu e-mail e senha." e o e-mail já
   preenchido** (via `state` da rota). Registro e login continuam independentes; nenhum login automático.

2. ~~Layout das telas públicas~~ **Cartão centralizado, sem a barra do app:** um `LayoutPublico` (nome do app e um
   cartão com o formulário) para `/login`, `/registrar` **e a 404**; o `Layout` com a barra (nome do usuário e Sair) fica
   só nas rotas privadas. O `LayoutPublico` não mostra nome de usuário nem Sair, e tem teste para isso.

3. ~~Mostrar/ocultar a senha~~ **Ícone de olho, com `@mui/icons-material`** (**dependência nova**, escolha do autor; a
   recomendação do Claude era o botão de texto). Versão **9.4.0**, a mesma do `@mui/material` instalado (peer
   `@mui/material ^9.4.0`, compatível com React 19). Justificativa: visual padrão do Material UI para o campo de senha.
   Uso restrito: importar só os ícones necessários por caminho (`@mui/icons-material/Visibility` e
   `@mui/icons-material/VisibilityOff`), para não puxar o pacote inteiro (~19 MB instalados) para o bundle nem
   deixar o servidor de desenvolvimento lento. Acessibilidade mantida: `IconButton` com nome acessível que muda
   ("Mostrar senha" / "Ocultar senha"), `aria-pressed`, e no cadastro o botão alterna os **dois** campos juntos; a senha
   volta a ficar oculta ao enviar. Consequências: `package.json`/`package-lock.json` mudam, o `CLAUDE.md` passa a listar
   o pacote (hoje diz "ícones só se necessário") e o teste do build confere que só esses dois ícones entram no bundle.

4. ~~Expiração do token (60 min)~~ **Só reagir ao `401`:** sem relógio, sem temporizadores e sem guardar `expires_in`;
   o `401` encerra a sessão com o aviso e o `perfil` valida o token ao abrir a SPA. Consequência aceita: quem fica
   parado mais de uma hora só descobre ao tentar salvar algo (os dados digitados se perdem). Um aviso "a sessão pode ter
   expirado" ao voltar para a aba pode entrar na Etapa 8, se fizer sentido.

5. ~~Texto do `401` do login~~ **"E-mail ou senha incorretos."** (texto fixo do frontend, igual para e-mail inexistente e
   senha errada, sem revelar qual falhou; a mensagem do backend não é exibida nesse caso). O alerta fica no formulário
   (`role="alert"`), sem redirecionar; o e-mail digitado é mantido, a senha é limpa e o foco volta para o campo de senha.

6. ~~Quem já está logado abre `/login` ou `/registrar`~~ **Redirecionar para `/simulacoes`** (`replace`), por um componente
   `SoVisitantes`. Regras: com sessão **válida** (`autenticado`) redireciona; com sessão em **validação** mostra o
   carregamento, sem piscar o formulário; com token **vencido** o `perfil` dá `401`, a sessão é descartada e a pessoa
   **continua** em `/login`, com o aviso de sessão expirada; sem sessão abre normalmente. Tem teste com o controle (o
   mesmo `/login` sem sessão abre).

7. ~~Regras da senha no cadastro~~ **Só as do backend: 8 a 128 caracteres**, sem regra de composição, com a dica "8 a 128
   caracteres" junto ao campo. A senha não sofre `trim` (espaços e símbolos valem). Um indicador de força (informativo)
   fica como melhoria futura, fora desta etapa.

8. ~~Depois de clicar em Sair~~ **Ir ao login com o aviso "Você saiu da sua conta."** (`state: { motivo: 'saiu' }`,
   informativo, `role="status"`; some ao recarregar). Junto dos avisos "sessão expirada" e "conta criada", todo motivo de
   cair no login tem um aviso; só um aparece por vez.

Sem decisões em aberto: a spec está pronta para o `/plan`.

## Critérios de aceite
- [x] `npm run lint` (0 avisos), `npm test` e `npm run build` verdes; a única dependência nova em `package.json` é `@mui/icons-material` (mesma versão do `@mui/material`), e o `npm ls` continua sem problemas.
- [x] No `dist/`, só os ícones `Visibility` e `VisibilityOff` do `@mui/icons-material` entram (importação por caminho, não pelo pacote inteiro).
- [x] `EstadoApi` (arquivo e teste) removido; nenhuma referência a ele resta em `src/`.
- [x] `/simulacoes`, `/simulacoes/nova`, `/simulacoes/1/editar`, `/simulacoes/1/resultado` e `/simulacoes/1/financiamentos/1` sem sessão levam a `/login`; `/login`, `/registrar` e `/qualquer-coisa` abrem sem sessão.
- [x] **No navegador, contra o backend real:** registrar uma conta nova (`201`), entrar (`200`), recarregar a página e continuar logado, ver o nome na barra, sair, e ser levado ao login; a senha errada mostra o alerta **sem** redirecionar nem recarregar.
- [x] `409` no registro (e-mail existente, como `teste@example.com`) aparece no campo e-mail; `422` aparece junto ao campo certo, com as mensagens do backend.
- [x] Apagar o token no `sessionStorage` (ou usar um token inválido) e recarregar leva ao login com o aviso de sessão expirada; **sem loop**.
- [x] Com o backend parado e token guardado, a SPA mostra "Não foi possível verificar sua sessão" com **Tentar de novo**; ao religar o backend e tentar de novo, entra.
- [x] O token não aparece em URL, no console nem em mensagens de erro; a senha não fica em nenhum arquivo, log ou cache (`grep` na pasta e no build).
- [x] Os mocks refletem o backend real nos três pontos corrigidos, e o teste de contrato confere as mensagens de auth.
- [x] Componentes e páginas em `PascalCase.jsx`, demais módulos em `camelCase`; nenhum `console.log`.
- [x] O `CLAUDE.md` é atualizado (estrutura, comportamento da sessão, contrato de auth, contagem de testes) e o `plano.md` marca a Etapa 2.

## Plano de Implementação

**Status:** executado em 2026-09-26 (T1 a T17; T18 e T19 são do commit e da confirmação) · **Criado em:** 2026-09-26

São 19 tarefas pequenas, em cinco blocos. Cada uma indica **quem executa** (**Claude** ou **Você**), os arquivos, o que
muda e como validar. O código de cada módulo nasce **junto com os seus testes** (`*.test.js(x)` ao lado). Regras para todo o plano:
- O Claude **não** roda `git add`, `commit` nem `push` (os commits são seus).
- Ao fim de cada tarefa que altera código: `npm run lint` (0 avisos) e `npm test` verdes.
- Cada teste de comportamento tem um **controle** (a versão que não deve disparar) que prova que ele pode falhar.
- **Recuo de versão:** se a dependência nova (T1) não instalar limpa, a tarefa para e eu relato antes de qualquer contorno.
- Segredos: a senha da conta nova (T16) é escolhida por você e nunca passa pelo chat nem por arquivo; nos testes só existem senhas fictícias.
- **`.gitignore` (lição da Etapa 1):** ao criar `src/auth/` e `src/schemas/`, a T17 confere com `git status --ignored` e
  `git check-ignore -v` que **nenhum arquivo novo** foi engolido por uma regra de ignore.

**Ordem e dependências:** A → B → C → D → E. As tarefas T3 a T6 são independentes entre si; T7 usa T3, T4 e T6; T8 usa T7;
T11 e T12 usam T5, T6, T7 e T9; T13 fecha a ligação de tudo. A T16 (navegador) é a única que exige você, além do commit (T18).

### Bloco A — Dependência e alinhamento dos mocks

**T1 · Claude · Instalar `@mui/icons-material`**
- Arquivos: `package.json`, `package-lock.json`.
- O que muda: `npm install @mui/icons-material@9.4.0` (mesma versão do `@mui/material`; decisão 3).
- Validar: `npm ls --all` com código 0 e **sem** aviso de peer; `git diff package.json` mostra **só** essa dependência nova; `npm run build` e `npm test` continuam verdes (nada importa o pacote ainda).

**T2 · Claude · Alinhar os mocks ao backend real**
- Arquivos: `src/mocks/validacao.js`, `src/mocks/sessao.js`, `src/mocks/erros.js`, `src/mocks/handlers/auth.js`, `src/mocks/handlers/handlers.test.js`, `src/mocks/contrato.test.js`.
- O que muda: mensagens reais de `422` do registro (`"O nome deve ter entre 2 e 120 caracteres."`, `"E-mail inválido."`, `"A senha deve ter entre 8 e 128 caracteres."`, `"Campo obrigatório."`, `"Campo desconhecido."`); o **login valida o formato do e-mail** (`422 "E-mail inválido."`); esquema `Authorization` diferente de `Bearer` → `"Token de autenticação ausente"`; o `401` do login sai **sem** `WWW-Authenticate` (o do `perfil` mantém).
- Validar: `npm test` com os casos novos (login com e-mail malformado, `Basic abc`, mensagens exatas do registro) e os controles (login com e-mail válido e senha errada continua `401`; `perfil` sem token continua com `WWW-Authenticate`); comparação manual das mensagens com o backend real (`curl`, requisições que não criam nada).

### Bloco B — Peças independentes da sessão

**T3 · Claude · `tokenStorage`**
- Arquivos: `src/auth/tokenStorage.js`, `src/auth/tokenStorage.test.js`, `src/setupTests.js`.
- O que muda: `lerToken`, `gravarToken`, `apagarToken` sobre o `sessionStorage` (chave única), tudo em `try/catch`; se o storage lançar, guarda **só em memória**; o `setupTests.js` passa a limpar o `sessionStorage` e a memória a cada teste (com guarda para o ambiente `node`, onde ele não existe).
- Validar: `npm test` cobre gravar/ler/apagar, storage que **lança** na leitura, na escrita e na remoção (sem quebrar e com fallback em memória), valor inexistente → `null`; controle: com storage normal, o valor persiste em `sessionStorage`.

**T4 · Claude · `api/auth.js`**
- Arquivos: `src/api/auth.js`, `src/api/auth.test.js`.
- O que muda: `registrar(dados)` e `login(dados)` (ambos `semAutenticacao`) e `obterPerfil({ signal })`, finas, sobre o client.
- Validar: `npm test` (ambiente `node`, MSW): `registrar` `201`/`409`/`422`; `login` `200`/`401`/`422`; `login` **não** envia `Authorization` mesmo com token configurado (controle: `obterPerfil` envia); `obterPerfil` repassa o `signal` (cancelamento mantém o `AbortError`).

**T5 · Claude · Esquemas Zod de autenticação**
- Arquivos: `src/schemas/auth.js`, `src/schemas/auth.test.js`.
- O que muda: `esquemaRegistro` (nome com `trim` 2 a 120; e-mail com `trim` e formato; senha 8 a 128 **sem** `trim`; confirmação igual à senha) e `esquemaLogin` (e-mail com formato; senha obrigatória), com as mesmas mensagens do backend.
- Validar: `npm test` com limites (nome 1/2/120/121, senha 7/8/128/129, confirmação diferente, senha só com espaços de 8 caracteres é válida, e-mail com espaços nas pontas é aparado, e-mail sem `@`/domínio inválido); controle: um objeto totalmente válido passa.

**T6 · Claude · `errosDeFormulario`**
- Arquivos: `src/utils/errosDeFormulario.js`, `src/utils/errosDeFormulario.test.js`.
- O que muda: `aplicarErrosDoServidor(erro, setError, campos)`: chaves de `detalhes` que são campo viram `setError` (1ª mensagem); chaves desconhecidas, erro sem `detalhes` e `ErroRede` viram a **mensagem geral** devolvida.
- Validar: `npm test` com `422` de um campo, de vários, com chave desconhecida, `409` sem `detalhes`, `ErroRede` (mensagem própria dele) e timeout; controle: erro que não é da API (`Error` comum) devolve mensagem genérica sem lançar.

### Bloco C — Sessão e proteção de rotas

**T7 · Claude · `AuthProvider` e `useAuth`**
- Arquivos: `src/auth/contextoAuth.js`, `src/auth/AuthProvider.jsx`, `src/auth/useAuth.js`, testes ao lado, `src/testUtils.jsx`.
- O que muda: estado da sessão (`status`, `usuario`, `entrar`, `sair`) conforme a spec: token em ref sincronizado, `configurarSessao` ao montar (e `configurarSessao({})` ao desmontar), `perfil` por React Query sem repetição, `aoExpirar` idempotente, `sair` com `cancelQueries` + `clear`; o `testUtils` ganha `renderizarComAuth(ui, { rota, token })` (com `MemoryRouter`, React Query e o provedor).
- Validar: `npm test` com um componente de prova: sem token → `sem-sessao`; token válido → `validando` e depois `autenticado` com o `usuario`; `perfil` `401` → token apagado e navegação a `/login` com `motivo: 'sessao-expirada'` e `de`; rede/`5xx` → `erro` **sem** apagar o token; **duas respostas `401` em paralelo geram uma só saída**; `entrar` grava o token, semeia o `perfil` (sem chamada extra ao backend, conferida pelo MSW) e o client passa a enviar o token; `sair` apaga o token, limpa o cache e navega com `motivo: 'saiu'`; storage indisponível funciona só em memória; montagem dupla (`StrictMode`) não duplica a ligação.

**T8 · Claude · `RotaProtegida`, `SoVisitantes` e telas de estado**
- Arquivos: `src/auth/{RotaProtegida,SoVisitantes}.jsx`, `src/components/{CarregandoSessao,ErroSessao}.jsx`, testes ao lado.
- O que muda: `RotaProtegida` (sem sessão → `/login` com `state.de`; `validando` → "Verificando sua sessão…" com `role="progressbar"`; `erro` → "Não foi possível verificar sua sessão" com **Tentar de novo** e **Sair**; `autenticado` → `<Outlet />`); `SoVisitantes` (decisão 6: logado → `/simulacoes` com `replace`; `validando` → carregamento; sem sessão → `<Outlet />`).
- Validar: `npm test` cobre cada estado das duas rotas, que o carregamento **não** mostra o conteúdo nem o login (sem piscar), **Tentar de novo** refaz o `perfil` e entra, **Sair** limpa e vai ao login; controles: a mesma rota com sessão válida abre, e `/login` sem sessão abre.

### Bloco D — Telas e ligação

**T9 · Claude · `CampoSenha`**
- Arquivos: `src/components/CampoSenha.jsx`, `src/components/CampoSenha.test.jsx`.
- O que muda: campo de senha com `IconButton` de olho (`@mui/icons-material/Visibility` e `VisibilityOff`, **importados por caminho**), nome acessível que alterna ("Mostrar senha"/"Ocultar senha"), `aria-pressed`, integrável ao React Hook Form e com `mostrar`/`aoAlternar` controláveis (para o cadastro alternar os dois campos juntos).
- Validar: `npm test` (clique alterna `type` entre `password` e `text`, nome acessível e `aria-pressed` mudam, o foco continua no campo, ajuda "8 a 128 caracteres" quando pedida); `npm run build` e `grep` no `dist/` confirmam que só esses dois ícones entram.

**T10 · Claude · `LayoutPublico`, `Layout` com sessão e remoção do `EstadoApi`**
- Arquivos: `src/components/{LayoutPublico,Layout}.jsx` e testes, remoção de `src/components/{EstadoApi.jsx,EstadoApi.test.jsx}`.
- O que muda: `LayoutPublico` (nome do app e cartão centralizado, `<Outlet />`); `Layout` (barra com o nome do app como link para `/simulacoes`, **nome do usuário** oculto em telas estreitas e **Sair**, que chama `sair()`); o `EstadoApi` é apagado.
- Validar: `npm test`: o `LayoutPublico` **não** mostra usuário nem Sair; o `Layout` mostra os dois com sessão e **Sair** limpa a sessão; `grep -rn "EstadoApi" src` sem resultados; `lint` verde.

**T11 · Claude · Tela de Login**
- Arquivos: `src/pages/Login.jsx`, `src/pages/Login.test.jsx`.
- O que muda: formulário (React Hook Form + `esquemaLogin`, `noValidate`, `autoComplete`, foco no primeiro inválido, envio desabilitado durante a requisição); sucesso volta a `state.de` (só caminho interno, nunca `/login` nem `/registrar`) ou a `/simulacoes`; `401` mostra "E-mail ou senha incorretos." **sem navegar**, mantém o e-mail, limpa a senha e foca a senha; `422` por campo; rede fora do ar com a mensagem própria; avisos por `state.motivo` (`sessao-expirada`, `conta-criada` com o e-mail preenchido, `saiu`); link para **Criar conta**.
- Validar: `npm test` com `userEvent`: cada fluxo acima; sem duplo envio (dois cliques → uma chamada); controle: o mesmo `401` numa **rota protegida** navega ao login (e no login não); `de` externo (`//evil.com`) é ignorado.

**T12 · Claude · Tela de Registro**
- Arquivos: `src/pages/Registro.jsx`, `src/pages/Registro.test.jsx`.
- O que muda: formulário (nome, e-mail, senha, confirmação; um único botão de olho para os dois campos; dica "8 a 128 caracteres"); `409` no campo e-mail ("E-mail já cadastrado"); `422` por campo; sucesso → `/login` com `state: { motivo: 'conta-criada', email }`; a confirmação **não** é enviada.
- Validar: `npm test`: corpo enviado só com `nome`, `email`, `senha`; confirmação diferente não chama a API; `409` no campo; `422` do backend mapeado; controle: com dados válidos e e-mail novo o registro sucede e navega.

**T13 · Claude · Rotas, `Raiz` e testes existentes**
- Arquivos: `src/App.jsx`, `src/Raiz.jsx`, `src/testUtils.jsx`, `src/App.test.jsx`, `src/Raiz.test.jsx`, `src/pages/telas.test.jsx`, `src/components/Layout.test.jsx`.
- O que muda: `App` com o grupo público (`/login`, `/registrar` sob `SoVisitantes` + 404 no `LayoutPublico`) e o privado (`/` e `/simulacoes...` sob `RotaProtegida` + `Layout`); `Raiz` inclui o `AuthProvider` dentro do `BrowserRouter`; os testes existentes passam a usar sessão de teste onde precisam e deixam de listar `Login`/`Registro` como provisórias; `renderizarComAuth` vira o auxiliar padrão das rotas privadas.
- Validar: `npm test` inteiro verde; cobre: rotas privadas sem sessão vão a `/login` (5 endereços da spec) e com sessão abrem; `/login`, `/registrar` e `/qualquer-coisa` abrem sem sessão; a 404 é igual logado ou não; `Raiz` com a configuração inválida continua mostrando a `TelaConfiguracao` **sem** chamar a API; `npm run lint` e `npm run build` verdes.

### Bloco E — Verificação, fechamento e publicação

**T14 · Claude · Verificação completa**
- Arquivos: nenhum (só leitura, salvo correções).
- O que muda: rodo tudo de ponta a ponta.
- Validar: `lint` com 0 avisos; `npm test` verde (registro a contagem); `npm run build` sem avisos; `npm ls --all` sem problemas; **só** `Visibility` e `VisibilityOff` do `@mui/icons-material` no `dist/` (o pacote inteiro não entra); nenhum `console.log`; `grep` no `src/` e no `dist/` por senhas ou tokens fixos (nada além das senhas fictícias dos testes, que não vão ao `dist/`); `grep -rn "EstadoApi" src` vazio.

**T15 · Claude · Verificação por linha de comando com o backend real**
- Arquivos: nenhum.
- O que muda: só verificação; subo o `dev` (5173) e confiro o backend real por `curl`.
- Validar: rotas `/login`, `/registrar`, `/simulacoes`, `/simulacoes/nova` e `/qualquer-coisa` respondem `200` (fallback de SPA); o backend real responde `401` com `WWW-Authenticate` no `perfil` sem token e `422` com as mesmas mensagens que os mocks (comparação, sem criar dados); CORS de `:5173` liberado.

**T16 · Você · Verificação no navegador**
- Arquivos: nenhum.
- O que muda: com `npm run dev` (eu subo) e o backend no ar, você abre `http://localhost:5173` e confere, com o console aberto (F12):
  1. `/simulacoes` sem sessão leva a `/login` (o endereço final é `/login`).
  2. **Criar conta:** em `/registrar`, uma conta nova (e-mail à sua escolha e senha sua): cai no `/login` com "Conta criada!" e o e-mail preenchido.
  3. **Registro com e-mail existente** (`teste@example.com`): o erro aparece no campo e-mail; e com dados inválidos (senha curta, e-mail sem `@`), as mensagens em português junto dos campos.
  4. **Entrar:** com a senha errada aparece "E-mail ou senha incorretos." sem recarregar nem trocar de tela; com a certa vai a `/simulacoes` (ou à rota que você tentou abrir antes) e o **nome** aparece na barra.
  5. **Recarregar (F5)** em `/simulacoes`: continua logado, sem piscar a tela de login.
  6. **Olho** da senha em login e registro (no registro alterna os dois campos).
  7. **Abrir `/login` logado:** redireciona para `/simulacoes`.
  8. **Sair:** vai ao login com "Você saiu da sua conta."; o botão Voltar do navegador não mostra a tela privada.
  9. **Sessão inválida:** com você logado, no DevTools (Application → Session Storage) troque o valor do token por `lixo` e recarregue: vai ao login com "Sua sessão expirou. Entre novamente." e **sem loop**.
  10. **Backend parado com token guardado** (peça para eu parar o backend, e recarregue): aparece "Não foi possível verificar sua sessão" com **Tentar de novo**; religue (peça para eu religar), clique em Tentar de novo: entra.
  11. O token não aparece na barra de endereço nem no console.
- Validar: você me diz o resultado de cada item; qualquer falha vira correção antes da T17.

**T17 · Claude · Registrar a conclusão da etapa**
- Arquivos: `CLAUDE.md`, `plano.md` (Etapa 2), esta spec.
- O que muda: `CLAUDE.md` (Stack com `@mui/icons-material` e a regra de importar por caminho; estrutura com `auth/`, `schemas/`, `LayoutPublico`; contrato de auth com as mensagens reais; comportamento da sessão; contagem de testes; remoção do aviso sobre o `EstadoApi`); `plano.md` marca a Etapa 2 com "Validado" e notas; a spec passa a "Concluída" com os critérios marcados.
- Validar: releitura dos três arquivos; `git status --ignored --short` e `git ls-files --others --exclude-standard` confirmam que **todos** os arquivos novos de `src/auth/`, `src/schemas/`, `src/utils/` e `src/components/` aparecem como publicáveis e **nada** foi ignorado por engano (`git check-ignore -v src/auth/AuthProvider.jsx` não retorna regra); nada proibido publicável (`node_modules/`, `dist/`, `.env`, `CLAUDE.md`, `api/`).

**T18 · Você · Commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica. Sugestão: `git add .` (o `.gitignore` já foi conferido), `git status`, `git commit`, `git push`.
- Validar: `git status` limpo; push sem erro.

**T19 · Claude · Confirmar a publicação, do zero**
- Arquivos: nenhum.
- O que muda: só verificação; clono o repositório público numa pasta limpa.
- Validar: o número de arquivos rastreados no GitHub bate com o do disco; `npm ci`, `npm ls`, `lint` (0 avisos), `npm test` e `npm run build` verdes no clone; a listagem do GitHub tem `src/auth/`, `src/schemas/` e **não** tem `node_modules`, `dist`, `.env`, `CLAUDE.md`, `api` nem `.claude`.

### Mapa dos critérios de aceite
| Critério | Tarefas |
|---|---|
| `lint`, `test` e `build` verdes; só o `@mui/icons-material` de novo; `npm ls` limpo | T1, T14 |
| Só `Visibility` e `VisibilityOff` no `dist/` | T9, T14 |
| `EstadoApi` removido | T10, T14 |
| Rotas privadas sem sessão vão a `/login`; públicas e 404 abrem | T8, T13, T15, T16 |
| Fluxo completo no navegador (registrar, entrar, recarregar, nome na barra, sair) | T7, T11, T12, T16 |
| `409` no campo e `422` junto ao campo com as mensagens do backend | T2, T6, T12, T16 |
| Token inválido/apagado → login com aviso e sem loop | T7, T8, T16 |
| Backend parado com token → "Tentar de novo" | T7, T8, T16 |
| Token e senha fora de URL, console, log e arquivos | T7, T14, T16 |
| Mocks alinhados ao backend real e teste de contrato com as mensagens | T2 |
| Nomes conforme o R6 e nenhum `console.log` | T14, T17 |
| `CLAUDE.md` e `plano.md` atualizados | T17 |

### Riscos
- **Router + sessão:** o `AuthProvider` usa `useNavigate`/`useLocation`, então precisa ficar **dentro** do `BrowserRouter` (e do `QueryClientProvider`); o `Raiz` (T13) e o `renderizarComAuth` (T7) respeitam essa ordem.
- **`queryClient.clear()` com consultas em andamento:** por isso `cancelQueries` antes de limpar; a T7 tem teste para que nada volte a preencher o cache.
- **`StrictMode`:** a montagem dupla do desenvolvimento roda os efeitos duas vezes; a ligação com o client e o `perfil` por React Query são idempotentes (teste na T7).
- **Ícones e o servidor de desenvolvimento:** importar `@mui/icons-material` pelo pacote raiz deixa o `dev` lento e o bundle grande; a T9 e a T14 garantem a importação por caminho.
- **Redirecionamento aberto:** `state.de` só aceita caminho interno; teste na T11.
- **Lição do `.gitignore`:** repetir a conferência de arquivos novos ignorados (T17 e T19).
- **Tamanho:** 19 tarefas; as T7, T8, T11 e T12 são as mais longas. Se preferir, executo por bloco e paro para a sua revisão ao fim de cada um.

---
*Plano aguardando aprovação. Nenhuma tarefa foi executada.*

### Registro da execução (2026-09-26)
- **Resultado:** 516 testes em 26 arquivos, `lint` sem avisos, `build` de 651 kB (205 kB gzip); no bundle só `Visibility` e `VisibilityOff` do `@mui/icons-material` (conferido por *sourcemap*); nenhum dado de teste, `.env` ou `mockServiceWorker.js` no `dist/`. As mensagens dos mocks foram comparadas com o backend real (14 casos, 0 diferenças).
- **Bug achado pelos testes:** a ligação com o client HTTP feita em `useEffect` chegava depois da primeira chamada ao `/perfil` (o React Query dispara em efeito passivo), que saía sem token, dava 401 e derrubava a sessão a cada recarregamento. Corrigido com `useLayoutEffect`.
- **Desvios do plano:** (1) o `AuthProvider` **não navega** em `sair`/`aoExpirar`: só encerra a sessão e guarda `aviso` no contexto; a `RotaProtegida` é o único redirecionamento ao login. Com dois redirecionamentos, o segundo apagava o `state` do primeiro e o aviso se perdia. (2) Depois do login o **`SoVisitantes`** é o único a redirecionar (destino seguro em `utils/destino.js`); a tela de login só chama `entrar`. (3) Os avisos da sessão (saiu, sessão expirada) ficam no contexto e não no estado da rota; o de conta criada continua no estado da rota (vem do Registro, sem sessão envolvida). (4) O cadastro tem **dois** botões de olho (um por campo) ligados ao mesmo estado, em vez de um só. (5) `hooks/useRegistrar.js` foi criado para a página não chamar a API direto (regra do projeto). (6) A T13 foi feita antes das T11 e T12, para a suíte não ficar vermelha entre as tarefas.
- **Descobertas do backend real:** o login valida o formato do e-mail (422 "E-mail inválido."), a senha do login tem mensagem própria (1 a 128), só o esquema exato `Bearer` conta e o 401 do login não traz `WWW-Authenticate`. Os mocks estavam diferentes nesses pontos e foram corrigidos (T2).
- **Verificação no navegador (T16, pelo autor):** os 11 itens passaram.

