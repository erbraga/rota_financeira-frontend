import { useQuery } from '@tanstack/react-query'
import { listar } from '../api/simulacoes.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// Histórico: { itens, total }, do mais recente ao mais antigo.
export function useSimulacoes() {
  return useQuery({
    queryKey: chavesSimulacoes.lista,
    queryFn: ({ signal }) => listar({ signal }),
  })
}
