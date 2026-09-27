// Chaves do cache do React Query para as simulações. A lista e o detalhe compartilham o prefixo "simulacoes";
// por isso a lista é invalidada com { exact: true } (o prefixo inteiro refaria também o detalhe, à toa).
export const chavesSimulacoes = {
  lista: ['simulacoes'],
  // O id da rota chega como texto e o da resposta, como número: a chave normaliza para texto.
  detalhe: (id) => ['simulacoes', String(id)],
}
