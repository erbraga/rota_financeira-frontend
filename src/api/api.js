// Client HTTP centralizado. É o único módulo que conhece a URL da API, o token e o tratamento de 401.
import { lerConfig } from '../config.js'
import { ErroApi, ErroRede } from './erros.js'

// O backend espera até 8 s pelo Banco Central (índices); 15 s cobre isso com folga.
export const TIMEOUT_PADRAO_MS = 15_000

// Mensagens usadas só quando o servidor não devolve o JSON { erro } esperado (ex.: página de erro de um proxy).
const MENSAGENS_GENERICAS = {
  400: 'Requisição inválida.',
  401: 'Sessão inválida ou expirada.',
  403: 'Acesso negado.',
  404: 'Recurso não encontrado.',
  409: 'A operação conflita com o estado atual.',
  415: 'Formato de requisição não aceito.',
  422: 'Dados inválidos.',
  500: 'Erro interno do servidor.',
  502: 'Servidor indisponível no momento.',
  503: 'Servidor indisponível no momento.',
  504: 'Servidor indisponível no momento.',
}

function mensagemGenerica(status) {
  return (
    MENSAGENS_GENERICAS[status] ??
    (status >= 500
      ? 'Erro no servidor. Tente novamente mais tarde.'
      : 'Não foi possível concluir a requisição.')
  )
}

// Interpreta o texto do corpo como JSON; devolve undefined se estiver vazio ou não for JSON válido.
function lerJson(texto) {
  if (texto === '') return undefined
  try {
    return JSON.parse(texto)
  } catch {
    return undefined
  }
}

function ehObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
}

let sessao = { obterToken: () => null, aoExpirar: () => {} }

// O AuthProvider (Etapa 2) registra aqui como obter o token e o que fazer quando a sessão expirar.
// O client não importa o contexto de autenticação.
export function configurarSessao({ obterToken, aoExpirar } = {}) {
  sessao = {
    obterToken: obterToken ?? (() => null),
    aoExpirar: aoExpirar ?? (() => {}),
  }
}

// metodo: 'GET' | 'POST' | 'PUT' | 'DELETE'; caminho começa com '/' e é relativo à VITE_API_URL.
// opcoes: { corpo, semAutenticacao (login e registro), signal (cancelamento vindo do React Query), timeoutMs }
// Lança ErroApi (o servidor respondeu com erro) ou ErroRede (sem resposta ou timeout); um cancelamento
// pelo chamador mantém o AbortError original, para o React Query ignorá-lo.
export async function requisicao(
  metodo,
  caminho,
  { corpo, semAutenticacao = false, signal, timeoutMs = TIMEOUT_PADRAO_MS } = {},
) {
  const { urlApi, erro } = lerConfig()
  if (erro) throw new Error(erro)

  const cabecalhos = { Accept: 'application/json' }
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json'
  if (!semAutenticacao) {
    const token = sessao.obterToken()
    if (token) cabecalhos.Authorization = `Bearer ${token}`
  }

  const sinalTimeout = AbortSignal.timeout(timeoutMs)
  const sinal = signal ? AbortSignal.any([signal, sinalTimeout]) : sinalTimeout

  let resposta
  let texto = ''
  try {
    resposta = await fetch(`${urlApi}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: sinal,
    })
    if (resposta.status !== 204) texto = await resposta.text()
  } catch (causa) {
    if (signal?.aborted) throw causa
    throw new ErroRede({ porTimeout: sinalTimeout.aborted, causa })
  }

  if (resposta.status === 204) return null

  const dados = lerJson(texto)

  if (resposta.ok) {
    if (dados === undefined) {
      throw new ErroApi({ status: resposta.status, erro: 'Resposta inválida do servidor.' })
    }
    return dados
  }

  // 401 fora do login/registro = sessão expirada ou token inválido; no login significa "Credenciais inválidas".
  if (resposta.status === 401 && !semAutenticacao) sessao.aoExpirar()

  throw new ErroApi({
    status: resposta.status,
    erro: ehObjeto(dados) && typeof dados.erro === 'string' ? dados.erro : mensagemGenerica(resposta.status),
    detalhes: ehObjeto(dados) && ehObjeto(dados.detalhes) ? dados.detalhes : undefined,
  })
}

export const get = (caminho, opcoes) => requisicao('GET', caminho, opcoes)
export const post = (caminho, corpo, opcoes) => requisicao('POST', caminho, { ...opcoes, corpo })
export const put = (caminho, corpo, opcoes) => requisicao('PUT', caminho, { ...opcoes, corpo })
// "delete" é palavra reservada.
export const remover = (caminho, opcoes) => requisicao('DELETE', caminho, opcoes)
