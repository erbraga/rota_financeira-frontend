import { useMutation, useQueryClient } from '@tanstack/react-query'
import { criar } from '../api/simulacoes.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// Criar (POST /simulacoes). Guarda o detalhe da nova simulação (a edição, para onde a tela navega, já o encontra em
// cache) e invalida SÓ a lista ({ exact: true }: o prefixo inteiro refaria também o detalhe, à toa). Sem repetição.
export function useCriarSimulacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: criar,
    onSuccess: (nova) => {
      queryClient.setQueryData(chavesSimulacoes.detalhe(nova.id), nova)
      return queryClient.invalidateQueries({ queryKey: chavesSimulacoes.lista, exact: true })
    },
  })
}
