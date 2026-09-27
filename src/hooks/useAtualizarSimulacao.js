import { useMutation, useQueryClient } from '@tanstack/react-query'
import { atualizar } from '../api/simulacoes.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// Salvar alterações (PUT /simulacoes/:id, corpo completo). O detalhe passa a ser o que o servidor devolveu e a lista
// é invalidada (só ela, com exact). O resultado desta simulação também (depende dos valores dela; o prefixo pega o padrão
// e o com aporte) e as parcelas de TODAS as opções dela (o valor do veículo muda o valor financiado). Sem repetição.
export function useAtualizarSimulacao(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (corpo) => atualizar(id, corpo),
    onSuccess: (atualizada) => {
      queryClient.setQueryData(chavesSimulacoes.detalhe(id), atualizada)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: chavesSimulacoes.lista, exact: true }),
        queryClient.invalidateQueries({ queryKey: chavesSimulacoes.resultado(id) }),
        queryClient.invalidateQueries({ queryKey: chavesSimulacoes.parcelas(id) }),
      ])
    },
  })
}
