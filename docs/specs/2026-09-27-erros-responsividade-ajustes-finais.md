# Tratamento de erros, responsividade e ajustes finais (Etapa 8) — Spec

**Criado em:** 2026-09-27
**Status:** Concluída em 2026-09-27 (T1 a T16 do plano, incluindo a T15 — verificação manual no navegador, com você, "tudo funcionou"); falta só **T17** (commit e push, com você)
**Etapa do plano:** 8 (`plano.md`) · **Requisito:** R4 (feedback visual mais elaborado) e qualidade geral de entrega

## Problema
Todas as telas já são reais (Etapas 2 a 7), mas a SPA nunca foi revisada **como um todo**. Uma auditoria automatizada em Chrome (4 larguras, todas as telas, com dados reais) e a leitura do código acharam problemas concretos:
duas telas rolam para o lado, a navegação dentro do app abre a tela nova no meio da página com o foco perdido, o título da aba é sempre o mesmo, um erro inesperado de renderização deixa a tela em branco, um texto de aviso não atinge o contraste mínimo
e o pacote inicial passa de 1,1 MB. Nada disso quebra o fluxo principal, mas aparece na primeira vez que alguém usa o app no celular, com teclado ou com leitor de tela.

## Objetivo
Corrigir o que a auditoria achou e fechar as lacunas do plano da etapa: uma camada única de erros em português, **fronteira de erro** em duas camadas (tela em branco nunca), título e foco ao navegar, responsividade sem rolagem lateral, acessibilidade básica (contraste, foco, leitor de tela) e desempenho inicial melhor,
sem mudar nenhum fluxo, regra financeira nem contrato com o backend. Ao fim, repetir a **mesma auditoria** e ter zero rolagem lateral e nenhuma tela sem título.

## Fora de escopo
- Novas funcionalidades, telas ou endpoints; qualquer regra ou cálculo financeiro; mudanças no backend.
- Exportação por impressão (**Etapa 9**, opcional), Dockerfile (**Etapa 10**), README e fluxograma (**Etapa 11**) e a revisão final de entrega (**Etapa 12**).
- Temas escuro, internacionalização, PWA, ilustrações ou novos ícones (continuam os mesmos 5), biblioteca de testes de acessibilidade automática e ferramentas de cobertura (nenhuma dependência nova).
- Mudar o comportamento dos avisos (`Snackbar` em fila, um por vez) e da sessão (só o `401` encerra; sem relógio), decididos nas Etapas 2 e 3.

## Proposta

### O que foi verificado (estado atual)
| Item | Situação |
|---|---|
| Camada de mensagens de erro | **Já existe** e cobre o pedido: `ErroApi`/`ErroRede` (rede fora do ar e timeout com texto próprio), `mensagemDeErro` (mensagem do backend em português para 4xx/5xx, genérica para o resto, nunca corpo cru), `aplicarErrosDoServidor` (422 por campo) e as mensagens genéricas de `api.js` quando o corpo não é o JSON esperado (proxy, HTML). Os textos ficam em três lugares (`erros.js`, `api.js`, `errosDeFormulario.js`) |
| Feedback visual | esqueletos (`EsqueletoLista` e o do formulário), botões com progresso ("Salvando…"), estados de erro com **Tentar de novo**, `Snackbar` de sucesso, estados vazios e aviso de cache dos índices: consistentes entre as telas |
| Página 404 da SPA | existe (`NaoEncontrada`, sob o layout público) |
| `ErrorBoundary` | **não existe**: um erro de renderização deixa a tela em branco |
| Acessibilidade | rótulos nos campos, ícones com `aria-label`, gráficos com resumo em texto, diálogos do MUI (foco preso e Esc), regiões vivas nos avisos; faltam título por tela, foco ao navegar e um contraste (abaixo) |
| Desempenho | um único pacote de 1.162 kB (354 kB gzip); o Recharts entra em todas as cargas, mesmo no login |
| Testes | 1517 em 66 arquivos; sem cobertura para `ErrorBoundary`, título da página e foco ao navegar (não existem ainda) |
| Dependências | tudo instalado; **nenhuma dependência nova e nenhum ícone novo** |

### Achados da auditoria (Chrome headless, 320/375/768/1280 px, 10 telas, dados reais)
| # | Achado | Evidência | Gravidade |
|---|---|---|---|
| 1 | **Rolagem horizontal** no resultado e na amortização, em **todas** as larguras (+8 px no celular, +16 px no tablet, +56 px no desktop) | O texto "só para leitor de tela" dos dois gráficos mede 375×800 px: no `sx` do MUI, `width: 1` e `height: 1` significam **100 %**, não 1 px (e `m: -1` vale −8 px). O elemento absoluto estica a página | alta (o problema está em 6 das 10 telas de dados) |
| 2 | **A tela nova abre rolada** ao navegar dentro do app | Do resultado rolado 1000 px, **Ver parcelas** abre a amortização em `scrollY` 997, com o título 917 px acima da janela; **Voltar ao resultado** repete o problema. O foco fica no `body` | alta |
| 3 | **Título da aba é sempre "Rota Financeira"** | `document.title` idêntico nas 10 telas (histórico do navegador, abas e leitor de tela ficam sem contexto) | média |
| 4 | **Sem `ErrorBoundary`** | nenhum `componentDidCatch`/`getDerivedStateFromError` no código | média |
| 5 | **Contraste de texto insuficiente** | `warning.dark` (#e65100) sobre branco dá **3,79:1** (mínimo AA para texto: 4,5:1) e é usado no aviso "Dados do cache, podem estar defasados." Os demais pares passam: primário 5,75, secundário 5,32, verde-escuro 7,87, texto 16,1, texto secundário 5,74, erro 4,98, branco sobre primário 5,75 | média |
| 6 | **Pacote inicial grande** | 1.162 kB. Experimento (revertido): carregar `Resultado` e `Amortizacao` sob demanda deixa o **carregamento inicial em cerca de 763 kB** (242 kB gzip), com o Recharts só ao abrir essas telas | média |
| 7 | Alvos de toque | nenhum botão ou controle abaixo de 24 px (mínimo AA); os botões pequenos têm 31 px de altura e os links dentro de frases (19 px) são isentos | ok (sem ação) |
| 8 | Erros de console | nenhum erro do app nas 40 cargas (a única linha é o `404` da API na tela de "não encontrada", que o Chrome registra sozinho) | ok |
| 9 | Aparência no celular | as capturas de resultado, amortização, formulário e histórico em 375 px estão legíveis: cartões empilham, a tabela rola dentro do quadro e a legenda quebra linha | ok |

### Estrutura criada e alterada
```
src/
  components/ErrorBoundary.jsx        # fronteira de erro (React só permite classe para isso; exceção à regra "sem classes"), em duas camadas
  components/ErroInesperado.jsx       # as duas telas de "algo deu errado": por tela (dentro do layout) e global (tela cheia)
  components/MudancaDeRota.jsx        # a cada troca de tela: rola ao topo e move o foco para o título principal
  hooks/useTituloDaPagina.js          # define o `document.title` de cada tela
  utils/mensagemDeErro.js             # passa a ser o único lugar dos textos de erro (junta os três)
  estilos.js (ou utils)               # o estilo "só para leitor de tela" corrigido, usado pelos dois gráficos
  App.jsx                             # rotas `Resultado` e `Amortizacao` sob demanda (React.lazy + Suspense com o esqueleto de carregamento)
  Raiz.jsx / components/Layout.jsx    # a fronteira global em volta do app (Raiz) e a por tela em volta do <Outlet /> (Layout)
  theme.js                            # `warning.dark` com contraste de texto
  pages/*.jsx                         # cada tela chama `useTituloDaPagina`
index.html                            # descrição e cor do tema
```

### Comportamento
- **Camada única de erros:** todo texto de erro mostrado à pessoa nasce em `utils/mensagemDeErro.js` (rede fora do ar, timeout, 401 "sessão expirada", 404, 409, 422 por campo, 500 e 503, mais o inesperado), em português, **sem** corpo cru, URL, stack nem código técnico. O comportamento visível não muda; o que muda é que os
  três lugares de hoje viram um só e ficam cobertos por testes de todos os códigos.
- **Fronteira de erro (duas camadas):** um erro de renderização nunca deixa tela em branco e **registra** o erro no console do navegador para diagnóstico (o único `console.error` permitido, com o texto do erro e sem dados da pessoa), sem expor o stack na tela. (1) **Por tela**, dentro do `Layout` em volta do `<Outlet />`: a barra do topo e o **Sair** continuam, o conteúdo vira "Algo deu errado nesta tela" com **Tentar de novo** e o link para as simulações, e ao **trocar de tela** a fronteira se reinicia sozinha (um erro numa tela não contamina as outras). (2) **Global**, em volta de todo o app (`Raiz`): tela cheia "Algo deu errado" com **Recarregar a página**, só para o que quebrar fora do layout (providers, layout público, login).
- **Título, rolagem e foco ao navegar:** cada tela define o título da aba ("Resultado: Carro de exemplo · Rota Financeira", "Entrar · Rota Financeira" etc.; as telas de erro e "não encontrada" também) e, a cada **troca de tela** (mudança do caminho, **não** do `?aporte_mensal=`), a página volta ao topo e o foco vai para o título principal (`h1`), para o
  leitor de tela anunciar a tela nova e o teclado começar do começo. O Voltar e o Avançar do navegador também abrem a tela no topo (não se guarda posição de rolagem).
- **Sem rolagem lateral:** o estilo "só para leitor de tela" dos dois gráficos passa a ter 1 px de verdade e a ficar contido no bloco do gráfico, e a auditoria não pode achar nenhum elemento fora da largura da janela (fora dos quadros de rolagem da tabela, que são intencionais).
- **Contraste:** o `warning.dark` do tema escurece até ao menos 4,5:1 sobre branco (o texto do aviso de cache e as linhas e barras que o usam continuam legíveis, agora também como texto), sem mudar a paleta primária e secundária; um teste guarda todos os pares usados.
- **Desempenho:** `Resultado` e `Amortizacao` (as duas telas com gráfico) passam a carregar **sob demanda** (`React.lazy` + `Suspense`), com o mesmo esqueleto de carregamento das telas enquanto o pacote vem; se o pacote falhar em carregar (rede caiu ou versão nova publicada) a pessoa vê o erro com **Tentar de novo** (recarregar). O carregamento inicial cai de 1.162 kB para cerca de 763 kB. Sem divisão das bibliotecas em pedaços próprios.
- **Falta de conexão:** sem faixa global; ficam as mensagens de rede que cada tela já mostra ("Não foi possível falar com o servidor.", com **Tentar de novo**).
- **Textos e formatos:** revisão de todos os textos de tela (acentos, "opção" e "simulação", "R$" e "% a.a./a.m.", reticências, mensagens de aviso) e do `index.html` (`lang`, descrição, cor do tema); nada de `dangerouslySetInnerHTML`, `eval`, `console.log` ou `debugger` no código entregue (já verificado nas etapas anteriores e conferido de novo).
- **Roteiro de erros** (feito por você e por mim): backend parado, token apagado no meio da sessão, `409`, `422`, `503` dos índices, id inexistente na URL, erro de renderização forçado, falta de conexão (se aprovada) e largura de celular.

### Mocks e testes
- `mensagemDeErro`: uma tabela de códigos e textos (rede, timeout, 401, 404, 409, 422 sem detalhes, 500, 503, 502/504, 4xx desconhecido, `Error` comum), com literais, e o controle de que corpo cru, URL e stack **nunca** aparecem.
- `ErrorBoundary` e `ErroInesperado`: um componente que lança na renderização mostra a tela de erro (não a tela em branco), registra o erro, e o botão permite sair dela; um componente que não lança não mostra nada (controle); a fronteira **por tela** mantém a barra e o Sair e volta ao normal quando a rota muda (uma tela quebrada não contamina a seguinte); a **global** mostra a tela cheia com **Recarregar a página** para um erro fora do layout.
- `useTituloDaPagina` e `MudancaDeRota`: o título de cada tela (uma linha por tela, com o nome dinâmico do resultado e da amortização), a rolagem ao topo e o foco no `h1` quando o **caminho** muda e **não** quando só o `?aporte_mensal=` muda (controle), sem foco roubado quando a tela abre com um campo em foco (formulário com `autoFocus`).
- Estilo "só para leitor de tela": largura e altura em pixels reais nos dois gráficos.
- Contraste: um teste calcula a razão de cada par de cor do tema (texto e fundo) e exige ≥ 4,5 para texto e ≥ 3 para gráfico.
- Divisão do código: as rotas sob demanda carregam com o mesmo comportamento das atuais (esqueleto enquanto carrega, erro com **Tentar de novo** se o pacote falhar em carregar), e os testes de rota (`App.test`) seguem verdes; o `build` confirma que o carregamento inicial ficou menor.
- Cada teste de comportamento tem um controle (a versão sem o comportamento). Repetição da **auditoria em Chrome** ao fim (mesmo script, quatro larguras, dez telas): zero rolagem lateral, um título por tela, foco no título depois de navegar e nenhum erro de console do app.

### Casos de borda
- **Erro de renderização dentro de um diálogo ou de um gráfico:** a fronteira o captura como qualquer outro; a tela mostra o erro e o app continua utilizável ao sair dela.
- **Erro depois de a sessão expirar:** o `401` continua tendo prioridade (leva ao login); a fronteira só cuida de erros de renderização.
- **Pacote de uma rota que falha em carregar** (rede caiu com o app aberto, ou versão nova publicada): mostra o erro com **Tentar de novo** (recarregar), nunca tela em branco.
- **Formulário com `autoFocus`** (nome da simulação, senha): o foco no título ao navegar não pode roubar o foco de um campo que o formulário já focou; o campo tem prioridade.
- **Só o endereço muda** (o aporte em `?aporte_mensal=`, o Voltar do navegador dentro da mesma tela): não rola ao topo nem move o foco.
- **Título com nome longo** (até 120 caracteres): a aba mostra o que couber; nada quebra.
- **Leitor de tela e foco no `h1`:** o `h1` recebe foco programático sem virar parada de tabulação (o foco sai dele ao primeiro Tab) e sem contorno feio para quem usa mouse.
- **Reduzir movimento:** a rolagem ao topo é instantânea (sem animação), respeitando quem pediu menos movimento.

### Resíduos no banco de desenvolvimento do backend
A exploração desta spec usou **três contas descartáveis** (`sonda-<aleatório>@example.com`; senhas aleatórias já descartadas, nunca impressas): a auditoria de quatro larguras e dois diagnósticos. Criaram simulações e opções e **apagaram tudo** ao fim (as contas terminaram com 0 simulações).
O backend não exclui usuários; sem impacto para o app.

## Decisões em aberto
Resolvidas em 2026-09-27 (decisões do autor):
1. ~~Dividir o código por rota~~ **Dividir só as duas telas com gráfico:** `Resultado` e `Amortizacao` carregam sob demanda (o carregamento inicial cai de 1.162 kB para cerca de 763 kB, de 354 para 242 kB comprimido), com o esqueleto de carregamento enquanto o pacote vem e o erro com **Tentar de novo** se ele falhar.
   Sem divisão das bibliotecas em pedaços próprios e sem manter um pacote só.
2. ~~Título e foco ao navegar~~ **Título da aba, rolar ao topo e foco no título:** a cada troca de tela (mudança do caminho, não do `?aporte_mensal=`) o título da aba muda, a página volta ao topo e o foco vai para o `h1`, sem contorno para o mouse, sem roubar o foco de um campo que a tela já focou e com a rolagem instantânea
   (respeitando quem pede menos movimento).
3. ~~Erro inesperado de renderização~~ **Duas camadas, por tela e global:** uma fronteira dentro do layout (a barra e o Sair ficam; **Tentar de novo** e o link para as simulações; reinicia ao trocar de tela) e uma global de tela cheia com **Recarregar a página** para o que quebrar fora do layout.
4. ~~Aviso de falta de conexão~~ **Não incluir a faixa global:** ficam as mensagens de rede de cada tela (com **Tentar de novo**), pois o navegador só sabe estar offline quando a rede cai e nunca quando a API está fora, que é o caso comum.

Sem decisões em aberto: a spec está pronta para o `/plan`.

## Critérios de aceite
- [x] `npm run lint` (0 avisos), `npm test` e `npm run build` verdes; nenhuma dependência nova e nenhum ícone novo.
- [x] **A auditoria em Chrome, repetida, dá zero rolagem lateral** nas 10 telas e nas 4 larguras; cada tela tem o seu título de aba; depois de navegar dentro do app a tela abre no topo e o foco vai para o título; nenhum erro de console do app.
- [x] Um erro de renderização (forçado num teste e no navegador) mostra a tela de erro amigável, sem stack e sem tela em branco, e o app continua utilizável ao sair dela.
- [x] Todos os textos de erro nascem numa camada só, em português, sem corpo cru nem detalhe técnico, com testes de todos os códigos (rede, timeout, 401, 404, 409, 422, 500, 503).
- [x] O contraste de todos os pares de cor do tema é ≥ 4,5:1 (texto) e ≥ 3:1 (gráfico), com teste.
- [x] O carregamento inicial fica em cerca de 763 kB (contra 1.162 kB), e as duas telas com gráfico, carregadas sob demanda, mostram o esqueleto e tratam a falha de carregamento com **Tentar de novo**.
- [x] O roteiro manual de erros (backend parado, token apagado, 409, 422, 503 dos índices, id inexistente, erro de renderização forçado e largura de celular) passa em desktop e em celular.
- [x] Os textos de tela foram revisados (acentos, termos, formatos) e o `index.html` tem descrição e cor do tema; nenhum `console.log`, `debugger`, `dangerouslySetInnerHTML` ou `eval`.
- [x] O `CLAUDE.md` é atualizado (estrutura, convenções da etapa, contagem de testes, lições) e o `plano.md` marca a Etapa 8.

## Plano de Implementação

**Status:** executado (T1 a T16) · falta **T17** (você, commit e push) · **Criado em:** 2026-09-27

São 18 tarefas pequenas, em sete blocos. Cada uma indica **quem executa** (**Claude** ou **Você**), os arquivos, o que muda e como validar. O código de cada módulo nasce **junto com os seus testes** (`*.test.js(x)` ao lado). Regras para todo o plano:
- O Claude **não** roda `git add`, `commit` nem `push` (os commits são seus).
- Ao fim de cada tarefa que altera código: `npm run lint` (0 avisos) e `npm test` verdes.
- Cada teste de comportamento tem um **controle** (a versão que não deve disparar) que prova que ele pode falhar; os testes de guarda (foco que não rouba o campo, não rolar quando só o `?aporte_mensal=` muda, a fronteira que se reinicia ao trocar de tela) são provados também **removendo a checagem do código por um instante**, como nas Etapas 4 a 7.
- **Nenhuma mudança de fluxo, regra financeira ou contrato com o backend:** os testes das Etapas 2 a 7 seguem verdes **sem alterar o que verificam** (os que dependem de foco ou de título são ajustados na mesma tarefa que muda o comportamento).
- **Sem dependência nova e sem ícone novo:** a T13 confere o `package.json` e que o bundle continua com os mesmos 5 ícones.
- **Armadilha dos testes:** a trava do `setupTests.js` faz qualquer `console.error` falhar o teste, e o React **e** a nossa fronteira registram o erro capturado; os testes da fronteira silenciam o `console.error` de propósito (`vi.spyOn`) e conferem o que foi registrado.
- **`.gitignore`:** a T16 confere com `git status --ignored` e `git check-ignore -v` que nenhum arquivo novo foi ignorado por engano.
- **Segredos:** as contas descartáveis (T14; senha aleatória, nunca impressa) criam e **apagam** o que usarem. A auditoria em Chrome usa um perfil temporário, apagado ao fim.

**Ordem e dependências:** A → B → C → D → E → F → G. A T5 usa o hook da T4; a T7 usa o componente da T6; a T9 usa a T8; a T10 usa a fronteira por tela da T9 (uma falha no carregamento de uma rota é capturada por ela); a T14 usa tudo.
As tarefas que exigem **você** são a T15 (navegador) e a T17 (commit).

### Bloco A — Correções da auditoria

**T1 · Claude · O estilo "só para leitor de tela" dos gráficos**
- Arquivos: `src/estilos.js` (novo), `src/components/GraficoComparativo.jsx`, `src/components/GraficoAmortizacao.jsx`, `src/estilos.test.js` e os dois testes dos gráficos.
- O que muda: o estilo do resumo em texto dos dois gráficos passa a viver num só módulo, com **1 px de verdade** (`'1px'`, `margin: '-1px'`) e contido no bloco do gráfico (`position: relative` no `figure`), no lugar do `width: 1` do `sx`, que o MUI lê como 100 %.
- Validar: `npm test`: o estilo tem `width`, `height` e `margin` em pixels literais (controle: os valores antigos `1` e `-1` seriam recusados pelo teste); nos dois gráficos o parágrafo de resumo mede 1 px de largura e de altura (`getComputedStyle`), o `figure` é o contêiner posicionado e o texto continua acessível (`aria-describedby` e conteúdo); os testes atuais dos gráficos seguem verdes sem alteração. A conferência da rolagem lateral no Chrome fica na T14.

**T2 · Claude · Contraste de texto do tema**
- Arquivos: `src/theme.js`, `src/theme.test.js`.
- O que muda: o `warning.dark` do tema escurece até ao menos 4,5:1 sobre branco (o aviso "Dados do cache, podem estar defasados." é texto), sem mexer na paleta primária e secundária, e um teste guarda a razão de contraste de todos os pares de cor usados.
- Validar: `npm test`: uma função de razão de contraste (fórmula WCAG, escrita no teste) confirma **≥ 4,5** para os pares de texto (`primary` e `secondary` sobre branco, `warning.dark`, `success.dark`, `error`, texto principal e secundário, branco sobre `primary`) e **≥ 3** para as cores de gráfico; controle: o valor antigo (#e65100, 3,79) é recusado pelo mesmo teste; a cor nova é a menor mudança que passa (o teste anota a razão); os testes dos componentes que usam a cor seguem verdes.

### Bloco B — Camada única de erros

**T3 · Claude · Textos de erro num só lugar**
- Arquivos: `src/utils/textosDeErro.js` (novo, sem importações), `src/utils/mensagemDeErro.js`, `src/utils/errosDeFormulario.js`, `src/api/erros.js`, `src/api/api.js` e os testes correspondentes (`mensagemDeErro.test.js`, `erros.test.js`, `api.test.js`, `errosDeFormulario.test.js`).
- O que muda: as mensagens de rede fora do ar, timeout, o inesperado e as genéricas por código HTTP (hoje em `erros.js`, `api.js` e `errosDeFormulario.js`) passam para um módulo folha, importado pelos outros (uma folha sem importações evita ciclo, já que `mensagemDeErro` importa `erros.js`), e `mensagemDeErro` continua sendo o único que decide o texto mostrado.
- Validar: `npm test` com uma **tabela de literais**: rede fora do ar ("Não foi possível falar com o servidor."), timeout ("O servidor demorou demais para responder."), inesperado ("Ocorreu um erro inesperado. Tente novamente."), e as genéricas para corpo que não é o JSON esperado (400, 401, 403, 404, 409, 415, 422, 500, 502, 503, 504, um 5xx desconhecido e um 4xx desconhecido); a mensagem do backend em português continua aparecendo para 4xx e 5xx com `{ erro }`; **controle: nunca** aparecem corpo cru (HTML de proxy), URL, stack, nome de classe nem `[object Object]` (o teste injeta cada um e confere); os textos antigos continuam iguais (os testes atuais passam sem alterar o que verificam); um `grep` confirma que nenhum outro arquivo do `src/` tem um desses textos escritos.

### Bloco C — Título, rolagem e foco ao navegar

**T4 · Claude · `useTituloDaPagina` e os títulos das telas públicas e do histórico**
- Arquivos: `src/hooks/useTituloDaPagina.js`, `src/hooks/useTituloDaPagina.test.jsx`, `src/pages/Login.jsx`, `Registro.jsx`, `NaoEncontrada.jsx`, `Simulacoes.jsx`, os testes dessas páginas e `index.html`.
- O que muda: um hook que define o `document.title` no formato "*tela* · Rota Financeira" e o usa nas telas públicas ("Entrar", "Criar conta", "Página não encontrada") e no histórico ("Minhas simulações"); o `index.html` ganha `description` e `theme-color`.
- Validar: `npm test`: o hook define o título ao montar e o atualiza quando o texto muda; nome de 120 caracteres não quebra; sem texto o título volta a "Rota Financeira" (controle); cada uma das quatro telas tem o seu título (literais) e o título **muda** ao ir de uma para outra; `index.html` tem `lang="pt-BR"`, `description` e `theme-color`.

**T5 · Claude · Títulos das demais telas**
- Arquivos: `src/pages/SimulacaoForm.jsx`, `Resultado.jsx`, `Amortizacao.jsx`, `src/components/SimulacaoNaoEncontrada.jsx`, `ErroSessao.jsx`, `CarregandoSessao.jsx` (se tiverem texto de tela) e os testes das páginas.
- O que muda: as telas de criar e editar simulação ("Nova simulação", "Editar simulação"), o resultado ("Resultado: *nome*"), a amortização ("Amortização: *nome*"), a de "Simulação não encontrada" e as de erro de sessão passam a definir o título; o nome vem do dado que a tela já tem (o eco do `/resultado` e o `financiamento` do `/parcelas`), sem chamada nova.
- Validar: `npm test`: o título de cada tela com o nome dinâmico (literais das fixtures: "Resultado: Carro de exemplo · Rota Financeira", "Amortização: Banco Exemplo Price 48x · Rota Financeira"); enquanto carrega o título é o da tela sem o nome (controle: não aparece "undefined"); as telas de erro e de "não encontrada" têm o próprio título; nenhum título repete o de outra tela.

**T6 · Claude · `MudancaDeRota`: rolar ao topo e focar o título**
- Arquivos: `src/components/MudancaDeRota.jsx`, `src/components/MudancaDeRota.test.jsx`, `src/theme.js` (só o contorno do foco programático), `src/theme.test.js`.
- O que muda: a cada troca do **caminho** (não do `?aporte_mensal=`) a página rola ao topo (instantâneo) e o foco vai para o `h1` da tela nova (`tabIndex="-1"`, sem contorno para quem usa mouse); o `h1` pode aparecer depois do carregamento dos dados, então o componente espera por ele por um tempo curto; não move o foco se um campo de formulário, um diálogo ou outro elemento interativo já o tem, e não faz nada na primeira carga da página.
- Validar: `npm test` (com `window.scrollTo` simulado): trocar de `/simulacoes` para `/simulacoes/1/resultado` rola ao topo e foca o `h1` **que só aparece depois** de uma resposta simulada (comporta); trocar só o `?aporte_mensal=` **não** rola nem move o foco (controle); um campo com foco (formulário com `autoFocus`) **mantém** o foco; um diálogo aberto mantém o foco; a primeira carga não move o foco; voltar e avançar do navegador (`navigate(-1)`) também rolam ao topo; o `h1` focado não é parada de tabulação (o Tab seguinte vai ao primeiro elemento interativo depois dele) e o tema tira o contorno só do foco **programático** do `h1`; sem `h1` na tela, sem erro e sem foco perdido (o componente desiste depois do tempo).

**T7 · Claude · Ligar o `MudancaDeRota` ao app**
- Arquivos: `src/App.jsx`, `src/App.test.jsx`, os testes de página afetados.
- O que muda: o `MudancaDeRota` entra uma vez em `App.jsx`, dentro do roteador e acima das rotas.
- Validar: `npm test`: em `App`, ir do histórico ao resultado e depois à amortização com **Ver parcelas** rola ao topo e deixa o foco no título de cada tela; voltar ao resultado pelo link também; as telas privadas e as públicas (login, registro) se comportam do mesmo jeito; os testes atuais que dependiam de foco ou de posição são ajustados **sem relaxar nenhuma verificação**; a suíte inteira verde.

### Bloco D — Fronteiras de erro

**T8 · Claude · `ErrorBoundary` e `ErroInesperado`**
- Arquivos: `src/components/ErrorBoundary.jsx`, `src/components/ErroInesperado.jsx`, os testes de cada um.
- O que muda: a fronteira (a única classe do projeto: o React só permite fronteira por classe) captura o erro de renderização dos filhos, **registra** só o texto do erro no console e mostra a tela `ErroInesperado`, com duas variantes: **por tela** ("Algo deu errado nesta tela", **Tentar de novo** e o link para as simulações) e **global** (tela cheia, "Algo deu errado", **Recarregar a página**); ela se reinicia quando uma `chave` de reinício muda.
- Validar: `npm test` (com o `console.error` silenciado de propósito): um filho que lança mostra a tela de erro em vez de tela em branco; o que foi registrado é o texto do erro, sem stack na tela e sem dados da pessoa (controle: o texto do stack nunca aparece); um filho que não lança não mostra nada da fronteira; **Tentar de novo** reinicia e mostra o filho de novo se o erro passou; mudar a `chave` reinicia sozinha; a variante global tem **Recarregar a página** (`window.location.reload` simulado) e a por tela tem o link para `/simulacoes`; o erro de carregamento de um pacote (`Failed to fetch dynamically imported module`) faz o **Tentar de novo** recarregar a página em vez de só reiniciar (um pacote que falhou não se recupera sozinho); `ErroInesperado` tem título e foco no botão principal.

**T9 · Claude · Fronteiras no layout e na raiz**
- Arquivos: `src/Raiz.jsx`, `src/components/Layout.jsx`, `src/Raiz.test.jsx`, `src/components/Layout.test.jsx`, `src/App.test.jsx`.
- O que muda: a fronteira **global** envolve todo o app em `Raiz`, e a **por tela** envolve o `<Outlet />` do `Layout`, com o caminho da rota como chave de reinício (trocar de tela reinicia a fronteira).
- Validar: `npm test`: numa tela que lança dentro do layout privado, a **barra e o Sair continuam** e o **Sair funciona**; trocar de tela reinicia (a tela seguinte abre normalmente, **uma tela quebrada não contamina a outra**); um erro fora do layout (por exemplo num filho do layout público) mostra a tela cheia com **Recarregar a página**; um `401` continua tendo prioridade (o erro de renderização não engole o redirecionamento); a suíte inteira verde.

### Bloco E — Desempenho

**T10 · Claude · Divisão por rota: `Resultado` e `Amortizacao` sob demanda**
- Arquivos: `src/App.jsx`, `src/components/CarregandoTela.jsx` (esqueleto genérico de carregamento de uma rota), `src/App.test.jsx`, `src/pages/Resultado.test.jsx`, `src/pages/Amortizacao.test.jsx`.
- O que muda: as duas telas com gráfico passam a carregar sob demanda (`React.lazy` + `Suspense` com o esqueleto de carregamento), o que tira o Recharts do pacote inicial; se o pacote falhar em carregar, a fronteira por tela da T9 mostra o erro e o **Tentar de novo** recarrega a página.
- Validar: `npm test`: a rota do resultado e a da amortização mostram o **esqueleto** enquanto o pacote vem e depois a tela (comporta); um `import` que rejeita (simulado) mostra a tela de erro da fronteira com **Tentar de novo**, sem tela em branco; as demais rotas não passam por `Suspense`; os testes das duas páginas seguem verdes; `npm run build`: o carregamento inicial (o `index.html`, os pacotes que ele referencia e os pré-carregados) ficou em **cerca de 763 kB** (contra 1.162 kB) e o Recharts está num pacote que só a rota de resultado e a de amortização usam (conferido pelos arquivos de `dist/` e pelas referências do `index.html`); nenhum aviso novo no build além do de pacote grande, se ainda houver.

### Bloco F — Textos e lacunas

**T11 · Claude · Revisão dos textos e do código entregue**
- Arquivos: os `.jsx` e `.js` com texto de tela que a revisão apontar (e os testes que repetem o texto), `index.html`.
- O que muda: revisão de todos os textos de tela (acentos, uso de "opção", "simulação" e "financiamento", "R$" e "% a.a./a.m.", reticências, mensagens de aviso, rótulos e ajudas) e correção do que estiver inconsistente, sem mudar sentido nem fluxo.
- Validar: um relatório curto do que foi encontrado e corrigido (com o arquivo e o texto antes e depois); `grep` confirma **nenhum** `console.log`, `debugger`, `dangerouslySetInnerHTML` nem `eval` no código de produção (o `console.error` da fronteira é o único `console` permitido); textos iguais em todas as telas para a mesma coisa (por exemplo, "Tentar de novo", "Voltar ao histórico"); `npm test` verde (os testes que repetem um texto corrigido são ajustados na mesma tarefa).

**T12 · Claude · Lacunas de teste**
- Arquivos: `src/utils/errosDeFormulario.test.js`, `src/api/api.test.js`, e os testes que a revisão apontar.
- O que muda: cobre o que a revisão achar sem teste: o mapeamento dos `detalhes` do backend para os campos (valor que não é lista, chave desconhecida, lista vazia, vários campos, erro que não é da API, `ErroRede`) e as mensagens de erro por código que ainda não tenham teste.
- Validar: `npm test`: cada caso novo tem um controle; a lista do que estava sem teste e passou a ter é registrada no relatório da T11; nenhum teste existente é removido nem afrouxado.

### Bloco G — Verificação e fechamento

**T13 · Claude · Verificação completa**
- Arquivos: nenhum (só leitura, salvo correções).
- O que muda: rodo tudo de ponta a ponta.
- Validar: `lint` com 0 avisos; `npm test` verde **três vezes seguidas** (para pegar instabilidade dos testes de foco e de carregamento) com a contagem registrada; `npm run build`, o tamanho do pacote inicial e o do total; `npm ls --all` sem problemas; `git diff HEAD -- package.json package-lock.json` vazio (nenhuma dependência nova);
  os **mesmos 5 ícones**; nenhum `console.log`, `debugger`, `dangerouslySetInnerHTML` nem `eval` no código de produção (só o `console.error` da fronteira); `grep` confirma que só `api/api.js` chama `fetch` e que os textos de erro estão só no módulo folha; nenhum dado de teste no `dist/`.

**T14 · Claude · Auditoria em Chrome, repetida**
- Arquivos: nenhum.
- O que muda: só verificação; subo o `dev`, uso uma **conta descartável nova** (senha aleatória, nunca impressa) com simulações e opções, e repito **o mesmo script da auditoria** (Chrome headless, 4 larguras, 10 telas) mais os cenários novos.
- Validar: **zero rolagem lateral** nas 10 telas e nas 4 larguras (a `scrollWidth` igual à largura da janela); cada tela com o **seu título** (10 títulos distintos); do resultado rolado 1000 px, **Ver parcelas** abre a amortização no **topo** com o foco no `h1`, e **Voltar ao resultado** também; simular um aporte no resultado **não** rola nem move o foco; nenhum erro de console do app; um **erro de renderização forçado** (o Chrome devolve um `/resultado` malformado por interceptação de rede) mostra a tela "Algo deu errado nesta tela" **com a barra e o Sair**, e trocar de tela a recupera; a **falha de carregamento** do pacote do resultado (o Chrome bloqueia o arquivo) mostra o erro com **Tentar de novo**; o pacote inicial transferido no `/login` é **menor que o de antes** (medido pelos bytes dos arquivos JS carregados) e o do resultado só é baixado ao abrir a rota; a conta termina com 0 simulações e o perfil temporário do Chrome é apagado.

**T15 · Você · Verificação no navegador**
- Arquivos: nenhum.
- O que muda: com `npm run dev` (eu subo) e o backend no ar, você abre `http://localhost:5173`, entra e confere, com o console aberto (F12):
  1. **Celular:** na barra de dispositivos do Chrome (F12 → ícone de celular, 360 e 390 de largura), percorra login, registro, histórico, nova, editar, resultado e amortização: **nenhuma rolagem lateral** (o resultado e a amortização eram os problemas) e tudo legível.
  2. **Títulos:** a aba mostra um título diferente em cada tela ("Entrar · Rota Financeira", "Resultado: *nome* · Rota Financeira" etc.); o histórico do navegador mostra os mesmos.
  3. **Rolagem e foco:** no resultado, role até um cartão e clique em **Ver parcelas**: a amortização abre **no topo**; aperte Tab: o foco começa depois do título (o próprio título não é uma parada); repita com **Voltar ao resultado**.
  4. **Só o endereço muda:** no resultado, simule um aporte: a tela **não** volta ao topo.
  5. **Formulário:** em **Nova simulação** o cursor continua no campo do nome (o foco não vai para o título).
  6. **Roteiro de erros:** (a) backend parado: as telas mostram o erro com **Tentar de novo**; (b) apague o token no meio da sessão (F12 → Application → Session Storage → apague `rota-financeira.token`) e clique em algo: volta ao login com o aviso de sessão expirada; (c) `409`: a 4ª opção (duas abas); (d) `422`: um valor fora da faixa; (e) `503` dos índices: com o backend parado ao abrir **Nova simulação** numa carga limpa, as taxas ficam à mão com **Tentar de novo**; (f) id inexistente na URL (`/simulacoes/999999/resultado`, `/simulacoes/abc/editar`): "Simulação não encontrada".
  7. **Carregamento:** na aba *Network* (limpe o cache: Ctrl+Shift+R), ao abrir só o `/login` o JavaScript carregado é bem menor que antes (perto de 760 kB) e o arquivo do resultado **só aparece** quando você abre o resultado; com *Slow 3G*, a primeira abertura do resultado mostra o **esqueleto** e depois a tela.
  8. **Falha do pacote:** em *Network* → *Request blocking*, bloqueie `*Resultado*` e abra o resultado: aparece o erro com **Tentar de novo** (nunca tela em branco); tire o bloqueio e clique: a tela carrega.
  9. **Teclado:** Tab e Shift+Tab percorrem a tela em ordem lógica, com foco visível em botões, campos e links; nos diálogos (excluir, adicionar opção) o foco fica preso e o Esc fecha.
  10. **Aviso "Dados do cache":** (só se o backend estiver com o BACEN fora do ar, o que é raro) o texto do aviso é legível; não bloqueia a entrega se você não conseguir provocar.
- Validar: você me diz o resultado de cada item; qualquer falha vira correção antes da T16. (O erro de renderização forçado é conferido por mim na T14, pois não há um botão para provocá-lo.)

**T16 · Claude · Registrar a conclusão da etapa**
- Arquivos: `CLAUDE.md`, `plano.md` (Etapa 8), esta spec.
- O que muda: `CLAUDE.md` (estrutura com `estilos.js`, `textosDeErro.js`, `ErrorBoundary`, `ErroInesperado`, `MudancaDeRota`, `useTituloDaPagina`, `CarregandoTela`; convenções da etapa: camada única de erros, títulos, rolagem e foco ao navegar, fronteiras de erro em duas camadas, divisão por rota e a exceção à regra "sem classes" para a fronteira; contraste como regra do tema; lições de teste; contagem de testes, tamanho do pacote inicial e total; resíduos); `plano.md` marca a Etapa 8 como concluída com notas (achados da auditoria, decisões, desvios); a spec passa a "Concluída" com os critérios marcados e o registro da execução.
- Validar: releitura dos três arquivos; `git status --ignored --short` e `git check-ignore -v` nas pastas com arquivos novos confirmam que **nada** foi ignorado por engano e que nada proibido (`node_modules/`, `dist/`, `.env`, `CLAUDE.md`, `api/`) é publicável.

**T17 · Você · Commit e push**
- Arquivos: `.git/` (histórico).
- O que muda: você commita e publica. Sugestão: `git add .`, `git status`, `git commit` e `git push` (inclui a última linha da spec da Etapa 7, ainda não commitada).
- Validar: `git status` limpo; push sem erro.

**T18 · Claude · Confirmar a publicação, do zero**
- Arquivos: nenhum.
- O que muda: só verificação; clono o repositório público numa pasta limpa (a pasta temporária é apagada ao fim).
- Validar: o número de arquivos rastreados no GitHub bate com o do disco; `npm ci`, `npm ls`, `lint` (0 avisos), `npm test` e `npm run build` verdes no clone; a listagem do GitHub tem `src/components/ErrorBoundary.jsx`, `src/components/MudancaDeRota.jsx`, `src/hooks/useTituloDaPagina.js` e `src/utils/textosDeErro.js`, e não tem `node_modules`, `dist`, `.env`, `CLAUDE.md`, `api` nem `.claude`.

### Mapa dos critérios de aceite
| Critério | Tarefas |
|---|---|
| `lint`, `test` e `build` verdes; nenhuma dependência nova e nenhum ícone novo | T13, T18 |
| Auditoria em Chrome: zero rolagem lateral, um título por tela, tela nova no topo com foco no título, sem erro de console | T1, T4, T5, T6, T7, T14, T15 |
| Erro de renderização mostra a tela amigável (sem stack, sem tela em branco) e o app continua utilizável | T8, T9, T14 |
| Textos de erro numa camada só, em português, sem corpo cru, com testes de todos os códigos | T3, T12 |
| Contraste ≥ 4,5:1 (texto) e ≥ 3:1 (gráfico), com teste | T2 |
| Pacote inicial de cerca de 763 kB; telas sob demanda com esqueleto e falha tratada | T10, T14, T15 |
| Roteiro manual de erros em desktop e em celular | T14, T15 |
| Textos revisados, `index.html` com descrição e cor do tema, nenhum `console.log`/`debugger`/`dangerouslySetInnerHTML`/`eval` | T4, T11, T13 |
| `CLAUDE.md` e `plano.md` atualizados | T16 |

### Riscos
- **Foco no título quando o título só aparece depois dos dados:** o `h1` das telas de dados surge depois do carregamento (o esqueleto vem antes); o `MudancaDeRota` espera por ele por um tempo curto e desiste sem erro. A T6 testa com a resposta atrasada por comporta, e a T14 confere no Chrome.
- **Não roubar o foco de um campo ou diálogo:** formulários abrem com `autoFocus` e os diálogos prendem o foco; a regra é "só move o foco se ele estiver no `body` ou num elemento que sumiu". A T6 prova os três casos e a T15 confere no navegador.
- **Modo estrito do React:** o efeito roda duas vezes em desenvolvimento; o componente precisa ser idempotente (rolar ao topo duas vezes não faz mal, e o foco só é movido uma vez). A T6 testa dentro de `StrictMode`.
- **A fronteira é uma classe:** o React só aceita fronteiras de erro como classe, o que quebra a regra "sem classes" do projeto; é uma exceção única e documentada (T8 e T16).
- **`console.error` e a trava dos testes:** o React e a fronteira registram o erro capturado, e a trava dos testes falha qualquer `console.error`; os testes da fronteira silenciam o registro de propósito e conferem o que foi registrado.
- **Pacote que falha em carregar não se recupera sozinho:** `React.lazy` guarda a promessa rejeitada, então reiniciar a fronteira não basta; para esse erro o **Tentar de novo** recarrega a página (T8), e só por clique da pessoa (nunca automático, para não gerar laço de recarga).
- **Divisão do código e os testes de rota:** as rotas sob demanda passam a ser assíncronas; os testes esperam a tela aparecer (`findBy`) e o `App.test` é ajustado sem relaxar nenhuma verificação (T10).
- **Contraste mais escuro e o gráfico:** o `warning.dark` também pinta uma linha do gráfico e os juros; o teste exige ≥ 3 para gráfico e a T15 confere que continuam distinguíveis das outras cores e dos traços.
- **Textos que os testes repetem:** a revisão dos textos (T11) pode mudar um texto usado em vários testes; cada mudança é feita com os testes ajustados na mesma tarefa.
- **Tamanho:** 18 tarefas; a T6 (rolagem e foco) e a T10 (divisão por rota) são as maiores. Se preferir, executo por bloco e paro para a sua revisão ao fim de cada um.

### Registro da execução (2026-09-27)
- **Resultado:** 1591 testes em 72 arquivos (estáveis em 3 execuções seguidas, ~43 s cada), `lint` sem avisos, `build` de produção com o carregamento inicial em **~768,8 kB** (~244,7 kB gzip: `index-*.js` + o chunk `SimulacaoNaoEncontrada-*.js` pré-carregado), contra 1.162 kB antes — queda de 34%, dentro do "cerca de 763 kB" da spec; os mesmos 5 ícones; nenhuma dependência nova (`git diff HEAD -- package.json package-lock.json` vazio); só `api/api.js` (e `mocks/chamar.js`, de teste) chamam `fetch`; nenhum `console.log`/`debugger`/`dangerouslySetInnerHTML`/`eval`, só o `console.error` da fronteira; `dist/` sem dado de teste.
- **Desvios do plano:** (1) a T6 precisou de um ajuste real no meio do caminho: a primeira versão do `MudancaDeRota` tratava "qualquer coisa que não seja o `body`" como foco já decidido, o que impedia o foco de ir ao `h1` depois de um clique num link (o próprio link fica focado, comportamento nativo do navegador) — corrigido com a checagem por `<main>`/`[role="dialog"]` descrita na proposta; (2) dois testes do `MudancaDeRota` tinham suposições erradas sobre o comportamento real de Tab/foco no jsdom (achavam que o Tab "voltava ao primeiro link"; na verdade sai do documento, pois o `h1` é o último item tabulável) e foram corrigidos para refletir o comportamento correto, não a suposição; (3) o stub de `window.scrollTo` é **global** (`setupTests.js`, protegido para o ambiente `node` dos testes de handlers) em vez de local por arquivo, já que qualquer teste com `<App />` pode disparar uma troca de rota via redirecionamento; (4) a divisão por rota (T10) foi testada com um harness (`React.lazy` controlado por uma "comporta" sobre o `Layout`/`ErrorBoundary`/`Suspense` reais) em vez de mockar `pages/Resultado.jsx`, pois mockar o módulo real exigiria `vi.resetModules()`, que quebraria o contexto do `AuthProvider` já carregado pelos outros testes do mesmo arquivo; (5) o `Stack` do MUI 9.4 não aceita mais `justifyContent`/`flexWrap` como prop direta (viram atributo DOM inválido): tiveram que ir em `sx`; (6) `window.location.reload` é não configurável no jsdom — o teste substitui `window.location` inteiro via `vi.stubGlobal`.
- **Bugs achados pelos testes:** o de foco descrito acima (item 1 dos desvios) foi o único bug de comportamento real; o resto foram fragilidades de teste (suposições erradas sobre Tab, prop inválida do MUI, API do jsdom).
- **Verificação automática em Chrome headless (T14):** script próprio com `puppeteer-core` (instalado à parte, fora do repositório, `--no-save`, apontando para o Chromium do sistema — nenhuma dependência nova no projeto), com uma conta descartável e uma simulação com 2 opções de financiamento. Resultados: zero rolagem lateral em 9 telas × 4 larguras (320/375/768/1280 px); 9 títulos de aba distintos; Resultado → Ver parcelas e Amortização → Voltar ao resultado rolam ao topo (`scrollY: 0`) e focam o `h1`; simular um aporte não rola nem move o foco (o foco sai do `h1` para o campo digitado, sem voltar); um erro de renderização forçado (interceptando a API real com um JSON malformado, com o cabeçalho de CORS) mostra "Algo deu errado nesta tela" com a barra e o Sair funcionando, "Tentar de novo" e "Voltar ao histórico", e o console mostra só a mensagem do erro (sem stack) vinda da fronteira; bloquear o arquivo do pacote do resultado mostra "Tentar de novo"; o JS do `/login` (modo `dev`, não empacotado) ficou em 152.720 bytes, e os módulos do resultado (`useResultado.js`, `resultado.js`, `serieDoGrafico.js` etc.) só chegam ao abrir a rota. Nenhum erro de console do app fora do esperado (só um 409 de uma tentativa de reaproveitar uma conta já registrada).
- **Lições da auditoria automatizada:** (1) interceptar uma resposta por *substring* do caminho intercepta também a navegação da própria SPA (mesma porta 5173 do `dev`): é preciso checar a origem completa (`http://localhost:5000/api/...`), senão o "erro de renderização forçado" na verdade substitui a página inteira pelo JSON cru; (2) uma resposta interceptada sem o cabeçalho `Access-Control-Allow-Origin` é bloqueada pelo navegador (vira erro de REDE, não o erro de renderização que se queria forçar); (3) `page.locator().click()` do Puppeteer se mostrou instável neste ambiente (headless, sandbox) para alguns botões do MUI (a checagem de "acionável" nunca se satisfazia): a solução foi clicar via DOM direto (`element.click()` num `page.evaluate`), como um usuário faria; (4) campos que já vêm preenchidos (o e-mail depois do registro, `valorEntrada` com "0,00" por padrão) precisam de "selecionar tudo" antes de digitar, senão o texto novo se soma ao que já está lá.
- **Verificação no navegador (T15, pelo autor):** todos os itens do roteiro funcionaram (celular sem rolagem lateral, título da aba por tela, rolagem e foco ao navegar entre resultado e amortização, o aporte sem rolar nem mover o foco, o campo do nome mantendo o foco em Nova simulação, o roteiro completo de erros — backend parado, token apagado, 409, 422, 503 dos índices, id inexistente —, navegação por teclado e diálogos, e o aviso "Dados do cache").
- **Resíduos:** durante a depuração do próprio script de auditoria (seletores incorretos, condições de corrida em cliques, um campo obrigatório não preenchido), algumas contas `sonda-...@example.com` descartáveis foram criadas e abandonadas sem chegar a ter uma simulação; a conta usada na auditoria final foi limpa manualmente ao fim (confirmado: 0 simulações). O backend não exclui usuários. Um deslize: a senha da primeira conta descartável foi impressa no terminal por engano ao gerar as credenciais (deveria nunca ser impressa); corrigido nas gerações seguintes.
- **Publicação (T17):** pendente, com você.

---
*Concluída (T1 a T16, com a T15 verificada por você). Falta só a T17 (commit e push, com você).*
