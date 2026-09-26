// Servidor MSW para os testes (Node). Sem handlers por padrão: cada teste registra os seus com
// servidor.use(...), ou usa os handlers do contrato (src/mocks/handlers). Nada vai à rede real.
import { setupServer } from 'msw/node'

export const servidor = setupServer()
