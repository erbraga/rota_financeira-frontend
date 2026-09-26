// Validação de corpo dos mocks, no espírito do backend (campos obrigatórios, faixas, casas decimais,
// campos desconhecidos rejeitados). As mensagens são aproximações das reais.
import { respostaErro } from './erros.js'

const ID_MAXIMO = 2_147_483_647

// Id de rota inválido ou fora do INTEGER do banco vira null (o handler responde 404, como o backend).
export function lerId(texto) {
  if (!/^\d+$/.test(String(texto))) return null
  const id = Number(texto)
  return id >= 1 && id <= ID_MAXIMO ? id : null
}

// Devolve { corpo } ou { resposta } (415/400).
export async function lerCorpo(request) {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) {
    return { resposta: respostaErro(415, 'O corpo da requisição deve ser JSON (Content-Type: application/json)') }
  }
  let corpo
  try {
    corpo = await request.json()
  } catch {
    return { resposta: respostaErro(400, 'JSON inválido') }
  }
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return { resposta: respostaErro(400, 'O corpo da requisição deve ser um objeto JSON') }
  }
  return { corpo }
}

function casasDecimais(valor) {
  const texto = String(valor)
  return texto.includes('.') ? texto.split('.')[1].length : 0
}

const ehNumerico = (valor) =>
  (typeof valor === 'number' && Number.isFinite(valor)) ||
  (typeof valor === 'string' && /^-?\d+(\.\d+)?$/.test(valor.trim()))

// Cada regra: { campo, tipo: 'texto'|'numero'|'inteiro'|'sistema'|'email', obrigatorio, min, max, casas, padrao }.
// Devolve { dados, detalhes } (detalhes = { campo: [mensagens] }, vazio se tudo certo).
export function validar(corpo, regras) {
  const detalhes = {}
  const dados = {}
  const conhecidos = new Set(regras.map((r) => r.campo))

  for (const campo of Object.keys(corpo)) {
    if (!conhecidos.has(campo)) detalhes[campo] = ['Campo desconhecido.']
  }

  for (const regra of regras) {
    const { campo, tipo, obrigatorio = false, min, max, casas, padrao } = regra
    const valor = corpo[campo]
    const mensagem = (texto) => {
      detalhes[campo] = [texto]
    }

    if (valor === undefined || valor === null) {
      if (obrigatorio) mensagem('Campo obrigatório.')
      else if (padrao !== undefined) dados[campo] = padrao
      continue
    }

    if (tipo === 'texto' || tipo === 'email') {
      if (typeof valor !== 'string') mensagem('Deve ser um texto.')
      else if (valor.trim().length < min || valor.trim().length > max) {
        mensagem(`Deve ter entre ${min} e ${max} caracteres.`)
      } else if (tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())) {
        mensagem('E-mail inválido.')
      } else dados[campo] = valor.trim()
    } else if (tipo === 'sistema') {
      const maiusculo = typeof valor === 'string' ? valor.trim().toUpperCase() : ''
      if (maiusculo === 'PRICE' || maiusculo === 'SAC') dados[campo] = maiusculo
      else mensagem('O sistema de amortização deve ser PRICE ou SAC.')
    } else if (!ehNumerico(valor)) {
      mensagem('Deve ser um número.')
    } else {
      const numero = Number(valor)
      if (tipo === 'inteiro' && !Number.isInteger(numero)) mensagem('Deve ser um número inteiro.')
      else if (numero < min || numero > max) mensagem(`Deve estar entre ${min} e ${max}.`)
      else if (casas !== undefined && casasDecimais(valor) > casas) {
        mensagem(`Use no máximo ${casas} casas decimais.`)
      } else dados[campo] = numero
    }
  }

  return { dados, detalhes }
}

export const regrasRegistro = [
  { campo: 'nome', tipo: 'texto', obrigatorio: true, min: 2, max: 120 },
  { campo: 'email', tipo: 'email', obrigatorio: true, min: 3, max: 254 },
  { campo: 'senha', tipo: 'texto', obrigatorio: true, min: 8, max: 128 },
]

export const regrasSimulacao = [
  { campo: 'nome', tipo: 'texto', obrigatorio: true, min: 1, max: 120 },
  { campo: 'valor_veiculo', tipo: 'numero', obrigatorio: true, min: 0.01, max: 9999999, casas: 2 },
  { campo: 'valor_entrada', tipo: 'numero', min: 0, max: 9999999, casas: 2, padrao: 0 },
  { campo: 'taxa_ipca_projetada', tipo: 'numero', obrigatorio: true, min: -20, max: 100, casas: 6 },
  { campo: 'taxa_fundo_rendimento', tipo: 'numero', obrigatorio: true, min: 0, max: 100, casas: 6 },
  { campo: 'prazo_meses_fundo', tipo: 'inteiro', obrigatorio: true, min: 1, max: 60 },
]

export const regrasFinanciamento = [
  { campo: 'nome', tipo: 'texto', obrigatorio: true, min: 1, max: 120 },
  { campo: 'taxa_juros_mensal', tipo: 'numero', obrigatorio: true, min: 0, max: 20, casas: 6 },
  { campo: 'prazo_meses', tipo: 'inteiro', obrigatorio: true, min: 1, max: 72 },
  { campo: 'sistema_amortizacao', tipo: 'sistema', obrigatorio: true },
  { campo: 'valor_entrada', tipo: 'numero', min: 0, max: 9999999, casas: 2, padrao: 0 },
]
