# Revisão final e entrega (Etapa 12) — Spec

**Criado em:** 2026-09-27
**Status:** Concluída em 2026-09-27 (T1 a T10 executadas; T11 — commit e push final — falta, com você)
**Etapa do plano:** 12 (`plano.md`) · **Requisito:** todos (R1 a R6) — fechamento

## Problema
As Etapas 0 a 8, 10 e 11 estão concluídas e publicadas (a 9 foi pulada, por decisão do autor); cada uma foi
validada isoladamente na sua própria spec. Falta uma passada final, de ponta a ponta, que confirme que **o
conjunto** — não cada parte separada — atende todos os seis requisitos do trabalho, que não sobrou nenhum
resíduo (segredo, arquivo do backend, texto desatualizado) e que um clone limpo, do zero, realmente funciona.
Um achado concreto da exploração: o resumo de status no `CLAUDE.md` ("Situação: Etapas 0 e 1 concluídas... nenhum
requisito entregue ainda") está desatualizado desde a Etapa 1 — hoje R1 a R6 estão todos implementados.

## Objetivo
Fechar o projeto: checklist explícito dos seis requisitos (com evidência de cada um), verificação de que não há
segredo nem arquivo do backend em nenhum commit do histórico público, nomes conforme o R6, suíte completa verde
(`test`, `lint`, `build`, `docker build`), o README seguido do zero num clone limpo, e o `CLAUDE.md` com a
situação atualizada e o plano marcado como concluído.

## Fora de escopo
- Qualquer mudança de comportamento, funcionalidade ou contrato — esta etapa é só revisão e fechamento.
- Reabrir a Etapa 9 (impressão): continua pulada, por decisão já tomada.
- Mudar o backend (fora deste repositório).
- Criar `LICENSE`, `CONTRIBUTING.md` ou qualquer arquivo não pedido pelos requisitos (decisão já registrada no
  `CLAUDE.md`, Etapa 0).

## Proposta

### O que a exploração já encontrou (antes do plano, para não repetir trabalho)
- `api/` e `.env` **nunca** apareceram no histórico do Git (`git log --all -- api/` e `-- .env` vazios); ambos
  corretamente ignorados (`git check-ignore -v`).
- Nomes: nenhum componente/página fora de `PascalCase.jsx`, nenhuma pasta com maiúscula; um único arquivo em
  `src/hooks/` não segue `useAlgo.js` — `chavesSimulacoes.js` — mas é esperado: não é um hook, é o módulo das
  chaves de cache do React Query (`camelCase`, a regra certa para "demais módulos"), só fica em `hooks/` por
  proximidade de quem o usa. Não é uma violação do R6.
- O resumo de status em `CLAUDE.md` (seção "Requisitos do trabalho acadêmico") ficou parado na Etapa 1 e
  precisa ser reescrito.

### Checklist dos requisitos (a preencher com evidência, na T-de-verificação)
| Requisito | O que verificar |
|---|---|
| R1 (4 métodos HTTP) | `GET`, `POST`, `PUT`, `DELETE` exercitados pela interface — já coberto desde a Etapa 3/5; confirmar de novo no roteiro manual. |
| R2/R5 (README) | Já entregue na Etapa 11 (spec própria, com registro de execução); confirmar que continua batendo com o estado atual do projeto (nada mudou desde então que invalide algum comando). |
| R3 (Dockerfile) | Já entregue na Etapa 10; `docker build`/`docker run` de novo, para confirmar que nada quebrou. |
| R4 (criatividade/inovação) | Gráfico comparativo, cartões-resumo com destaque, feedback visual (Etapa 8), sugestão de taxas (Etapa 4), aporte (Etapa 6) — todos já entregues; listar onde cada um está no código, para a evidência. |
| R6 (repositório público, nomes) | `git remote -v` aponta para o repositório público; nomes conferidos na exploração (acima); estrutura de pastas do `CLAUDE.md`/README batendo com o `src/` real. |

### Arquivos
- `CLAUDE.md`: reescreve a "Situação" da seção de requisitos (R1 a R6, cada um com evidência curta, não a
  descrição genérica que já está lá — o texto do REQUISITO em si não muda, só o resumo de status no topo da
  seção); atualiza "Estado atual" com a Etapa 12; nenhuma outra seção deveria precisar mudar (se a verificação
  achar algo desatualizado em outra seção, é uma tarefa à parte, avisada antes de mexer).
- `plano.md`: marca a Etapa 12 como concluída; confirma que TODAS as etapas anteriores (0 a 11, exceto a 9,
  pulada) estão marcadas `[x]`/"concluída" — se alguma não estiver, é sinal de descuido a corrigir antes de
  fechar.
- `README.md`: só se a verificação achar um comando ou informação desatualizada (não esperado, já que a Etapa
  11 acabou de validar tudo, mas o clone limpo desta etapa é a prova final).

### Casos de borda
- **Se o clone limpo achar algo que o clone da Etapa 11 não achou:** só é possível se algo mudou entre as duas
  etapas — e nada deveria ter mudado, já que a Etapa 12 não altera código. Se acontecer, é sinal de que o commit
  da Etapa 11 não é exatamente o que foi validado (por exemplo, um arquivo esquecido fora do `git add`); tratar
  como um bug a corrigir, não a ignorar.
- **Se algum requisito não tiver evidência clara:** não marcar como atendido "de memória" — apontar o
  arquivo/linha específica que prova, ou registrar como pendência real (não esperado, mas o processo tem que
  admitir a possibilidade).

## Decisões em aberto
Nenhuma — o conteúdo desta etapa é só verificação e atualização de um resumo de status que já ficou
desatualizado; não há escolha de design a fazer.

## Critérios de aceite
- [x] Os seis requisitos (R1 a R6) têm evidência explícita e atual no `CLAUDE.md`, sem o resumo desatualizado da
      Etapa 1.
- [x] `git log --all` não tem `api/`, `.env`, segredo nem credencial em nenhum commit (não só no estado atual).
- [x] Nomes conforme o R6 (conferido de novo, não só reaproveitando a exploração).
- [x] `npm test`, `npm run lint`, `npm run build` e `docker build` verdes, rodados desta vez a partir de um
      **clone público de verdade** (não a simulação de pasta limpa das etapas anteriores) — a prova final de que
      o que está no GitHub funciona.
- [x] O README seguido do zero, a partir do clone público, funciona (local e Docker) — mesmo roteiro da Etapa
      11, mas contra o repositório publicado, não uma cópia local.
- [x] `plano.md` mostra todas as etapas 0–8, 10–11 concluídas (a 9, pulada) e a 12 também.
- [x] `CLAUDE.md` reflete o estado real e atual do projeto (não frases desatualizadas de etapas antigas).

## Plano de Implementação

**Status:** executado (T1 a T10) · falta **T11** (você, commit e push final) · **Criado em:** 2026-09-27

Onze tarefas, em quatro blocos. Regras:
- O Claude **não** roda `git add`, `commit` nem `push` (o commit final é seu — T11).
- Docker e git estão disponíveis neste ambiente, como nas etapas anteriores — as verificações são do Claude,
  via Bash, contra o repositório **público de verdade** (não uma simulação local): esta é a diferença central
  em relação às validações das Etapas 10 e 11.
- Se alguma verificação achar um problema real (segredo no histórico, nome fora do padrão, comando que não
  funciona a partir do clone público), a tarefa correspondente registra o achado e para para uma decisão —
  nada é corrigido silenciosamente sem avisar antes, mesmo sendo uma etapa "só de revisão".

**Ordem e dependências:** A → B → C → D. A T3 (clonar) é pré-requisito de T4–T6; a T7 (checklist dos
requisitos) usa o que A/B confirmarem; a T10 (registro da execução) depende da T9 (roteiro manual, com você).

### Bloco A — Segredos e nomes em todo o histórico

**T1 · Claude · Segredos e arquivos do backend em todo o histórico do Git**
- Arquivos: nenhum (só verificação).
- O que muda: nada no código; `git log --all --diff-filter=A --name-only` (todo arquivo já adicionado em
  qualquer commit, de qualquer branch) filtrado por padrões de nome suspeitos (`.env`, `secret`, `credential`,
  `senha`, `password`, `api/`), e uma conferência adicional do conteúdo dos commits que tocaram `.gitignore` ou
  arquivos de configuração, procurando por valores que pareçam token/senha/chave.
- Validar: nenhum resultado além do já esperado (`.env.example`, os componentes de campo de senha — que são UI,
  não segredo). Se algo suspeito aparecer, a tarefa para e relata, sem apagar histórico sozinho (reescrever
  histórico é uma operação destrutiva que precisa da sua autorização explícita).

**T2 · Claude · Nomes conforme o R6, no estado atual**
- Arquivos: nenhum (só verificação).
- O que muda: nada no código; repete a varredura da exploração (componentes/páginas em `PascalCase.jsx`, hooks
  em `useAlgo.js`, demais módulos em `camelCase`, pastas em minúsculas) sobre o `src/` atual, já com tudo que as
  Etapas 8, 10 e 11 acrescentaram.
- Validar: mesmo resultado da exploração (só `chavesSimulacoes.js`, um caso esperado, não uma violação); se a
  varredura achar algo novo fora do padrão, relatar antes de decidir o que fazer.

### Bloco B — Clone público e suíte completa

**T3 · Claude · Clonar o repositório público numa pasta limpa**
- Arquivos: nenhum (só verificação, fora deste repositório — um diretório temporário).
- O que muda: `git clone https://github.com/erbraga/rota_financeira-frontend.git` numa pasta temporária nova.
- Validar: o clone termina sem erro; `git log -1` no clone bate com o `git log -1` deste repositório (mesmo
  commit, confirmando que está tudo publicado).

**T4 · Claude · Comandos locais do README, a partir do clone público**
- Arquivos: nenhum (verificação no clone temporário).
- O que muda: nada no código; segue o README literalmente a partir do clone: `npm install`, `cp .env.example
  .env`, `npm run dev` (confere com `curl`), `npm test`, `npm run lint`, `npm run build`.
- Validar: os seis comandos terminam sem erro; a contagem de testes bate com o que o README cita; o `npm run
  dev` responde 200.

**T5 · Claude · Comandos de Docker do README, a partir do clone público**
- Arquivos: nenhum (verificação no clone temporário).
- O que muda: nada no código; `docker build --build-arg ...` e `docker run -p 8080:8080 ...`, copiados
  literalmente do README, a partir do clone.
- Validar: a imagem builda; o contêiner sobe; `http://localhost:8080/` e uma rota interna (fallback) respondem
  200; ao fim, contêiner e imagem de teste removidos, e o diretório do clone também.

### Bloco C — Checklist dos requisitos e documentação

**T6 · Claude · Montar o checklist de evidência dos seis requisitos**
- Arquivos: nenhum ainda (o conteúdo vai para o `CLAUDE.md` na T7).
- O que muda: nada no código; para cada requisito (R1 a R6), aponta o arquivo/linha ou o resultado de comando
  que comprova (ex.: R1 → os quatro métodos e onde cada hook os chama; R4 → `GraficoComparativo.jsx`,
  `CartoesResumo.jsx`, `ControleAporte.jsx`, `SugestaoDeTaxa.jsx`).
- Validar: cada requisito tem pelo menos uma evidência concreta (arquivo, comando ou tela), não uma alegação
  genérica.

**T7 · Claude · Reescrever a "Situação" dos requisitos e o "Estado atual" no `CLAUDE.md`**
- Arquivos: `CLAUDE.md`.
- O que muda: substitui o resumo desatualizado ("Etapas 0 e 1 concluídas... nenhum requisito entregue ainda")
  pela situação real (R1 a R6 atendidos, com a evidência da T6 resumida); acrescenta a nota da Etapa 12 em
  "Estado atual".
- Validar: releitura; nenhuma outra parte do `CLAUDE.md` foi tocada além do combinado na spec.

**T8 · Claude · Conferir e marcar o `plano.md`**
- Arquivos: `plano.md`.
- O que muda: confirma que as Etapas 0 a 8, 10 e 11 estão todas `[x]`/"concluída" (corrige qualquer checkbox
  esquecido) e marca a Etapa 12.
- Validar: leitura de ponta a ponta do arquivo; nenhuma etapa (fora a 9, pulada de propósito) sem marcação.

### Bloco D — Roteiro final e fechamento

**T9 · Você · Roteiro manual final, ponta a ponta**
- Arquivos: nenhum.
- O que muda: com o backend real no ar, um passar final pelo fluxo completo (registrar → login → criar
  simulação → opções → resultado → amortização → excluir) e uma conferência rápida em largura de celular — o
  mesmo tipo de roteiro já feito nas Etapas 8 e 10, agora como o fechamento do projeto inteiro.
- Validar: você me diz o resultado; qualquer falha vira correção antes da T10.

**T10 · Claude · Registrar a conclusão da etapa**
- Arquivos: esta spec.
- O que muda: a spec passa a "Concluída", com os critérios marcados e um "Registro da execução" (o que a T1–T8
  encontraram, e o resultado da T9).
- Validar: releitura do registro contra o que de fato foi feito.

**T11 · Você · Commit e push final**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica o fechamento (`CLAUDE.md`, `plano.md`, esta spec, e qualquer ajuste que a
  T4/T5 tenha revelado necessário).
- Validar: `git status` limpo; push sem erro; a página do repositório no GitHub, sem estar logado, mostra o
  README renderizado com o fluxograma.

### Registro da execução (2026-09-27)
- **Resultado:** nenhum segredo, `.env` nem a pasta `api/` em nenhum commit de todo o histórico do Git (não só
  no estado atual); nomes conforme o R6, sem violação (só `chavesSimulacoes.js`, um caso esperado, não um
  hook); clone público de verdade (`git clone` de `github.com/erbraga/rota_financeira-frontend`, commit
  `656f8c3`, igual ao local) com `npm install`, `npm run dev` (200 na 5173), `npm test` (1591/1591), `npm run
  lint` (0 avisos), `npm run build`, `docker build` e `docker run` (200 na raiz e no fallback `/simulacoes`) —
  todos funcionando sem nenhum ajuste; checklist dos seis requisitos com evidência, escrito no `CLAUDE.md`.
- **Achado (fora do escopo original da spec, corrigido no caminho):** um item nunca fechado desde a Etapa 4 — a
  miniatura da série do índice, um extra opcional do R4, adiada "se sobrar tempo" e nunca retomada — foi
  registrada no `plano.md` como fora da entrega (não é requisito formal; os seis requisitos estão atendidos sem
  ela).
- **Bug achado durante a T9 (roteiro manual, pelo autor):** o `.env` LOCAL do frontend (não versionado) estava
  com `VITE_API_URL=http://localhost:8080/api` (a porta do contêiner Docker, testado nas Etapas 10/12) em vez
  de `http://localhost:5000/api` (o backend real) — resíduo de uma edição manual do autor durante os testes do
  Docker. O sintoma no navegador foi "Não foi possível falar com o servidor" com um erro de CORS no console
  (`localhost:8080` não libera a origem `:5173`, e mesmo se liberasse, o contêiner não é a API). Diagnosticado
  comparando o `curl` direto ao backend (que funcionava) com o erro do console do navegador (que revelou a URL
  errada) — o backend e o CORS nunca estiveram com problema. Corrigido o `.env` e reiniciado o `npm run dev`
  (a variável é lida na hora que o Vite sobe, não muda sozinha com o arquivo editado). Não é um bug do código
  do projeto — é um lembrete de que o `.env` local, sendo não versionado e editado à mão nos testes de Docker,
  pode ficar "esquecido" apontando para o lugar errado.
- **Verificação no navegador (T9, pelo autor):** depois da correção do `.env`, o fluxo completo funcionou —
  registrar, login, criar simulação com as taxas sugeridas, opções de financiamento, resultado, amortização,
  excluir — e a conferência em largura de celular também.
- **Resíduos:** uma conta de diagnóstico (`diag-teste-xyz123@example.com`, senha descartada, sem simulação)
  criada por mim via `curl` para isolar o problema do `.env` antes de saber a causa; contêiner, imagem e
  diretório de clone de teste (T3–T5) removidos ao fim.
- **Publicação (T11):** pendente, com você.

---
*Concluída (T1 a T10). Falta só a T11 (commit e push final, com você).*
