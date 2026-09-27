import { useMutation, useQueryClient } from '@tanstack/react-query'
import { atualizar } from '../api/simulacoes.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// Salvar alterações (PUT /simulacoes/:id, corpo completo). O detalhe passa a ser o que o servidor devolveu e a lista
// é invalidada (só ela, com exact). Sem repetição.
export function useAtualizarSimulacao(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (corpo) => atualizar(id, corpo),
    onSuccess: (atualizada) => {
      queryClient.setQueryData(chavesSimulacoes.detalhe(id), atualizada)
      return queryClient.invalidateQueries({ queryKey: chavesSimulacoes.lista, exact: true })
    },
  })
}
