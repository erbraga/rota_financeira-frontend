import { useMutation, useQueryClient } from '@tanstack/react-query'
import { atualizarFinanciamento } from '../api/financiamentos.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// Salvar uma opção (PUT /simulacoes/:id/financiamentos/:fid, corpo completo). Troca a opção da lista em cache pela que o
// servidor devolveu (mesmo id, mesma posição, sem novo GET) e invalida o resultado. Sem repetição. Um 404 (a opção foi
// excluída em outra aba) sobe como erro: quem chama fecha o formulário e atualiza a lista.
export function useAtualizarFinanciamento(simulacaoId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, corpo }) => atualizarFinanciamento(simulacaoId, id, corpo),
    onSuccess: (atualizada) => {
      queryClient.setQueryData(chavesSimulacoes.financiamentos(simulacaoId), (lista) =>
        lista ? { ...lista, itens: lista.itens.map((f) => (f.id === atualizada.id ? atualizada : f)) } : lista,
      )
      return queryClient.invalidateQueries({ queryKey: chavesSimulacoes.resultado(simulacaoId) })
    },
  })
}
