import { useQuery } from '@tanstack/react-query'
import { obterResultado } from '../api/resultado.js'
import { chavesSimulacoes } from './chavesSimulacoes.js'

// O resultado comparativo de uma simulação, com ou sem aporte informado (aporteMensal: número ou undefined). Só busca
// quando há id. O resultado padrão e o com aporte ficam em caches SEPARADOS (chavesSimulacoes.resultado), então voltar ao
// padrão dentro do staleTime não refaz a chamada. Política de repetição: a do queryClient (503 e rede repetem uma vez; 4xx nunca).
// `enabled: false` deixa a consulta parada (usado para só buscar o resultado padrão quando ele é preciso de reserva).
// Ao trocar o aporte da MESMA simulação o resultado anterior continua na tela enquanto o novo carrega (`isPlaceholderData`),
// para os cartões e o campo do aporte não piscarem nem perderem o estado; de OUTRA simulação nunca é reaproveitado.
export function useResultado(simulacaoId, { aporteMensal, enabled = true } = {}) {
  return useQuery({
    queryKey: chavesSimulacoes.resultado(simulacaoId, aporteMensal),
    queryFn: ({ signal }) => obterResultado(simulacaoId, { aporteMensal, signal }),
    enabled: enabled && simulacaoId !== undefined && simulacaoId !== null && simulacaoId !== '',
    placeholderData: (anterior, consultaAnterior) =>
      consultaAnterior?.queryKey[1] === String(simulacaoId) ? anterior : undefined,
  })
}
