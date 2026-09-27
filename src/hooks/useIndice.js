import { useQuery } from '@tanstack/react-query'
import { obterIndice } from '../api/indices.js'

// O backend guarda os índices por 12 h; aqui 30 min bastam para reabrir o formulário sem nova chamada.
export const STALE_TIME_INDICE_MS = 30 * 60 * 1000

// Só a `sugestao` interessa ao formulário e não depende do período: '1m' traz uma resposta ~10x menor que a padrão (12m).
export const PERIODO_DA_SUGESTAO = '1m'

// Um índice do Banco Central ('cdi' | 'ipca') pela API do backend. Índices não são dados da pessoa: mudam devagar,
// por isso o cache longo e nenhuma nova busca ao voltar o foco (o `queryClient` já a desliga). A política de repetição
// é a do `queryClient`: 503 e falha de rede repetem uma vez; 4xx nunca.
export function useIndice(indice, { periodo = PERIODO_DA_SUGESTAO } = {}) {
  return useQuery({
    queryKey: ['indices', indice, periodo],
    queryFn: ({ signal }) => obterIndice(indice, { periodo, signal }),
    staleTime: STALE_TIME_INDICE_MS,
  })
}
