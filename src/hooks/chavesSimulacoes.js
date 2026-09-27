// Chaves do cache do React Query para as simulações. A lista e o detalhe compartilham o prefixo "simulacoes";
// por isso a lista é invalidada com { exact: true } (o prefixo inteiro refaria também o detalhe, à toa).
// As chaves de uma simulação (opções, resultado) começam pela do detalhe: excluir a simulação remove todas de uma vez.
export const chavesSimulacoes = {
  lista: ['simulacoes'],
  // O id da rota chega como texto e o da resposta, como número: a chave normaliza para texto.
  detalhe: (id) => ['simulacoes', String(id)],
  // Opções de financiamento de uma simulação ({ itens, total }, em ordem de criação).
  financiamentos: (id) => ['simulacoes', String(id), 'financiamentos'],
  // Resultado comparativo. Sem aporte é a chave-PREFIXO (o resultado padrão); com aporte (o "e se eu guardar X por mês?")
  // acrescenta o valor (número). Invalidar ou remover a chave sem aporte pega as duas (mesmo prefixo), que é o que se quer
  // quando uma opção ou a simulação muda; os caches do padrão e do com aporte são SEPARADOS (voltar ao padrão não refaz a chamada).
  resultado: (id, aporte) =>
    aporte === undefined || aporte === null ? ['simulacoes', String(id), 'resultado'] : ['simulacoes', String(id), 'resultado', aporte],
}
