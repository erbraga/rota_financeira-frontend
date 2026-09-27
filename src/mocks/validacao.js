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
      // aparar: false preserva espaços (senha). mensagem/mensagemLongo/mensagemFormato imitam as do backend.
      const texto = typeof valor === 'string' && regra.aparar !== false ? valor.trim() : valor
      if (typeof valor !== 'string') {
        mensagem(tipo === 'email' ? (regra.mensagemFormato ?? 'E-mail inválido.') : 'Deve ser um texto.')
      } else if (texto.length > max && regra.mensagemLongo) {
        mensagem(regra.mensagemLongo)
      } else if (texto.length < min || texto.length > max) {
        mensagem(regra.mensagem ?? `Deve ter entre ${min} e ${max} caracteres.`)
      } else if (tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)) {
        mensagem(regra.mensagemFormato ?? 'E-mail inválido.')
      } else dados[campo] = texto
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

// Mensagens iguais às do backend real (conferidas em 2026-09-26).
const EMAIL = {
  campo: 'email',
  tipo: 'email',
  obrigatorio: true,
  min: 1,
  max: 254,
  mensagem: 'E-mail inválido.',
  mensagemLongo: 'O e-mail deve ter até 254 caracteres.',
}

export const regrasRegistro = [
  { campo: 'nome', tipo: 'texto', obrigatorio: true, min: 2, max: 120, mensagem: 'O nome deve ter entre 2 e 120 caracteres.' },
  EMAIL,
  {
    campo: 'senha',
    tipo: 'texto',
    obrigatorio: true,
    aparar: false,
    min: 8,
    max: 128,
    mensagem: 'A senha deve ter entre 8 e 128 caracteres.',
  },
]

// O login valida o formato do e-mail (como o backend) e só exige a senha (1 a 128 caracteres).
export const regrasLogin = [
  EMAIL,
  {
    campo: 'senha',
    tipo: 'texto',
    obrigatorio: true,
    aparar: false,
    min: 1,
    max: 128,
    mensagem: 'A senha deve ter de 1 a 128 caracteres.',
  },
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
