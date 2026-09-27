import { useQuery } from '@tanstack/react-query'
import { listarFinanciamentos } from '../api/financiamentos.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// As opções de financiamento de uma simulação ({ itens, total }, em ordem de criação). Só busca quando há id.
// Política de repetição e cache: as do queryClient (503 e rede repetem uma vez; 4xx nunca).
export function useFinanciamentos(simulacaoId) {
  return useQuery({
    queryKey: chavesSimulacoes.financiamentos(simulacaoId),
    queryFn: ({ signal }) => listarFinanciamentos(simulacaoId, { signal }),
    enabled: simulacaoId !== undefined && simulacaoId !== null && simulacaoId !== '',
  })
}
