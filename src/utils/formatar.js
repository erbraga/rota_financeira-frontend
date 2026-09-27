// Formatação para exibição (pt-BR). Tudo o que a API devolve já vem calculado: aqui só se formata.

// Texto mostrado quando não há valor (ex.: custo do fundo no modo de aporte informado).
export const SEM_VALOR = '—'

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
// Taxas em percentual: no mínimo 2 casas e no máximo 6 (o limite da API), sem zeros inúteis além das 2 primeiras.
const formatoPercentual = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
})

// Valores do eixo do gráfico: "R$ 100 mil", "R$ 1,2 mi" (até 1 casa; nada além do compacto do Intl).
const formatoMoedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
})

function numeroValido(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

// 1234.5 -> "R$ 1.234,50" (o espaço depois de "R$" é um espaço sem quebra, como no Intl).
export function formatarMoeda(valor) {
  const numero = numeroValido(valor)
  return numero === null ? SEM_VALOR : formatoMoeda.format(numero)
}

// A taxa já está em percentual (12.5 = 12,5%): 12.5 -> "12,50%", 0.85 -> "0,85%".
export function formatarPercentual(valor) {
  const numero = numeroValido(valor)
  return numero === null ? SEM_VALOR : `${formatoPercentual.format(numero)}%`
}

// 108410.78 -> "R$ 108,4 mil" (só para os eixos; os valores exatos usam formatarMoeda).
export function formatarMoedaCompacta(valor) {
  const numero = numeroValido(valor)
  return numero === null ? SEM_VALOR : formatoMoedaCompacta.format(numero)
}

// Prazo em meses: 1 -> "1 mês", 48 -> "48 meses".
export function formatarPrazo(meses) {
  const numero = numeroValido(meses)
  return numero === null ? SEM_VALOR : `${numero} ${numero === 1 ? 'mês' : 'meses'}`
}

// O mês de uma série ou da meta do fundo: 44 -> "mês 44" (0 = "mês 0", o momento de hoje).
export function formatarMes(mes) {
  const numero = numeroValido(mes)
  return numero === null ? SEM_VALOR : `mês ${numero}`
}

const SO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/

// Datas só com dia ("2026-09-01", como data_referencia) são lidas como data LOCAL, sem passar por Date:
// new Date("2026-09-01") é meia-noite UTC e mostraria 31/08 no Brasil.
// Datas com hora e fuso (criado_em) são exibidas no fuso do navegador.
export function formatarData(texto) {
  if (typeof texto !== 'string' || texto === '') return SEM_VALOR

  const soDia = SO_DIA.exec(texto)
  if (soDia) {
    const [, ano, mes, dia] = soDia
    const data = new Date(Number(ano), Number(mes) - 1, Number(dia))
    const existe =
      data.getFullYear() === Number(ano) &&
      data.getMonth() === Number(mes) - 1 &&
      data.getDate() === Number(dia)
    return existe ? `${dia}/${mes}/${ano}` : SEM_VALOR
  }

  const data = new Date(texto)
  if (Number.isNaN(data.getTime())) return SEM_VALOR
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data)
}

// Meses abreviados escritos aqui (e não pelo Intl, cuja abreviação varia: "ago." com ponto em algumas versões).
const MESES_ABREVIADOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// "2026-08-01" -> "ago/2026" (o IPCA é mensal). Mesma leitura de formatarData: só dia = data local; com hora e fuso,
// o fuso do navegador.
export function formatarMesAno(texto) {
  if (formatarData(texto) === SEM_VALOR) return SEM_VALOR
  const soDia = SO_DIA.exec(texto)
  const data = soDia ? new Date(Number(soDia[1]), Number(soDia[2]) - 1, Number(soDia[3])) : new Date(texto)
  return `${MESES_ABREVIADOS[data.getMonth()]}/${data.getFullYear()}`
}

export const MENSAGEM_NUMERO_INVALIDO =
  'Use vírgula para decimais (ex.: 12,5) e ponto só para milhares (ex.: 1.234,56).'

// Pontuação pt-BR estrita: o ponto só vale como separador de milhar, em grupos de exatamente 3 dígitos,
// e a vírgula é o decimal. Assim "12.5" é recusado (em vez de virar 125) e "95.000" vale 95000.
const NUMERO_PT_BR = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/

// Lê o que o usuário digitou num campo de valor ou taxa.
// Devolve { valor } (campo vazio -> valor null) ou { valor: null, erro } se o texto for inválido. Nunca arredonda.
export function lerNumero(texto) {
  if (texto === null || texto === undefined) return { valor: null }
  if (typeof texto === 'number') {
    return Number.isFinite(texto) ? { valor: texto } : { valor: null, erro: MENSAGEM_NUMERO_INVALIDO }
  }
  if (typeof texto !== 'string') return { valor: null, erro: MENSAGEM_NUMERO_INVALIDO }

  const limpo = texto.trim()
  if (limpo === '') return { valor: null }
  if (!NUMERO_PT_BR.test(limpo)) return { valor: null, erro: MENSAGEM_NUMERO_INVALIDO }

  const valor = Number(limpo.replaceAll('.', '').replace(',', '.'))
  if (!Number.isFinite(valor)) return { valor: null, erro: MENSAGEM_NUMERO_INVALIDO }
  // Evita o "-0" de entradas como "-0".
  return { valor: valor + 0 }
}

// Texto para preencher um campo de edição: vírgula decimal, sem separador de milhar (12.5 -> "12,5").
export function numeroParaCampo(valor) {
  const numero = numeroValido(valor)
  if (numero === null) return ''
  let texto = String(numero)
  // Números muito pequenos ou grandes viram notação científica em String(); o campo não a aceita.
  if (/e/i.test(texto)) texto = numero.toFixed(20).replace(/0+$/, '').replace(/\.$/, '')
  return texto.replace('.', ',')
}

const formatoDinheiroDeCampo = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Texto de um campo de DINHEIRO (sem "R$"): 95000.5 -> "95.000,50". Sempre 2 casas, com o ponto de milhar que o
// lerNumero aceita, então lerNumero(dinheiroParaCampo(n)) devolve n.
export function dinheiroParaCampo(valor) {
  const numero = numeroValido(valor)
  return numero === null ? '' : formatoDinheiroDeCampo.format(numero)
}

// Casas decimais de um número, contadas como o backend: pelo VALOR (12,5000000 tem 1 casa; 0,0000001 tem 7).
export function casasDecimais(valor) {
  const texto = numeroParaCampo(valor)
  return texto.includes(',') ? texto.split(',')[1].length : 0
}
