// Política de repetição e cache do React Query, ajustada a esta API.
import { QueryClient } from '@tanstack/react-query'
import { ehErroApi, ehErroRede } from './api/erros.js'

// Usada como "retry" das consultas. quantasFalhas começa em 0 na primeira falha.
// Erros 4xx (incluindo 401) nunca melhoram ao repetir; falhas de rede e 5xx podem ser passageiras,
// então há no máximo 1 repetição. Qualquer outro erro (bug, cancelamento) não é repetido.
export function deveRepetir(quantasFalhas, erro) {
  if (quantasFalhas >= 1) return false
  if (ehErroApi(erro)) return erro.status >= 500
  return ehErroRede(erro)
}

// padroes permite ajustar as consultas (os testes usam { retry: false, retryDelay: 0 }).
export function criarQueryClient(padroes = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: deveRepetir,
        staleTime: 30_000,
        // Os dados só mudam por ação do próprio usuário: recarregar ao voltar o foco seria tráfego à toa.
        refetchOnWindowFocus: false,
        ...padroes,
      },
      mutations: { retry: false },
    },
  })
}

// Instância única da aplicação.
export const queryClient = criarQueryClient()
