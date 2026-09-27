// O aporte mensal do "e se eu guardar X por mês?": validação (a mesma do campo e do endereço) e a ida e volta com o endereço
// da página (`?aporte_mensal=1500,5`: formato de campo pt-BR, sem separador de milhar). Mensagens da faixa e das casas iguais
// às do backend real (conferidas em 2026-09-27). Um valor inválido NUNCA vai ao servidor.
import { casasDecimais, lerNumero, MENSAGEM_NUMERO_INVALIDO, numeroParaCampo } from './formatar.js'

export const PARAMETRO_DO_APORTE = 'aporte_mensal'
const APORTE_MAXIMO = 9999999

export const MENSAGEM_APORTE_VAZIO = 'Informe quanto você guardaria por mês.'
export const MENSAGEM_APORTE_FAIXA = 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.'
export const MENSAGEM_APORTE_CASAS = 'Use no máximo 2 casas decimais.'
export const MENSAGEM_APORTE_REPETIDO = 'O endereço traz o aporte mais de uma vez.'

// Texto -> { valor } (número) ou { erro }. Ordem, como no backend: leitura -> faixa -> casas. Nunca arredonda.
// aceitaMilhar: false no endereço (a escrita nunca gera "1.500,50"; um ponto ali é quase sempre o decimal de outro
// formato, como "1500.5", e seria lido como milhar).
export function validarAporte(texto, { aceitaMilhar = true } = {}) {
  const limpo = typeof texto === 'string' ? texto.trim() : texto
  if (limpo === '' || limpo === null || limpo === undefined) return { erro: MENSAGEM_APORTE_VAZIO }
  const lido = lerNumero(limpo)
  if (lido.erro) return { erro: lido.erro }
  if (!aceitaMilhar && String(limpo).includes('.')) return { erro: MENSAGEM_NUMERO_INVALIDO }
  if (lido.valor < 0 || lido.valor > APORTE_MAXIMO) return { erro: MENSAGEM_APORTE_FAIXA }
  if (casasDecimais(lido.valor) > 2) return { erro: MENSAGEM_APORTE_CASAS }
  return { valor: lido.valor }
}

// URLSearchParams -> { valor: undefined } (sem parâmetro), { valor } ou { erro, texto } (o texto vai para o campo).
export function lerAporteDaUrl(parametros) {
  const valores = parametros.getAll(PARAMETRO_DO_APORTE)
  if (valores.length === 0) return { valor: undefined }
  if (valores.length > 1) return { erro: MENSAGEM_APORTE_REPETIDO, texto: valores[0] }
  const lido = validarAporte(valores[0], { aceitaMilhar: false })
  return lido.erro ? { erro: lido.erro, texto: valores[0] } : { valor: lido.valor }
}

// Número -> texto do endereço (o formato de campo, sem milhar): 1500.5 -> "1500,5".
export const aporteParaUrl = (valor) => numeroParaCampo(valor)
