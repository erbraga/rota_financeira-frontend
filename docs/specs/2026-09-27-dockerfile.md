# Dockerfile (Etapa 10) — Spec

**Criado em:** 2026-09-27
**Status:** Concluída em 2026-09-27 (T1 a T8 executadas; T9 — commit e push — falta, com você)
**Etapa do plano:** 10 (`plano.md`) · **Requisito:** R3 (execução em contêiner)

## Problema
A SPA hoje só roda com `npm run dev` (servidor de desenvolvimento do Vite) ou `npm run preview` (servidor de
verificação, também do Vite, não pensado para produção). Não há como empacotar o frontend numa imagem de
contêiner autocontida, com o build de produção (`dist/`) servido por um servidor de arquivos estáticos de
verdade, como o R3 exige.

## Objetivo
Um `Dockerfile` multi-stage que builda a SPA (`npm run build`) e serve o resultado estático por `nginx`, numa
imagem só de produção (sem `node_modules` de desenvolvimento, sem código-fonte, sem segredo), pronta para
`docker build` + `docker run`, com o fallback de rota da SPA funcionando (recarregar `/simulacoes` não pode
dar 404 do nginx).

## Fora de escopo
- `docker-compose.yml` (decisão já tomada no `CLAUDE.md`: cada módulo — frontend e backend — é independente;
  os comandos de `docker build`/`docker run` ficam documentados no README, Etapa 11).
- Subir o backend ou o Postgres em contêiner (são de outro repositório).
- CI/CD, registry de imagens, ou publicação da imagem em qualquer lugar além do Docker local.
- HTTPS/TLS dentro do contêiner (o nginx serve HTTP simples na porta 80; TLS, se um dia existir, é
  responsabilidade de um proxy reverso na frente, fora do escopo deste projeto acadêmico).
- Mudar `vite.config.js`, portas do `dev`/`preview` ou qualquer coisa das Etapas 1 a 9.

## Proposta

### Arquivos criados
- `Dockerfile` (raiz): multi-stage.
  - **Estágio `build`** (`node:24-alpine`, a mesma major do `.nvmrc`): `WORKDIR /app`; copia primeiro
    `package.json` + `package-lock.json` e roda `npm ci` (cache de camada — só reinstala quando o lockfile
    muda); depois copia o resto do código-fonte e roda `npm run build`, recebendo `VITE_API_URL` como `ARG`
    (e repassando para `ENV` só durante o build, já que o Vite lê `import.meta.env.VITE_API_URL` em tempo de
    build e embute o valor no bundle — não é um segredo, mas também não deve "vazar" para o estágio final).
  - **Estágio final** (`nginx:alpine`): copia só `dist/` do estágio anterior para
    `/usr/share/nginx/html`, copia `nginx.conf` para `/etc/nginx/conf.d/default.conf`, expõe a porta 80 e
    roda como o usuário não-root que a própria imagem `nginx:alpine` já traz (`nginx`), sem instalar nada
    extra.
- `nginx.conf`: um `server` simples, escutando na porta 80, com:
  - `try_files $uri $uri/ /index.html;` (fallback de SPA: qualquer caminho que não seja um arquivo real cai no
    `index.html`, para o React Router assumir o roteamento no cliente).
  - Cache longo (`Cache-Control: public, max-age=31536000, immutable`) para `assets/*` (os arquivos que o Vite
    já versiona por hash no nome, como visto no `build` da Etapa 8: `index-<hash>.js`); **sem cache**
    (`Cache-Control: no-cache`) para o `index.html` em si, para uma nova versão publicada ser sempre buscada de
    novo.
  - Cabeçalhos básicos de segurança (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
    `Referrer-Policy: strict-origin-when-cross-origin`) — não é um requisito do trabalho, mas é grátis e correto
    para uma SPA pública.
  - `gzip on` para os tipos de texto (`text/css`, `application/javascript`, `application/json`, etc.), já que o
    Vite não gera `.gz` pré-comprimidos.
- `.dockerignore`: `node_modules`, `dist`, `.env*` (o `.env` local nunca deve entrar no contexto de build; a URL
  da API chega só via `--build-arg`), `docs`, `*.md`, `.git`, `.claude`, `api` (a pasta de referência do backend,
  que já é ignorada pelo Git, mas o `.dockerignore` é uma lista própria, não herda do `.gitignore`), `coverage`
  (se um dia existir).

### Comportamento
- **Sem segredo na imagem:** a única variável de build é `VITE_API_URL`, que não é secreta (é a URL pública da
  API que o navegador de quem usa o app vai chamar) — mas mesmo assim só entra como `ARG`/`ENV` do estágio de
  build, nunca do estágio final (o `nginx:alpine` final não tem Node nem `.env`).
- **Build determinístico:** `npm ci` (não `npm install`), a partir do `package-lock.json` versionado — o mesmo
  contrato de dependências do `npm run build` local.
- **Fallback de SPA:** recarregar uma rota interna (`/simulacoes`, `/simulacoes/1/resultado` etc.) diretamente
  no navegador, ou apertar F5, tem que servir o `index.html` (200), não um 404 do nginx — o React Router assume
  a partir daí.
- **CORS:** responsabilidade do backend, como já documentado no `CLAUDE.md` ("o frontend não contorna com proxy
  no código"); a origem `http://localhost:8080` (onde a imagem publica, por convenção já fechada) precisa estar
  no `CORS_ORIGINS` do backend para o app funcionar de ponta a ponta — isso é validado manualmente (você tem o
  backend), não testado por mim.
- **Tamanho da imagem final:** só `nginx:alpine` + os arquivos estáticos de `dist/` (tipicamente poucos MB de
  imagem base + ~1 MB do bundle) — nenhum `node_modules`, nenhuma dependência de build sobra no estágio final.

### Comandos (a documentar no README, Etapa 11; aqui só para validar agora)
```
docker build --build-arg VITE_API_URL=http://localhost:5000/api -t rota-financeira-web .
docker run -d --name rota-financeira-web -p 8080:8080 rota-financeira-web
```

### Casos de borda
- **Rebuild com URL diferente:** como o Vite embute a URL no bundle em tempo de build, mudar `VITE_API_URL`
  exige rodar `docker build` de novo (documentado no `CLAUDE.md`, seção "Desenvolvimento local" — a mesma regra
  do `npm run build` local, só que agora dentro do Dockerfile).
- **Contêiner já rodando na porta 8080:** `docker run` falha com uma mensagem clara do próprio Docker (porta em
  uso); não é tratado pelo Dockerfile, é operação normal de quem sobe o contêiner.
- **`npm run build` falhando dentro do estágio de build** (ex.: um lint quebrado, embora o `lint` não rode
  dentro do Dockerfile — só o `build`): a imagem simplesmente não é criada (`docker build` termina com erro);
  comportamento padrão do Docker, sem tratamento especial.

## Decisões em aberto
Nenhuma no momento em que a spec foi escrita — já fechadas no `CLAUDE.md` (seção "Execução em contêiner (R3)")
e no `plano.md` (Etapa 10): `nginx:alpine` no estágio final, sem `docker-compose.yml`, imagem
`rota-financeira-web`, publicada no host na porta **8080**, comandos de `build`/`run` no README (não neste
repositório como script). A base do estágio de build, `node:24-alpine` (a mesma major do `.nvmrc`), foi a única
decisão nova desta spec.

**Uma decisão surgiu só durante a implementação (T1), não prevista aqui:** a spec original assumia que o
contêiner escutaria na porta 80 **e** rodaria como o usuário não-root `nginx` ao mesmo tempo — na prática, a
imagem `nginx:alpine` não suporta isso de fábrica (o processo não-root falha ao criar `/var/cache/nginx/
client_temp` por falta de permissão, e mesmo corrigindo isso, a porta 80 é privilegiada e exige root para abrir).
Perguntado, o autor escolheu **manter o usuário não-root e mover a porta INTERNA do contêiner para 8080**
(`nginx.conf`: `listen 8080`; `Dockerfile`: `chown` de `/var/cache/nginx` e `/run`, `EXPOSE 8080`) — o host
continua publicando em 8080 (`docker run -p 8080:8080`, em vez do `-p 8080:80` que a spec previa). Todas as
referências a "porta 80"/"`8080:80`" no restante deste documento refletem o rascunho original; o que foi
implementado usa **8080 dos dois lados** (host e contêiner).

## Critérios de aceite
- [x] `docker build --build-arg VITE_API_URL=http://localhost:5000/api -t rota-financeira-web .` termina sem
      erro.
- [x] `docker run -d --name rota-financeira-web -p 8080:8080 rota-financeira-web` sobe e `http://localhost:8080`
      abre a SPA (tela de login, sem sessão).
- [x] Recarregar `http://localhost:8080/simulacoes` (ou qualquer rota interna) diretamente no navegador serve a
      SPA (200), não um 404 do nginx — prova o fallback.
- [x] Com o backend no ar e `http://localhost:8080` no `CORS_ORIGINS` dele, o fluxo completo funciona pelo
      contêiner: registrar → login → criar simulação → adicionar opção → ver resultado → excluir (os quatro
      métodos HTTP do R1, agora servidos por uma imagem de produção).
- [x] A imagem final não contém `.env`, `node_modules` nem código-fonte (`src/`) — só `dist/` e o `nginx.conf`
      aplicado; conferido inspecionando o filesystem da imagem (`docker run --rm rota-financeira-web ls -la
      /usr/share/nginx/html` e um `find` por `node_modules`/`.env`/`src`).
- [x] `.dockerignore` impede que `node_modules`, `dist` (de um build local anterior) e `.env` entrem no
      contexto de build (conferido pelo tamanho do contexto reportado no `docker build` e/ou um `docker build
      --no-cache` limpo).
- [x] Nenhum segredo ou credencial na imagem (não há segredo neste projeto além do `.env` local, que já está
      coberto pelo item acima).

## Plano de Implementação

**Status:** executado (T1 a T8) · falta **T9** (você, commit e push) · **Criado em:** 2026-09-27

Sete tarefas pequenas, em dois blocos. Cada uma indica **quem executa** (**Claude** ou **Você**), os arquivos, o
que muda e como validar. Regras:
- O Claude **não** roda `git add`, `commit` nem `push` (os commits são seus).
- O Claude **não** edita nada fora deste repositório (o `.env` do backend é outro módulo).
- Docker está disponível neste ambiente (`docker version`/`docker info` conferidos na exploração): as tarefas de
  build e execução do contêiner são do Claude, via Bash — não dependem de você rodar nada localmente, exceto o
  ajuste de CORS (T6, que só existe no repositório do backend) e a checagem final no navegador (T7).
- Ao fim de cada tarefa que cria ou muda um arquivo: nenhum teste automatizado novo é esperado (o Dockerfile não
  é código-fonte coberto pela suíte Vitest), mas o `lint`/`test`/`build` do projeto continuam verdes (nada nesta
  etapa toca `src/`).

**Ordem e dependências:** A → B. A T4 usa os arquivos da T1–T3; a T5 usa a imagem da T4; a T6 (no backend) é
pré-requisito da T7; a T8 registra o que as tarefas anteriores validaram.

### Bloco A — Arquivos

**T1 · Claude · `Dockerfile`**
- Arquivos: `Dockerfile` (novo, raiz).
- O que muda: cria o Dockerfile multi-stage descrito na spec (`node:24-alpine` para o build com `npm ci` +
  `npm run build`, recebendo `ARG VITE_API_URL`; `nginx:alpine` no estágio final, copiando só `dist/`, rodando
  como o usuário `nginx` não-root que a imagem já traz).
- Validar: leitura do arquivo confirma as duas etapas, o `ARG`/`ENV` de `VITE_API_URL` só no estágio de build, e
  que nenhum comando copia `.env`, `node_modules` do host nem `src/` para o estágio final (a build de verdade
  fica para a T4).

**T2 · Claude · `nginx.conf`**
- Arquivos: `nginx.conf` (novo, raiz).
- O que muda: cria a configuração do `server` (porta 80): `try_files ... /index.html` (fallback de SPA), cache
  longo para `assets/*`, sem cache para `index.html`, cabeçalhos básicos de segurança e `gzip on`.
- Validar: leitura do arquivo confirma as quatro regras; sintaxe conferida na T4 (`nginx -t` dentro do
  contêiner, ou o próprio `docker build`, que falha se o `nginx.conf` copiado for inválido só ao **rodar** — a
  validação de sintaxe de verdade acontece com `docker run` + `nginx -t` na T5).

**T3 · Claude · `.dockerignore`**
- Arquivos: `.dockerignore` (novo, raiz).
- O que muda: lista `node_modules`, `dist`, `.env*`, `docs`, `*.md`, `.git`, `.claude`, `api`, `coverage`.
- Validar: leitura do arquivo; a eficácia de verdade (nada disso entra no contexto/imagem) é conferida na T4 e
  na T5.

### Bloco B — Build, execução e fechamento

**T4 · Claude · Build da imagem**
- Arquivos: nenhum (só o comando).
- O que muda: `docker build --build-arg VITE_API_URL=http://localhost:5000/api -t rota-financeira-web .` a
  partir da raiz do projeto.
- Validar: o build termina sem erro (critério de aceite 1); o tamanho do contexto enviado ao daemon (primeira
  linha do output do `docker build`) é pequeno (poucos KB/MB, não centenas de MB — provaria que
  `node_modules`/`dist`/`.git` locais, se existirem no disco, NÃO foram enviados, confirmando o `.dockerignore`
  da T3); `docker images rota-financeira-web` mostra a imagem criada.

**T5 · Claude · Rodar o contêiner e validar por dentro**
- Arquivos: nenhum (só comandos).
- O que muda: nada no código; só verificação.
- Validar: `docker run -d --name rota-financeira-web -p 8080:8080 rota-financeira-web`; depois, com `curl`:
  `http://localhost:8080/` devolve 200 com o HTML da SPA (a `<title>Rota Financeira</title>`, o script do bundle);
  `http://localhost:8080/simulacoes` (rota que não existe como arquivo) TAMBÉM devolve 200 com o mesmo HTML —
  prova o fallback de SPA (critério de aceite 3) sem precisar abrir navegador; um arquivo dentro de
  `assets/` devolve `Cache-Control: public, max-age=31536000, immutable` e o `index.html` devolve `Cache-Control:
  no-cache` (ou equivalente) nos cabeçalhos da resposta; `docker exec rota-financeira-web nginx -t` confirma a
  sintaxe do `nginx.conf`; `docker exec rota-financeira-web whoami` confirma que o processo não roda como root;
  `docker run --rm rota-financeira-web sh -c "find / -maxdepth 3 -iname 'node_modules' -o -iname '.env' -o
  -iname 'src'"` não acha nada (critério de aceite 5) e `docker run --rm rota-financeira-web ls
  /usr/share/nginx/html` mostra só `index.html` e `assets/`. Ao fim, `docker stop`/`docker rm` do contêiner de
  teste (não deixar rodando).

### Bloco C — Integração com o backend e fechamento

**T6 · Você · Liberar a origem do contêiner no backend**
- Arquivos: `.env` do repositório do backend (fora deste repositório — o Claude não o edita).
- O que muda: acrescentar `http://localhost:8080` ao `CORS_ORIGINS` (hoje só `http://localhost:5173` e
  `http://localhost:3000`, conferido na exploração desta spec) e reiniciar o `flask run` para a variável valer.
- Validar: um preflight `OPTIONS` com `Origin: http://localhost:8080` contra `http://localhost:5000/api/saude`
  devolve `Access-Control-Allow-Origin: http://localhost:8080` (o mesmo tipo de checagem já feita na Etapa 0
  para `:5173`).

**T7 · Você · Verificação no navegador**
- Arquivos: nenhum.
- O que muda: com o contêiner da T5 no ar (ou subido de novo: `docker run -d --name rota-financeira-web -p
  8080:8080 rota-financeira-web`) e o backend reiniciado da T6, abra `http://localhost:8080` e exercite o fluxo
  completo: registrar → login → criar simulação → adicionar uma opção de financiamento → ver o resultado →
  excluir a simulação (os quatro métodos do R1, agora servidos pela imagem de produção, não pelo `npm run dev`).
  Recarregue (F5) numa rota interna (ex.: depois de abrir uma simulação) para confirmar o fallback também
  visualmente.
- Validar: você me diz o resultado; qualquer falha vira correção antes da T8.

**T8 · Claude · Registrar a conclusão da etapa**
- Arquivos: `CLAUDE.md`, `plano.md` (Etapa 10), esta spec.
- O que muda: `CLAUDE.md` ganha uma nota sobre o `Dockerfile`/`nginx.conf` (se a seção "Execução em contêiner
  (R3)" precisar de ajuste depois do que a T4/T5 mostrarem na prática) e a atualização do estado atual; o
  `plano.md` marca a Etapa 10 como concluída, com notas; esta spec passa a "Concluída", com os critérios
  marcados e um "Registro da execução" (tamanho da imagem final, saída das checagens da T5, o resultado da T7).
- Validar: releitura dos três arquivos; `git status --ignored --short` confirma que `Dockerfile`, `nginx.conf` e
  `.dockerignore` NÃO foram ignorados por engano (não há regra no `.gitignore` que os pegue, mas a T16 da Etapa
  8 já veio de um susto parecido — vale conferir de novo).

**T9 · Você · Commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica (`Dockerfile`, `nginx.conf`, `.dockerignore`, `CLAUDE.md`… — o `CLAUDE.md`
  é ignorado pelo Git, então não entra no commit; os demais sim) e publica.
- Validar: `git status` limpo; push sem erro.

### Registro da execução (2026-09-27)
- **Resultado:** imagem `rota-financeira-web` construída (`docker build`, ~1,12 MB de contexto enviado — prova
  que o `.dockerignore` funciona), ~95,2 MB em disco / ~26,7 MB de conteúdo. Contêiner testado: `whoami` → `nginx`
  (não-root), `nginx -t` sintaxe OK, `http://localhost:8080/` e `http://localhost:8080/simulacoes` (rota sem
  arquivo correspondente) devolvem 200 com o mesmo `index.html` (fallback de SPA confirmado por `curl`, sem
  precisar de navegador), `Cache-Control: public, max-age=31536000, immutable` em `assets/*` e `no-cache` no
  `index.html`, `Content-Encoding: gzip` num `.js`, e nenhum `node_modules`/`.env`/`src` em nenhum lugar da
  imagem (busca por `find` na imagem inteira).
- **Desvio do plano (decisão do autor, durante a T1):** a spec previa porta 80 e usuário não-root juntos, o que
  a imagem `nginx:alpine` não suporta de fábrica (ver "Decisões em aberto" acima); resolvido com porta 8080 dos
  dois lados (host e contêiner) e `chown` de `/var/cache/nginx`/`/run` no Dockerfile.
- **Bug achado pelos próprios testes da T5:** os três cabeçalhos de segurança (`add_header`) definidos no nível
  `server` do `nginx.conf` simplesmente não apareciam nas respostas — o nginx não herda `add_header` do nível
  acima para um `location` que já define o seu próprio `add_header` (é tudo ou nada, por nível), e os dois
  `location` do arquivo definem `Cache-Control` como `add_header` próprio. Corrigido repetindo os três cabeçalhos
  de segurança em cada `location`, junto do `Cache-Control` específico dele; a T5 foi refeita depois da correção
  e confirmou os cabeçalhos presentes nas duas rotas (`/` e um arquivo de `assets/`).
- **Integração com o backend (T6, pelo autor, com apoio do Claude para reiniciar os processos):** o `CORS_ORIGINS`
  do backend (fora deste repositório) foi atualizado para incluir `http://localhost:8080`; um preflight `OPTIONS`
  confirmou `Access-Control-Allow-Origin: http://localhost:8080` só depois de reiniciar o `flask run` (a variável
  é lida na hora que o processo sobe, não muda sozinha com o `.env` editado). No caminho, uma tentativa de
  reiniciar o backend esbarrou num processo antigo (de uma sessão anterior) ainda preso na porta 5000, que
  precisou ser encerrado antes.
- **Verificação no navegador (T7, pelo autor):** o fluxo completo funcionou pelo contêiner — registrar, login,
  criar simulação, adicionar opção, ver resultado, excluir. Uma confusão no meio do caminho: um teste inicial de
  F5 foi feito em `http://localhost:5173` (a porta do `npm run dev`, que já tinha sido desligada depois da
  verificação da Etapa 8) em vez de `http://localhost:8080` (a porta do contêiner) — "não foi possível conectar"
  era o esperado nessa porta; ao repetir em `:8080`, funcionou.
- **Resíduos:** nenhum (esta etapa não usa contas do backend nem dados de teste).
- **Publicação (T9):** pendente, com você.

---
*Concluída (T1 a T8). Falta só a T9 (commit e push, com você).*
