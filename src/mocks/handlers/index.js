// Handlers do contrato da API. Os testes os ativam com servidor.use(...handlers) e podem sobrescrever
// qualquer rota com servidor.use(http.get(...)) para simular um erro específico.
import { handlersAuth } from './auth.js'
import { handlersFinanciamentos } from './financiamentos.js'
import { handlersIndices } from './indices.js'
import { handlersParcelas } from './parcelas.js'
import { handlersResultado } from './resultado.js'
import { handlersSaude } from './saude.js'
import { handlersSimulacoes } from './simulacoes.js'

export const handlers = [
  ...handlersSaude,
  ...handlersAuth,
  ...handlersSimulacoes,
  ...handlersFinanciamentos,
  ...handlersResultado,
  ...handlersParcelas,
  ...handlersIndices,
]
