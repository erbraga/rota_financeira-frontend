// Autenticação dos mocks: reproduz os 401 do backend (ausente, inválido, expirado).
import { banco, TOKEN_EXPIRADO } from './banco.js'
import { respostaErro } from './erros.js'

// Devolve { usuario } ou { resposta } (o 401 a ser devolvido pelo handler).
export function autenticar(request) {
  const cabecalho = request.headers.get('Authorization')
  if (!cabecalho) return { resposta: respostaErro(401, 'Token de autenticação ausente') }

  const [tipo, token] = cabecalho.split(' ')
  if (tipo !== 'Bearer' || !token) return { resposta: respostaErro(401, 'Token inválido') }
  if (token === TOKEN_EXPIRADO) return { resposta: respostaErro(401, 'Token expirado') }

  const achado = /^mock\.(\d+)$/.exec(token)
  const usuario = achado && banco.usuarios.find((u) => u.id === Number(achado[1]))
  // Como no backend: token de uma conta que não existe mais também é 401.
  if (!usuario) return { resposta: respostaErro(401, 'Token inválido') }
  return { usuario }
}
