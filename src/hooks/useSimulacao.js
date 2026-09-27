import { useQuery } from '@tanstack/react-query'
import { obter } from '../api/simulacoes.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// Uma simulação (sem as opções de financiamento). Só busca quando há id.
export function useSimulacao(id) {
  return useQuery({
    queryKey: chavesSimulacoes.detalhe(id),
    queryFn: ({ signal }) => obter(id, { signal }),
    enabled: id !== undefined && id !== null && id !== '',
  })
}
