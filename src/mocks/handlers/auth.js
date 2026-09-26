import { http, HttpResponse } from 'msw'
import { lerConfig } from '../../config.js'
import { banco, criarUsuario, tokenDe, usuarioPublico } from '../banco.js'
import { dadosInvalidos, respostaErro } from '../erros.js'
import { autenticar } from '../sessao.js'
import { lerCorpo, regrasRegistro, validar } from '../validacao.js'

const { urlApi } = lerConfig()

// Como o backend: e-mail em minúsculas e sem espaços nas pontas.
const normalizar = (email) => email.trim().toLowerCase()

export const handlersAuth = [
  http.post(`${urlApi}/auth/registrar`, async ({ request }) => {
    const { corpo, resposta } = await lerCorpo(request)
    if (resposta) return resposta
    const { dados, detalhes } = validar(corpo, regrasRegistro)
    if (Object.keys(detalhes).length > 0) return dadosInvalidos(detalhes)

    const email = normalizar(dados.email)
    if (banco.usuarios.some((u) => u.email === email)) return respostaErro(409, 'E-mail já cadastrado')

    const usuario = criarUsuario({ nome: dados.nome, email, senha: dados.senha })
    return HttpResponse.json(usuarioPublico(usuario), { status: 201 })
  }),

  http.post(`${urlApi}/auth/login`, async ({ request }) => {
    const { corpo, resposta } = await lerCorpo(request)
    if (resposta) return resposta

    const detalhes = {}
    for (const campo of ['email', 'senha']) {
      if (typeof corpo[campo] !== 'string' || corpo[campo] === '') detalhes[campo] = ['Campo obrigatório.']
    }
    if (Object.keys(detalhes).length > 0) return dadosInvalidos(detalhes)

    // Igual para e-mail inexistente e senha errada.
    const usuario = banco.usuarios.find((u) => u.email === normalizar(corpo.email))
    if (!usuario || usuario.senha !== corpo.senha) return respostaErro(401, 'Credenciais inválidas')

    return HttpResponse.json({
      access_token: tokenDe(usuario),
      token_type: 'Bearer',
      expires_in: 3600,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    })
  }),

  http.get(`${urlApi}/auth/perfil`, ({ request }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    return HttpResponse.json(usuarioPublico(usuario))
  }),
]
