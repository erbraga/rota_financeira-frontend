// Prepara as séries do /resultado para o gráfico: só REFORMATA (achata o `saldo_devedor` por opção) e descreve em texto;
// nenhum valor é calculado, preenchido nem arredondado. Um `null` da API continua `null` (a série terminou ali): trocá-lo
// por 0 faria a linha "cair" a zero e mentiria sobre o saldo.
import { formatarMes, formatarMoeda } from './formatar.js'

export const CHAVE_PRECO = 'preco'
export const CHAVE_FUNDO = 'fundo'
export const chaveDoFinanciamento = (id) => `fin_${id}`

export const NOME_DO_PRECO = 'Preço do carro corrigido (IPCA)'
export const NOME_DO_FUNDO = 'Saldo do fundo'

// As linhas do gráfico, na ordem da legenda: um saldo devedor por financiamento (ordem de criação), o fundo e o preço.
// `id` é o da opção (para o nome no tooltip e na legenda); as chaves dos dados são texto.
export function montarLinhas(financiamentos) {
  return [
    ...financiamentos.map((f) => ({ chave: chaveDoFinanciamento(f.id), nome: f.nome, tipo: 'financiamento', id: f.id })),
    { chave: CHAVE_FUNDO, nome: NOME_DO_FUNDO, tipo: 'fundo' },
    { chave: CHAVE_PRECO, nome: NOME_DO_PRECO, tipo: 'preco' },
  ]
}

// series do /resultado -> pontos planos { mes, preco, fundo, fin_<id> } (mesmo eixo de meses, mesmos null).
export function montarDados(series) {
  return series.map((ponto) => ({
    mes: ponto.mes,
    [CHAVE_PRECO]: ponto.preco_corrigido,
    [CHAVE_FUNDO]: ponto.saldo_fundo,
    ...Object.fromEntries(Object.entries(ponto.saldo_devedor).map(([id, valor]) => [chaveDoFinanciamento(id), valor])),
  }))
}

// O primeiro e o último ponto COM valor de uma linha (o último mês em que a série existe; `null` é onde ela terminou).
function extremos(dados, chave) {
  const comValor = dados.filter((ponto) => ponto[chave] !== null && ponto[chave] !== undefined)
  return comValor.length === 0 ? null : { primeiro: comValor[0], ultimo: comValor.at(-1) }
}

// O resumo em texto do gráfico, uma frase por linha ("Saldo do fundo: R$ 20.000,00 no mês 0 e R$ 108.410,82 no mês 36").
// Só lê valores da série (nenhuma conta): serve ao leitor de tela, que não enxerga o desenho.
export function resumoDoGrafico(dados, linhas) {
  const frases = []
  for (const { chave, nome } of linhas) {
    const pontos = extremos(dados, chave)
    if (!pontos) continue
    const { primeiro, ultimo } = pontos
    frases.push(
      primeiro.mes === ultimo.mes
        ? `${nome}: ${formatarMoeda(primeiro[chave])} no ${formatarMes(primeiro.mes)}.`
        : `${nome}: ${formatarMoeda(primeiro[chave])} no ${formatarMes(primeiro.mes)} e ${formatarMoeda(ultimo[chave])} no ${formatarMes(ultimo.mes)}.`,
    )
  }
  return frases
}
