import { useMutation, useQueryClient } from '@tanstack/react-query'
import { criarFinanciamento } from '../api/financiamentos.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// Criar uma opção (POST /simulacoes/:id/financiamentos). Acrescenta a opção que o servidor devolveu à lista em cache
// (sem novo GET) e invalida o resultado da simulação, que depende das opções (a chave só tem dados a partir da Etapa 6).
// Sem repetição: 409 (limite de 3) e 422 não melhoram ao repetir, e um POST repetido poderia duplicar a opção.
// Quem chama trata o 409 (atualiza a lista, que ficou desatualizada).
export function useCriarFinanciamento(simulacaoId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (corpo) => criarFinanciamento(simulacaoId, corpo),
    onSuccess: (nova) => {
      queryClient.setQueryData(chavesSimulacoes.financiamentos(simulacaoId), (lista) =>
        lista ? { itens: [...lista.itens, nova], total: lista.total + 1 } : lista,
      )
      return queryClient.invalidateQueries({ queryKey: chavesSimulacoes.resultado(simulacaoId) })
    },
  })
}
