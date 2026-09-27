import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ehErroApi } from '../api/erros.js'
import { excluirFinanciamento } from '../api/financiamentos.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// Excluir uma opção (DELETE, 204). Um 404 significa que ela já tinha sido excluída em outro lugar: conta como sucesso
// ({ jaExcluida: true }), para a tela dar o aviso certo. Nos dois casos tira a opção da lista em cache e invalida o
// resultado. Qualquer outro erro (rede, 5xx) sobe e NÃO mexe no cache. Sem repetição.
export function useExcluirFinanciamento(simulacaoId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      try {
        await excluirFinanciamento(simulacaoId, id)
        return { id, jaExcluida: false }
      } catch (erro) {
        if (ehErroApi(erro) && erro.status === 404) return { id, jaExcluida: true }
        throw erro
      }
    },
    onSuccess: ({ id }) => {
      queryClient.setQueryData(chavesSimulacoes.financiamentos(simulacaoId), (lista) =>
        lista ? { itens: lista.itens.filter((f) => f.id !== id), total: lista.itens.filter((f) => f.id !== id).length } : lista,
      )
      return queryClient.invalidateQueries({ queryKey: chavesSimulacoes.resultado(simulacaoId) })
    },
  })
}
