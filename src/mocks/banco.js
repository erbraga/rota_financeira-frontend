// "Banco de dados" em memória dos mocks (zerado a cada teste por reiniciarBanco, chamado no setupTests.js).
// Guarda usuários, simulações e opções de financiamento, com ids sequenciais como o backend.
import simulacaoPadrao from './fixtures/simulacao.json'
import financiamentosPadrao from './fixtures/financiamentos-lista.json'

export const CRIADO_EM = '2026-01-15T10:00:00-03:00'
export const TOKEN_EXPIRADO = 'mock.expirado'

export const banco = { usuarios: [], simulacoes: [], financiamentos: [], proximo: {} }

function proximoId(colecao) {
  banco.proximo[colecao] = (banco.proximo[colecao] ?? 0) + 1
  return banco.proximo[colecao]
}

export function reiniciarBanco() {
  banco.usuarios = []
  banco.simulacoes = []
  banco.financiamentos = []
  banco.proximo = {}
}

// A senha fica em texto puro só aqui, nos mocks; a API real guarda apenas o hash.
export function criarUsuario({ nome = 'Usuário Mock', email, senha = 'senha-de-teste' } = {}) {
  const id = proximoId('usuarios')
  const usuario = { id, nome, email: email ?? `usuario${id}@example.com`, senha, criado_em: CRIADO_EM }
  banco.usuarios.push(usuario)
  return usuario
}

// O token dos mocks é "mock.<id do usuário>"; o handler o valida contra o banco.
export const tokenDe = (usuario) => `mock.${usuario.id}`

export function usuarioPublico({ id, nome, email, criado_em }) {
  return { id, nome, email, criado_em }
}

export function criarSimulacao(usuarioId, dados = {}) {
  const { id: _ignorado, ...base } = simulacaoPadrao
  const simulacao = { ...base, ...dados, id: proximoId('simulacoes'), usuario_id: usuarioId, criado_em: CRIADO_EM }
  banco.simulacoes.push(simulacao)
  return simulacao
}

export function simulacaoPublica({ usuario_id: _dono, ...simulacao }) {
  return simulacao
}

export function criarFinanciamento(simulacaoId, dados = {}) {
  const { id: _ignorado, ...base } = financiamentosPadrao.itens[0]
  const financiamento = { ...base, ...dados, id: proximoId('financiamentos'), simulacao_id: simulacaoId }
  banco.financiamentos.push(financiamento)
  return financiamento
}

export function financiamentoPublico({ simulacao_id: _simulacao, ...financiamento }) {
  return financiamento
}

// Cenário das fixtures de /resultado e /parcelas: simulação 1 com as opções 1 (Price) e 2 (SAC).
// Só reproduz esses ids num banco recém-zerado.
export function semearCenarioPadrao(usuarioId) {
  const simulacao = criarSimulacao(usuarioId)
  const [price, sac] = financiamentosPadrao.itens
  const { id: _a, ...dadosPrice } = price
  const { id: _b, ...dadosSac } = sac
  const f1 = criarFinanciamento(simulacao.id, dadosPrice)
  const f2 = criarFinanciamento(simulacao.id, dadosSac)
  return { simulacao, financiamentos: [f1, f2] }
}
