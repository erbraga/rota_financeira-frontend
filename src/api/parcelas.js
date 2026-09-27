// A tabela de amortização de uma opção de financiamento, pela API do backend. A SPA NÃO recalcula nada: só exibe o que vem daqui.
import { get } from './api.js'

// Devolve { financiamento, parcelas, totais }:
//  - financiamento: id, nome, prazo_meses, sistema_amortizacao, taxa_juros_mensal (% a.m.), valor_entrada e valor_financiado;
//  - parcelas: UMA linha por mês, de 1 ao prazo, { numero, valor_parcela, juros, amortizacao, saldo_devedor } (o saldo é o
//    de DEPOIS do pagamento); parcelas de 0,00 vêm como estão (centavos ou quitação antecipada por arredondamento);
//  - totais: { total_pago, total_juros, custo_total }, iguais aos do /resultado.
// 404: a simulação não existe ou é de outra pessoa; ou a opção não existe ou é de outra simulação (mensagens diferentes,
// a tela mostra o mesmo estado). O backend ignora parâmetros de consulta.
export const obterParcelas = (simulacaoId, financiamentoId, { signal } = {}) =>
  get(`/simulacoes/${simulacaoId}/financiamentos/${financiamentoId}/parcelas`, { signal })
