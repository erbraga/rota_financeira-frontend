// Chaves do cache do React Query para as simulações. A lista e o detalhe compartilham o prefixo "simulacoes";
// por isso a lista é invalidada com { exact: true } (o prefixo inteiro refaria também o detalhe, à toa).
// As chaves de uma simulação (opções, resultado) começam pela do detalhe: excluir a simulação remove todas de uma vez.
export const chavesSimulacoes = {
  lista: ['simulacoes'],
  // O id da rota chega como texto e o da resposta, como número: a chave normaliza para texto.
  detalhe: (id) => ['simulacoes', String(id)],
  // Opções de financiamento de uma simulação ({ itens, total }, em ordem de criação).
  financiamentos: (id) => ['simulacoes', String(id), 'financiamentos'],
  // Resultado comparativo (Etapa 6): reservada aqui porque criar, editar ou excluir uma opção o invalida.
  resultado: (id) => ['simulacoes', String(id), 'resultado'],
}
