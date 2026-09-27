// Prepara as linhas do /parcelas para o gráfico de barras empilhadas: só LÊ as colunas `juros` e `amortizacao` (nenhum valor é
// somado, arredondado nem preenchido) e descreve em texto para quem não enxerga o desenho.
import { formatarMes, formatarMoeda } from './formatar.js'

export const CHAVE_AMORTIZACAO = 'amortizacao'
export const CHAVE_JUROS = 'juros'
export const NOME_DA_AMORTIZACAO = 'Amortização'
export const NOME_DOS_JUROS = 'Juros'

// parcelas do /parcelas -> uma barra por mês { mes, amortizacao, juros } (os mesmos valores da API).
export function montarBarras(parcelas) {
  return parcelas.map((linha) => ({ mes: linha.numero, [CHAVE_AMORTIZACAO]: linha.amortizacao, [CHAVE_JUROS]: linha.juros }))
}

// "Mês 1: parcela de R$ 2.203,12, com R$ 1.125,00 de juros e R$ 1.078,12 de amortização." (só lê os campos da linha)
function frase(linha) {
  const mes = formatarMes(linha.numero)
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)}: parcela de ${formatarMoeda(linha.valor_parcela)}, com ${formatarMoeda(linha.juros)} de juros e ${formatarMoeda(linha.amortizacao)} de amortização.`
}

// O resumo em texto do gráfico: a primeira e a última parcela (uma só frase se o prazo é de 1 mês).
export function resumoDaAmortizacao(parcelas) {
  if (parcelas.length === 0) return ''
  const primeira = parcelas[0]
  const ultima = parcelas.at(-1)
  return primeira.numero === ultima.numero ? frase(primeira) : `${frase(primeira)} ${frase(ultima)}`
}
