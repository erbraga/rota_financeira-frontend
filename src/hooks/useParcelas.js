import { useQuery } from '@tanstack/react-query'
import { obterParcelas } from '../api/parcelas.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// A tabela de amortização de uma opção ({ financiamento, parcelas, totais }). Só busca quando há os dois ids. Política de
// repetição e cache: as do queryClient (503 e rede repetem uma vez; 4xx nunca; staleTime de 30 s). Editar a opção ou a
// simulação invalida este cache e excluir a opção o remove (ver os hooks de mutação).
export function useParcelas(simulacaoId, financiamentoId) {
  const presente = (valor) => valor !== undefined && valor !== null && valor !== ''
  return useQuery({
    queryKey: chavesSimulacoes.parcelas(simulacaoId, financiamentoId),
    queryFn: ({ signal }) => obterParcelas(simulacaoId, financiamentoId, { signal }),
    enabled: presente(simulacaoId) && presente(financiamentoId),
  })
}
