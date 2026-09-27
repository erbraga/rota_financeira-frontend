import { useMutation, useQueryClient } from '@tanstack/react-query'
import { excluir } from '../api/simulacoes.js'
import { ehErroApi } from '../api/erros.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// Excluir (DELETE /simulacoes/:id, 204). Um 404 significa que ela já tinha sido excluída em outro lugar: conta como
// sucesso ({ jaExcluida: true }), para a tela dar o aviso certo. Nos dois casos remove o detalhe do cache e invalida
// a lista. Qualquer outro erro (rede, 5xx) sobe e NÃO mexe no cache. Sem repetição.
export function useExcluirSimulacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      try {
        await excluir(id)
        return { id, jaExcluida: false }
      } catch (erro) {
        if (ehErroApi(erro) && erro.status === 404) return { id, jaExcluida: true }
        throw erro
      }
    },
    onSuccess: ({ id }) => {
      queryClient.removeQueries({ queryKey: chavesSimulacoes.detalhe(id) })
      return queryClient.invalidateQueries({ queryKey: chavesSimulacoes.lista, exact: true })
    },
  })
}
