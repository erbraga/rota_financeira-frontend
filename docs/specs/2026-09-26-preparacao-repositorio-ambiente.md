# Preparação do repositório e ambiente (Etapa 0) — Spec

**Criado em:** 2026-09-26
**Status:** Aprovada (decisões 1 a 8 resolvidas em 2026-09-26)
**Etapa do plano:** 0 (`plano.md`) · **Requisito:** R6

## Problema
O diretório do frontend ainda não é um repositório Git, não tem `.gitignore`, e o repositório público exigido
pelo R6 não existe no GitHub (a consulta à API pública do GitHub por
`erbraga/rota_financeira-frontend` respondeu 404, embora o README do backend já aponte para essa URL). Além disso:

- Nada garante que os arquivos que **não** devem ser publicados (a pasta `api/`, cópia de referência do backend;
  `.env`; `node_modules/`) fiquem fora do repositório.
- O backend não está no ar (`GET http://localhost:5000/api/saude` sem resposta), embora o contêiner do banco
  `rota-financeira-db` esteja de pé; sem a API não há como validar nenhuma tela real das próximas etapas.
- Não há conta de teste na API para as verificações manuais.
- A versão do Node em uso precisa ficar registrada para que o `Dockerfile` (Etapa 10) e o README usem a mesma.

## Objetivo
Deixar o ambiente pronto para começar a Etapa 1: repositório Git local ligado a um repositório **público** do
GitHub com o `.gitignore` correto, versão do Node fixada, e o backend local no ar aceitando a origem
`http://localhost:5173`, com uma conta de teste criada.

## Fora de escopo
- Qualquer código do app: `package.json`, `src/`, Vite, dependências, ESLint, testes (**Etapa 1**).
- `.env.example` e a variável `VITE_API_URL` (**Etapa 1**, quando o app passar a lê-la; o plano listava o arquivo
  também na Etapa 0, mas ele só faz sentido junto do código que o usa).
- `Dockerfile`, `nginx.conf`, `.dockerignore` e a liberação de `http://localhost:8080` no CORS do backend (**Etapa 10**).
- README do frontend e fluxograma (**Etapa 11**).
- Qualquer alteração no repositório do backend, exceto (se necessário) o valor de `CORS_ORIGINS` do `.env` **local**
  dele, que não é versionado.
- CI/CD, GitHub Actions, proteção de branch, `LICENSE` (decisão 3) e `.gitattributes` (decisão 5).

## Proposta

### O que foi verificado (estado atual)
| Item | Situação |
|---|---|
| Diretório do frontend | `/home/emerson/Cursos/PUC Rio - Desenvolvimento web/Modulo3/MVP/rota_financeira-frontend`; **não é** repositório Git |
| Conteúdo atual | `CLAUDE.md`, `plano.md`, `proposta-frontend-spa-react.md`, `requisitos front-end.md`, `.claude/commands/`, `docs/specs/` (só `TEMPLATE.md` + esta spec), `docs/img/` (vazia), `api/` (cópia de referência do backend) |
| Node / npm | `v24.18.0` / `11.16.0` |
| Git | `2.43.0`; **`gh` (GitHub CLI) não está instalado** |
| Repositório do backend | `../rota_financeira-backend`, `origin` = `https://github.com/erbraga/rota_financeira-backend.git`, branch `main` |
| `.gitignore` do backend (precedente) | ignora `.venv`, `.env`, `.env.docker`, `.claude`, `CLAUDE.md`, `requisitos back-end.md`, `pendencias.md`, `/tmp`, IDE; **publica** proposta, plano e specs |
| Banco | contêiner `rota-financeira-db` em execução |
| API | fora do ar; o `.env` local do backend já tem `CORS_ORIGINS=http://localhost:5173,http://localhost:3000` |
| Repositório do frontend no GitHub | não encontrado (404) |

### Fluxo (passo a passo)
1. **Git local:** `git init -b main` no diretório do frontend.
2. **`.gitignore`** com, no mínimo:
   - dependências e artefatos: `node_modules/`, `dist/`, `coverage/`, `*.log`;
   - segredos: `.env`, `.env.*` com exceção `!.env.example`;
   - IDE/SO: `.vscode/`, `.idea/`, `.DS_Store`;
   - **`api/`** (cópia de referência do backend, nunca publicada);
   - `/tmp`;
   - arquivos de trabalho fora do público (decisão 1, como no backend): `CLAUDE.md`, `.claude/` e
     `requisitos front-end.md`.
3. **Node:** registrar **Node 24 (LTS)** como versão do projeto, em um `.nvmrc` com `24`; a Etapa 1 repete no
   campo `engines` do `package.json` e a Etapa 10 usa a mesma major no `Dockerfile` (`node:24-alpine`).
4. **Repositório público no GitHub:** criar `erbraga/rota_financeira-frontend` (público, **sem** README, `.gitignore`
   nem licença gerados pelo GitHub, para não haver histórico divergente), e ligar o remoto:
   `git remote add origin https://github.com/erbraga/rota_financeira-frontend.git`. Como o `gh` não existe aqui,
   a criação é pela página do GitHub, feita por você (decisão 2).
5. **Primeiro commit e push: feitos por você, manualmente** (decisão 7). O Claude não faz `git add`, `commit`
   nem `push`; deixa pronto o que a decisão 1 libera (proposta, plano, `docs/`, `.gitignore`, `.nvmrc`) e indica
   os comandos de conferência (`git status`, `git ls-files`) antes do seu primeiro `git add`.
6. **Backend local no ar:** com o contêiner do banco de pé, `source .venv/bin/activate` e `flask run` na pasta do
   backend (porta 5000). Conferir `GET /api/saude` = 200 e que o `.env` do backend tem `http://localhost:5173` em
   `CORS_ORIGINS` (já tem).
7. **Conta de teste:** registrar o usuário de desenvolvimento `teste@example.com` (decisão 6) pelo Swagger
   (`/apidocs/`) ou `curl` (`POST /api/auth/registrar`) e conferir o login (`POST /api/auth/login`). **A senha não é escrita em nenhum
   arquivo do repositório, spec, plano ou README**; fica só com você (ou num gerenciador de senhas).
8. **Conferência de CORS de ponta a ponta:** `curl` com `Origin: http://localhost:5173` num preflight (`OPTIONS`) de
   `/api/auth/login` deve devolver `Access-Control-Allow-Origin: http://localhost:5173`.

### Casos de borda
- **`api/` já rastreada:** o `.gitignore` deve ser criado **antes** do primeiro `git add`; conferir com
  `git status --ignored` e `git check-ignore -v api/CLAUDE.md`.
- **Repositório remoto criado com README/licença pelo GitHub:** o primeiro `push` seria rejeitado; por isso a
  criação é vazia. Se acontecer, resolver com `git pull --rebase` (sem `--force`).
- **Backend não sobe:** contêiner do banco parado (`docker start rota-financeira-db`), `.env` do backend ausente ou
  migrations pendentes (`flask db upgrade`). Nenhuma dessas correções altera arquivos versionados do backend.
- **CORS sem a origem:** o navegador bloqueia as chamadas com erro de CORS (o `curl` funciona, o navegador não);
  daí o passo 8 usar o cabeçalho `Origin`.
- **Segredos:** nada de `.env`, senha, token ou `JWT_SECRET_KEY` em arquivo versionado; conferir com
  `git ls-files` antes do primeiro push.

## Decisões em aberto
Resolvidas em 2026-09-26 (decisões do autor):
1. ~~O que publicar de documentação?~~ **Repetir o padrão do backend:** ignorar `CLAUDE.md`, `.claude/` e
   `requisitos front-end.md`; publicar `proposta-frontend-spa-react.md`, `plano.md` e `docs/`.
2. ~~Quem cria o repositório no GitHub?~~ **O autor cria** (pela página do GitHub, público e vazio); o Claude só liga o remoto.
3. ~~`LICENSE`?~~ **Não criar agora.**
4. ~~`.nvmrc`?~~ **Criar, com `24`** (a Etapa 1 também põe `engines`).
5. ~~`.gitattributes`?~~ **Não criar.**
6. ~~E-mail da conta de teste~~ **`teste@example.com`** (endereço reservado, sem entrega; é o único dado da conta
   que pode aparecer em documentos; a senha, nunca).

7. ~~Convenção de mensagens de commit~~ **Não se aplica: o autor faz todos os commits manualmente.** O Claude não
   commita nem dá push em nenhuma etapa.

8. ~~Ajuste de coerência no plano~~ **Feito em 2026-09-26** (com sua autorização): `plano.md` tirou o
   `.gitattributes`, deixou o `.env.example` só na Etapa 1 e registrou `.nvmrc`, a conta `teste@example.com` e que
   os commits são do autor.

Sem decisões em aberto: a spec está pronta para o `/plan`.

## Critérios de aceite
- [ ] `git -C <frontend> rev-parse --is-inside-work-tree` = `true`, na branch `main`.
- [ ] `git remote -v` mostra `origin` = `https://github.com/erbraga/rota_financeira-frontend.git` e a URL abre,
      **sem login**, um repositório público no navegador (ou responde 200 na API pública do GitHub).
- [ ] `git status --ignored` lista `api/` como ignorada; `git check-ignore -v api/README.md` e
      `git check-ignore -v .env` retornam a regra correspondente; `node_modules/` e `dist/` também são ignorados.
- [ ] `git ls-files` (após o primeiro `git add`) **não** contém `api/`, `.env*` (exceto `.env.example`), senhas,
      tokens nem os arquivos que a decisão 1 manda ignorar.
- [ ] `.nvmrc` contém `24`, e `node -v` na pasta é `v24.x`.
- [ ] `curl http://localhost:5000/api/saude` responde **200** (API e banco).
- [ ] O preflight `curl -i -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,authorization" http://localhost:5000/api/auth/login` devolve
      `Access-Control-Allow-Origin: http://localhost:5173`.
- [ ] O registro e o login da conta de teste funcionam (`201` e `200` com `access_token`), e a senha **não** aparece
      em nenhum arquivo do repositório (`grep -r` pela senha não encontra nada).
- [ ] Nenhum arquivo do repositório do backend versionado foi alterado (`git status` limpo lá).

## Plano de Implementação

**Status:** aguardando aprovação · **Criado em:** 2026-09-26

Esta etapa não tem código de aplicação: são configuração do repositório e do ambiente. Cada tarefa indica **quem
executa** (**Claude** ou **Você**), os arquivos afetados, o que muda e como validar. Regras que valem para todo o
plano: o Claude **não** roda `git add`, `commit` nem `push`; nada é escrito nos arquivos do backend versionado; a
senha da conta de teste nunca passa pelo chat nem por arquivo.

**Ordem e paralelismo:** T1 → T5 (Claude) não dependem de você. T6 e T10 (Você) podem ser feitas em paralelo com elas.
T7 espera a T6, T9 espera a T8, T12 espera todas as anteriores, e T14 só acontece depois da T13.

### Bloco A — Repositório local

**T1 · Claude · Registrar o estado inicial**
- Arquivos: nenhum (só leitura).
- O que muda: guardo a saída de `git status --short` do backend e a lista de arquivos do frontend, para provar no fim que o backend não foi alterado.
- Validar: `git -C ../rota_financeira-backend status --short` (a partir da pasta acima do frontend) anotado; `git rev-parse --is-inside-work-tree` no frontend falha (ainda não é repositório).

**T2 · Claude · Iniciar o repositório Git**
- Arquivos: `.git/` (novo).
- O que muda: `git init -b main` na pasta do frontend.
- Validar: `git rev-parse --is-inside-work-tree` = `true` e `git branch --show-current` = `main`.

**T3 · Claude · Criar o `.gitignore`**
- Arquivos: `.gitignore` (novo).
- O que muda: regras para `node_modules/`, `dist/`, `coverage/`, `*.log`, `.env`, `.env.*` com exceção `!.env.example` (a exceção vem **depois** da regra geral), `.vscode/`, `.idea/`, `.DS_Store`, `/tmp`, `api/`, `CLAUDE.md`, `.claude/` e `requisitos front-end.md`.
- Validar: `git check-ignore -v` retorna a regra para `api/README.md`, `.env`, `.env.docker`, `node_modules/x`, `dist/x`, `CLAUDE.md`, `.claude/commands/spec.md` e `requisitos front-end.md`; **não** retorna nada para `.env.example` (controle: ele precisa ser versionável); `git status --ignored --short` mostra `api/`, `CLAUDE.md`, `.claude/` e o arquivo de requisitos como ignorados.

**T4 · Claude · Fixar o Node 24**
- Arquivos: `.nvmrc` (novo).
- O que muda: um arquivo com a linha `24`.
- Validar: `cat .nvmrc` = `24` e `node -v` começa com `v24.`.

**T5 · Claude · Conferir o que seria publicado**
- Arquivos: nenhum (só leitura).
- O que muda: listo o que o Git considera publicável, sem usar `git add`.
- Validar: `git ls-files --others --exclude-standard` mostra **só** `.gitignore`, `.nvmrc`, `plano.md`, `proposta-frontend-spa-react.md`, `docs/specs/TEMPLATE.md` e esta spec — nada de `api/`, `CLAUDE.md`, `.claude/`, `.env*` nem `requisitos front-end.md`; e `grep -rnE "JWT_SECRET_KEY=|POSTGRES_PASSWORD=|DATABASE_URL=|senha *[:=] *[^ ]" ` nesses arquivos não encontra segredo.

### Bloco B — Repositório no GitHub

**T6 · Você · Criar o repositório público vazio**
- Arquivos: nenhum local (é no site do GitHub).
- O que muda: cria `erbraga/rota_financeira-frontend`, **público**, **sem** README, `.gitignore` nem licença.
- Validar (eu confirmo quando você avisar): `curl -s https://api.github.com/repos/erbraga/rota_financeira-frontend` responde 200 com `"private": false`.

**T7 · Claude · Ligar o remoto**
- Arquivos: `.git/config`.
- O que muda: `git remote add origin https://github.com/erbraga/rota_financeira-frontend.git`.
- Validar: `git remote -v` mostra a URL certa em fetch e push; `git ls-remote origin` responde sem pedir login e sem listar referências (repositório vazio).

### Bloco C — Backend e conta de teste

**T8 · Claude · Subir o backend local**
- Arquivos: nenhum versionado (o backend só gera `__pycache__`, que ele já ignora).
- O que muda: confirmo que o contêiner `rota-financeira-db` está `Up` (senão `docker start rota-financeira-db`) e subo `flask run` em segundo plano, na pasta do backend com o `.venv` dele.
- Validar: `curl -i http://localhost:5000/api/saude` = 200. Se responder 500/503 (migrations pendentes, banco fora do ar), eu diagnostico e **pergunto antes** de rodar `flask db upgrade` no banco de desenvolvimento.

**T9 · Claude · Conferir o CORS**
- Arquivos: nenhum.
- O que muda: só verificação.
- Validar: o preflight do critério de aceite (`OPTIONS /api/auth/login` com `Origin: http://localhost:5173`) devolve `Access-Control-Allow-Origin: http://localhost:5173`; **controle negativo:** o mesmo pedido com `Origin: http://localhost:9999` **não** devolve esse cabeçalho (prova que a checagem é sensível).

**T10 · Você · Criar a conta de teste**
- Arquivos: nenhum.
- O que muda: em `http://localhost:5000/apidocs/`, `POST /api/auth/registrar` com `teste@example.com`, um nome e uma senha de 8 a 128 caracteres escolhida por você; depois `POST /api/auth/login`, *Authorize* (colando só o token) e `GET /api/auth/perfil`.
- Validar: registro **201**, login **200** com `access_token` e perfil **200**. Você me avisa o resultado; eu **não** vejo nem uso a senha (sem ela não consigo conferir o login, então essa validação é sua).

**T11 · Você · Conferir que a senha não está em arquivo**
- Arquivos: nenhum.
- O que muda: só verificação: na pasta do frontend, `read -rs SENHA; grep -rIlF -- "$SENHA" . ; unset SENHA` (a senha não fica no histórico do shell nem na tela).
- Validar: o `grep` não imprime nenhum arquivo.

### Bloco D — Fechamento

**T12 · Claude · Verificação final dos critérios de aceite**
- Arquivos: nenhum.
- O que muda: rodo, um a um, os critérios da spec que dependem de mim: repositório Git em `main`; `origin` correto e repositório público; `api/`, `.env` e `node_modules/` ignorados; `.nvmrc`; `/api/saude` 200; preflight; e `git status --short` do backend **igual** ao registrado na T1.
- Validar: tabela "critério → comando → resultado" na resposta, com todos os itens `OK` (ou o que falhou).

**T13 · Claude · Registrar a conclusão da etapa**
- Arquivos: `plano.md` (Etapa 0), `CLAUDE.md` (seção "Estado atual") e esta spec (status e critérios marcados).
- O que muda: marco os itens da Etapa 0 como `[x]` com a data e o "Validado"; o `CLAUDE.md` passa a dizer que o repositório Git existe, que há `.nvmrc` (Node 24) e que o backend precisa estar no ar para as próximas etapas; a spec fica "Concluída".
- Validar: releitura dos três arquivos; `git ls-files --others --exclude-standard` continua sem nada indevido.

**T14 · Você · Primeiro commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita o que a decisão 1 libera e publica. Sugestão: `git add .gitignore .nvmrc plano.md proposta-frontend-spa-react.md docs`, conferir com `git status`, `git commit` com a sua mensagem e `git push -u origin main`.
- Validar: `git status` limpo depois do commit; o push termina sem erro.

**T15 · Claude · Confirmar a publicação**
- Arquivos: nenhum.
- O que muda: só verificação do que foi publicado.
- Validar: `git ls-remote origin main` devolve um hash; `curl -s https://api.github.com/repos/erbraga/rota_financeira-frontend/contents` lista **só** `.gitignore`, `.nvmrc`, `docs`, `plano.md` e `proposta-frontend-spa-react.md` (nada de `api`, `CLAUDE.md`, `.claude`, `.env*`); a página abre no navegador sem login.

### Fora deste plano (levado à Etapa 1)
O backend fica **no ar** ao final (a Etapa 1 e as seguintes precisam dele; me diga se prefere que eu o encerre). O
`.env.example`, `package.json` (com `engines`), Vite, dependências, ESLint e testes começam na Etapa 1.

### Riscos
- **Repositório criado com README/licença pelo GitHub:** o primeiro push seria rejeitado; por isso a T6 pede o repositório vazio. Se ocorrer, `git pull --rebase` (nunca `--force`).
- **`.gitignore` depois do `git add`:** a T3 vem antes de qualquer `git add`, e a T5 confere o resultado antes do seu commit.
- **`flask run` em modo debug** (`FLASK_DEBUG=1` no `.env` do backend) executa duas vezes por causa do reloader: os avisos duplicados no log são esperados.
- **Preflight falha só no navegador:** o `curl` não aplica a política de CORS, por isso a T9 testa com o cabeçalho `Origin` e com um controle negativo.

---
*Plano aguardando aprovação. Nenhuma tarefa foi executada.*
