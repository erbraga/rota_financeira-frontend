// Funções de API de autenticação, finas, sobre o client HTTP.
import { get, post } from './api.js'

// Cria a conta. Devolve o usuário (201, sem token). Erros: 409 (e-mail já cadastrado) e 422 (dados inválidos).
// semAutenticacao: registro e login nunca enviam token e o 401 do login NÃO é "sessão expirada".
export const registrar = (dados) => post('/auth/registrar', dados, { semAutenticacao: true })

// Devolve { access_token, token_type, expires_in, usuario }. Erros: 401 (credenciais inválidas) e 422.
export const login = (dados) => post('/auth/login', dados, { semAutenticacao: true })

// Usuário dono do token. Um 401 aqui é sessão expirada (o client chama o aoExpirar da sessão).
export const obterPerfil = ({ signal } = {}) => get('/auth/perfil', { signal })
