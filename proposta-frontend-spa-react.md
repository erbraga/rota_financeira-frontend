# Proposta – Parte 2: Frontend (SPA em React)

**Projeto:** Comparador de Cenários para Compra de Carros
**Parte:** Frontend, Single Page Application em React
**Parte complementar:** [Backend (API REST)](proposta-backend-api-rest.md)

## 1. Contexto do projeto

O projeto é uma aplicação web que ajuda o usuário a decidir **como comprar um carro**. Ela compara três cenários financeiros com dados econômicos reais do Banco Central:

1. Compra à vista.
2. Compra financiada, com 2 ou 3 opções de financiamento.
3. Compra à vista no futuro, acumulando o valor em um fundo de investimento.

Quem vai comprar um carro costuma comparar só o valor da parcela. Ele deixa de considerar o custo total dos juros, a alta do preço do carro (inflação) enquanto junta dinheiro e o rendimento do dinheiro guardado. A aplicação reúne esses cálculos em um só lugar e mostra o resultado de forma visual.

### 1.1 Decisão de arquitetura

O sistema é implementado em **duas partes independentes**, que se comunicam apenas por HTTP/JSON:

| Parte | Responsabilidade | Documento |
|---|---|---|
| **Backend** | Regras de negócio, cálculos financeiros, persistência, autenticação, integração com o BACEN | `proposta-backend-api-rest.md` |
| **Frontend (este documento)** | Interface do usuário (SPA), formulários, gráficos e consumo da API | `proposta-frontend-spa-react.md` |

O frontend é uma **SPA** servida como arquivos estáticos. Ela não acessa banco de dados nem o Banco Central: toda informação vem da API REST do backend, e **os cálculos financeiros são feitos no backend**. O frontend coleta parâmetros, envia à API e apresenta os resultados. O **contrato entre as duas partes é a especificação OpenAPI** publicada pelo backend em `/apidocs/`.

## 2. Objetivos do frontend

- Oferecer cadastro, login e navegação protegida por autenticação.
- Permitir criar e editar simulações e suas 2 ou 3 opções de financiamento, com validação dos campos.
- Preencher automaticamente as taxas sugeridas (IPCA, CDI) vindas da API, permitindo que o usuário as sobrescreva.
- Exibir a comparação entre os três cenários, com gráficos e tabela de amortização.
- Listar o histórico de simulações para revisitar, editar ou excluir.
- Tratar de forma clara os estados de carregamento, erro e sessão expirada.

## 3. Escopo

### 3.1 Incluído

- Telas de registro e login.
- Lista de simulações (histórico).
- Formulário de simulação (dados do veículo, fundo e opções de financiamento).
- Tela de resultado comparativo com gráficos.
- Tela da tabela de amortização de cada opção de financiamento.
- Guarda de rotas: usuário não autenticado é redirecionado ao login.

### 3.2 Opcional, se houver tempo

- Exportação do resultado (PDF ou impressão).

### 3.3 Fora do escopo do frontend

- Cálculos de Price, SAC, fundo e correção pelo IPCA.
- Acesso direto à API do Banco Central.
- Armazenamento de dados de negócio.

## 4. Telas e fluxo de navegação

| Tela | Rota (sugestão) | Função |
|---|---|---|
| Registro | `/registrar` | Cria a conta do usuário |
| Login | `/login` | Autentica e guarda o token JWT |
| Minhas simulações | `/simulacoes` | Lista o histórico, com ações de abrir, editar e excluir |
| Nova / editar simulação | `/simulacoes/nova`, `/simulacoes/:id/editar` | Formulário com dados do veículo, fundo e opções de financiamento |
| Resultado | `/simulacoes/:id/resultado` | Comparação dos três cenários, com totais e gráficos |
| Amortização | `/simulacoes/:id/financiamentos/:fid` | Tabela mês a mês de uma opção de financiamento |

**Fluxo principal:** login → criar simulação (o formulário já vem com taxas sugeridas pela API) → adicionar 2 ou 3 opções de financiamento → ver o resultado comparativo → salvar e revisitar depois pelo histórico.

### 4.1 Formulário de simulação

- **Veículo e cenário à vista:** nome da simulação, valor do veículo e valor de entrada.
- **Fundo de acumulação:** taxa de rendimento (sugerida a partir do CDI) e prazo em meses.
- **Correção do preço:** IPCA projetado (sugerido pela API).
- **Opções de financiamento (2 ou 3):** nome, taxa de juros mensal, prazo em meses, sistema (Price ou SAC) e entrada.
- **Validação:** campos numéricos obrigatórios, valores positivos, entrada menor que o valor do veículo e prazos inteiros.

### 4.2 Tela de resultado

- **Cartões-resumo:** custo total de cada cenário, com destaque para o mais barato.
- **Gráfico comparativo de linhas:** saldo devedor de cada financiamento, saldo acumulado do fundo e valor do carro corrigido pelo IPCA ao longo dos meses.
- **Tabela de amortização** de cada financiamento (parcela, juros, amortização e saldo devedor).

## 5. Contrato de integração com o backend

O frontend depende apenas destes endpoints. Os formatos exatos de requisição e resposta seguem a especificação OpenAPI do backend.

**Todas as rotas ficam sob `/api`.** Depois do login, toda requisição leva o cabeçalho `Authorization: Bearer <token>`.

| Uso no frontend | Endpoint |
|---|---|
| Registro e login | `POST /api/auth/registrar`, `POST /api/auth/login` |
| Histórico | `GET /api/simulacoes` |
| Abrir simulação | `GET /api/simulacoes/:id` |
| Criar, editar e excluir | `POST /api/simulacoes`, `PUT /api/simulacoes/:id`, `DELETE /api/simulacoes/:id` |
| Resultado comparativo | `GET /api/simulacoes/:id/resultado` |
| Opções de financiamento | `GET` e `POST /api/simulacoes/:id/financiamentos`, `PUT` e `DELETE /api/simulacoes/:id/financiamentos/:fid` |
| Tabela de amortização | `GET /api/simulacoes/:id/financiamentos/:fid/parcelas` |
| Taxas sugeridas | `GET /api/indices/ipca` e `/cdi` |

**Convenções:**

- O backend devolve no `/resultado` os totais de cada cenário e as **séries mês a mês** que alimentam o gráfico. O frontend apenas as exibe.
- Erros de validação (`400`) são mostrados junto ao campo correspondente.
- Resposta `401` encerra a sessão e leva o usuário ao login.

### 5.1 Desenvolvimento independente

Como as partes são independentes, o frontend pode ser desenvolvido antes de o backend estar pronto:

- A partir do contrato OpenAPI, usar dados simulados (mock) das respostas, por exemplo com MSW ou `json-server`.
- Trocar para o backend real apenas mudando a variável de ambiente com a URL base da API.

## 6. Arquitetura e tecnologias

| Item | Tecnologia |
|---|---|
| Biblioteca | React (SPA), com Vite como ferramenta de build |
| Roteamento | React Router |
| Chamadas HTTP | Axios ou `fetch`, em um client centralizado (`api.js`) que injeta o token e trata `401` |
| Dados assíncronos e cache | TanStack Query (React Query), para loading, erro e cache das simulações |
| Formulários e validação | React Hook Form + Zod ou Yup |
| Gráficos | Recharts ou Chart.js |
| Estado de autenticação | Context API ou Zustand (token JWT) |

### 6.1 Estrutura de pastas (sugestão)

```
frontend/
  src/
    api/            # client HTTP centralizado e funções por recurso
    components/     # componentes reutilizáveis (campos, tabelas, gráficos)
    pages/          # telas: Login, Registro, Simulacoes, Resultado...
    hooks/          # hooks com React Query (useSimulacoes, useResultado...)
    auth/           # contexto de autenticação e rota protegida
    schemas/        # schemas de validação (Zod/Yup)
    App.jsx
    main.jsx
  .env              # VITE_API_URL=http://localhost:5000/api
```

### 6.2 Autenticação no cliente

O token JWT obtido no login fica no estado de autenticação, e o client HTTP o envia em cada requisição. O componente de rota protegida redireciona ao login quando não há token ou quando a API responde `401`. O usuário pode fazer logout a qualquer momento, e isso apaga o token.

## 7. Requisitos não funcionais

- **Usabilidade:** taxas sugeridas automaticamente e editáveis, mensagens de erro junto aos campos e valores formatados em reais e porcentagem.
- **Responsividade:** layout utilizável em desktop e celular.
- **Feedback:** indicadores de carregamento e mensagens de erro de rede claras.
- **Configuração:** URL da API definida por variável de ambiente, sem valor fixo no código.
- **Independência:** o build gera arquivos estáticos que podem ser hospedados em qualquer servidor, separado do backend.
- **CORS:** em desenvolvimento, o frontend (`localhost:5173` ou `3000`) roda em origem diferente do Flask, e o backend deve liberar essa origem.

## 8. Resultados esperados

Uma SPA em React que permite ao usuário se cadastrar, criar simulações, comparar visualmente os cenários à vista, financiado e por acumulação em fundo, e revisitar seu histórico. Ela consome apenas a API REST do backend e pode ser desenvolvida, testada e publicada de forma independente dele.

## 9. Etapas de desenvolvimento (sugestão)

Este cronograma é uma sugestão. Ajuste os prazos ao seu calendário.

1. Configuração do projeto (Vite, React Router), client HTTP e variável da URL da API.
2. Autenticação: telas de registro e login, contexto de auth e rotas protegidas.
3. Histórico de simulações e formulário de simulação, com validação.
4. Formulário das opções de financiamento e preenchimento de taxas sugeridas.
5. Tela de resultado, com gráficos comparativos e tabela de amortização.
6. Tratamento de erros, responsividade e ajustes finais.