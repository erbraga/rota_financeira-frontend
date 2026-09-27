// @vitest-environment node
// Testa os handlers do contrato (saúde, auth, simulações e financiamentos) com fetch puro, para conferir
// status, cabeçalhos e corpo exatamente como o backend os devolve.
import { beforeEach, describe, expect, it } from 'vitest'
import { chamar } from '../chamar.js'
import { criarFinanciamento, criarSimulacao, criarUsuario, TOKEN_EXPIRADO, tokenDe } from '../banco.js'
import { servidor } from '../servidor.js'
import { handlers } from './index.js'

const BASE = 'http://localhost:5000/api'

const SIM = {
  nome: 'Onix 2026',
  valor_veiculo: 95000,
  valor_entrada: 20000,
  taxa_ipca_projetada: 4.5,
  taxa_fundo_rendimento: 12,
  prazo_meses_fundo: 36,
}
const FIN = {
  nome: 'Banco X 48x',
  taxa_juros_mensal: 1.5,
  prazo_meses: 48,
  sistema_amortizacao: 'PRICE',
  valor_entrada: 10000,
}

let ana
let bia
let tokenAna
let tokenBia

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com', senha: 'senha da ana' })
  bia = criarUsuario({ nome: 'Bia', email: 'bia@example.com', senha: 'senha da bia' })
  tokenAna = tokenDe(ana)
  tokenBia = tokenDe(bia)
})

describe('saúde', () => {
  it('GET /saude é pública e responde ok', async () => {
    const r = await chamar('GET', '/saude')
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual({ banco: 'ok', status: 'ok' })
  })
})

describe('registro', () => {
  it('cria a conta: 201 com o usuário, sem senha e sem token', async () => {
    const r = await chamar('POST', '/auth/registrar', {
      corpo: { nome: 'Caio Souza', email: '  CAIO@Example.com ', senha: 'uma senha longa' },
    })
    expect(r.status).toBe(201)
    expect(Object.keys(r.corpo).sort()).toEqual(['criado_em', 'email', 'id', 'nome'])
    expect(r.corpo.email).toBe('caio@example.com')
    expect(JSON.stringify(r.corpo)).not.toContain('uma senha longa')
  })

  it('e-mail repetido (mesmo com outra caixa) -> 409', async () => {
    const r = await chamar('POST', '/auth/registrar', {
      corpo: { nome: 'Outra Ana', email: 'ANA@example.com', senha: 'outra senha longa' },
    })
    expect(r.status).toBe(409)
    expect(r.corpo).toEqual({ erro: 'E-mail já cadastrado' })
  })

  it('dados inválidos -> 422 com detalhes por campo', async () => {
    const r = await chamar('POST', '/auth/registrar', { corpo: { nome: 'X', email: 'nao-e-email', senha: 'curta' } })
    expect(r.status).toBe(422)
    expect(r.corpo.erro).toBe('Dados inválidos')
    expect(Object.keys(r.corpo.detalhes).sort()).toEqual(['email', 'nome', 'senha'])
  })

  it('campos ausentes e desconhecidos -> 422', async () => {
    const r = await chamar('POST', '/auth/registrar', { corpo: { perfil: 'admin' } })
    expect(r.status).toBe(422)
    expect(r.corpo.detalhes.nome).toEqual(['Campo obrigatório.'])
    expect(r.corpo.detalhes.perfil).toEqual(['Campo desconhecido.'])
  })

  it('sem JSON -> 415; JSON quebrado -> 400', async () => {
    expect((await chamar('POST', '/auth/registrar', { bruto: 'x=1' })).status).toBe(415)
    const quebrado = await chamar('POST', '/auth/registrar', {
      bruto: '{',
      cabecalhos: { 'Content-Type': 'application/json' },
    })
    expect(quebrado.status).toBe(400)
  })
})

describe('login e perfil', () => {
  it('login correto -> 200 com token, tipo, validade e usuário (sem senha)', async () => {
    const r = await chamar('POST', '/auth/login', { corpo: { email: 'ana@example.com', senha: 'senha da ana' } })
    expect(r.status).toBe(200)
    expect(r.corpo.token_type).toBe('Bearer')
    expect(r.corpo.expires_in).toBe(3600)
    expect(r.corpo.access_token).toBe(tokenAna)
    expect(r.corpo.usuario).toEqual({ id: ana.id, nome: 'Ana', email: 'ana@example.com' })
  })

  it('e-mail inexistente e senha errada dão o MESMO 401 "Credenciais inválidas"', async () => {
    const senhaErrada = await chamar('POST', '/auth/login', { corpo: { email: 'ana@example.com', senha: 'errada' } })
    const semConta = await chamar('POST', '/auth/login', { corpo: { email: 'ninguem@example.com', senha: 'x' } })
    expect(senhaErrada.status).toBe(401)
    expect(semConta.status).toBe(401)
    expect(senhaErrada.corpo).toEqual({ erro: 'Credenciais inválidas' })
    expect(semConta.corpo).toEqual(senhaErrada.corpo)
  })

  it('login sem campos -> 422', async () => {
    const r = await chamar('POST', '/auth/login', { corpo: {} })
    expect(r.status).toBe(422)
    expect(r.corpo.detalhes).toEqual({ email: ['Campo obrigatório.'], senha: ['Campo obrigatório.'] })
  })

  it('perfil com token válido -> 200', async () => {
    const r = await chamar('GET', '/auth/perfil', { token: tokenAna })
    expect(r.status).toBe(200)
    expect(r.corpo.email).toBe('ana@example.com')
  })

  it.each([
    ['sem cabeçalho', undefined, 'Token de autenticação ausente'],
    ['token lixo', 'lixo', 'Token inválido'],
    ['token expirado', TOKEN_EXPIRADO, 'Token expirado'],
    ['conta que não existe', 'mock.9999', 'Token inválido'],
  ])('perfil com %s -> 401 com WWW-Authenticate', async (_rotulo, token, mensagem) => {
    const r = await chamar('GET', '/auth/perfil', { token })
    expect(r.status).toBe(401)
    expect(r.corpo).toEqual({ erro: mensagem })
    expect(r.cabecalhos.get('WWW-Authenticate')).toBe('Bearer')
  })
})

describe('simulações', () => {
  it('as 5 rotas exigem token (401)', async () => {
    for (const [metodo, caminho, corpo] of [
      ['GET', '/simulacoes'],
      ['POST', '/simulacoes', SIM],
      ['GET', '/simulacoes/1'],
      ['PUT', '/simulacoes/1', SIM],
      ['DELETE', '/simulacoes/1'],
    ]) {
      expect((await chamar(metodo, caminho, { corpo })).status).toBe(401)
    }
  })

  it('lista vazia no envelope { itens, total }', async () => {
    const r = await chamar('GET', '/simulacoes', { token: tokenAna })
    expect(r.corpo).toEqual({ itens: [], total: 0 })
  })

  it('POST -> 201 com Location e o objeto, sem usuario_id', async () => {
    const r = await chamar('POST', '/simulacoes', { token: tokenAna, corpo: SIM })
    expect(r.status).toBe(201)
    expect(r.cabecalhos.get('Location')).toBe(`${BASE}/simulacoes/${r.corpo.id}`)
    expect(Object.keys(r.corpo).sort()).toEqual([
      'criado_em',
      'id',
      'nome',
      'prazo_meses_fundo',
      'taxa_fundo_rendimento',
      'taxa_ipca_projetada',
      'valor_entrada',
      'valor_veiculo',
    ])
  })

  it('lista só as simulações do dono, mais recentes primeiro', async () => {
    criarSimulacao(ana.id, { nome: 'A1' })
    criarSimulacao(bia.id, { nome: 'B1' })
    criarSimulacao(ana.id, { nome: 'A2' })
    const r = await chamar('GET', '/simulacoes', { token: tokenAna })
    expect(r.corpo.itens.map((s) => s.nome)).toEqual(['A2', 'A1'])
    expect(r.corpo.total).toBe(2)
  })

  it('simulação de outro usuário e inexistente dão o MESMO 404 (não vaza existência)', async () => {
    const dela = criarSimulacao(bia.id)
    const alheia = await chamar('GET', `/simulacoes/${dela.id}`, { token: tokenAna })
    const inexistente = await chamar('GET', '/simulacoes/999', { token: tokenAna })
    expect(alheia.status).toBe(404)
    expect(alheia.corpo).toEqual({ erro: 'Simulação não encontrada' })
    expect(inexistente.corpo).toEqual(alheia.corpo)
    // O dono enxerga normalmente (controle).
    expect((await chamar('GET', `/simulacoes/${dela.id}`, { token: tokenBia })).status).toBe(200)
  })

  it.each(['abc', '0', '99999999999', '-1'])('id inválido "%s" -> 404 (não 405)', async (id) => {
    for (const metodo of ['GET', 'PUT', 'DELETE']) {
      const r = await chamar(metodo, `/simulacoes/${id}`, { token: tokenAna, corpo: metodo === 'PUT' ? SIM : undefined })
      expect(r.status).toBe(404)
    }
  })

  it('PUT substitui tudo: valor_entrada omitido volta a 0', async () => {
    const s = criarSimulacao(ana.id, { valor_entrada: 20000 })
    const { valor_entrada: _omitido, ...semEntrada } = SIM
    const r = await chamar('PUT', `/simulacoes/${s.id}`, { token: tokenAna, corpo: { ...semEntrada, nome: 'Novo' } })
    expect(r.status).toBe(200)
    expect(r.corpo.nome).toBe('Novo')
    expect(r.corpo.valor_entrada).toBe(0)
  })

  it('PUT de simulação alheia -> 404 e nada muda', async () => {
    const s = criarSimulacao(bia.id, { nome: 'Da Bia' })
    expect((await chamar('PUT', `/simulacoes/${s.id}`, { token: tokenAna, corpo: SIM })).status).toBe(404)
    expect(s.nome).toBe('Da Bia')
  })

  it('PUT é recusado (422 em valor_veiculo) se o novo valor for menor ou igual à entrada de uma opção', async () => {
    const s = criarSimulacao(ana.id, { valor_veiculo: 95000 })
    criarFinanciamento(s.id, { valor_entrada: 50000 })
    const recusado = await chamar('PUT', `/simulacoes/${s.id}`, {
      token: tokenAna,
      corpo: { ...SIM, valor_veiculo: 50000, valor_entrada: 0 },
    })
    expect(recusado.status).toBe(422)
    expect(recusado.corpo.detalhes.valor_veiculo).toBeDefined()
    // Controle: um valor maior que a entrada da opção é aceito.
    const aceito = await chamar('PUT', `/simulacoes/${s.id}`, {
      token: tokenAna,
      corpo: { ...SIM, valor_veiculo: 50000.01, valor_entrada: 0 },
    })
    expect(aceito.status).toBe(200)
  })

  it('DELETE -> 204 sem corpo, apaga as opções junto e depois dá 404', async () => {
    const s = criarSimulacao(ana.id)
    criarFinanciamento(s.id)
    const r = await chamar('DELETE', `/simulacoes/${s.id}`, { token: tokenAna })
    expect(r.status).toBe(204)
    expect(r.corpo).toBeNull()
    expect((await chamar('GET', `/simulacoes/${s.id}`, { token: tokenAna })).status).toBe(404)
    expect((await chamar('DELETE', `/simulacoes/${s.id}`, { token: tokenAna })).status).toBe(404)
  })

  it.each([
    ['valor_veiculo zero', { valor_veiculo: 0 }, 'valor_veiculo'],
    ['valor_veiculo acima do teto', { valor_veiculo: 10000000 }, 'valor_veiculo'],
    ['3 casas decimais no dinheiro (não arredonda)', { valor_veiculo: 95000.123 }, 'valor_veiculo'],
    ['IPCA abaixo de -20', { taxa_ipca_projetada: -20.5 }, 'taxa_ipca_projetada'],
    ['fundo acima de 100', { taxa_fundo_rendimento: 100.5 }, 'taxa_fundo_rendimento'],
    ['7 casas decimais na taxa', { taxa_fundo_rendimento: 12.1234567 }, 'taxa_fundo_rendimento'],
    ['prazo do fundo 61', { prazo_meses_fundo: 61 }, 'prazo_meses_fundo'],
    ['prazo do fundo fracionado', { prazo_meses_fundo: 12.5 }, 'prazo_meses_fundo'],
    ['nome vazio', { nome: '' }, 'nome'],
    ['entrada maior que o veículo', { valor_entrada: 95000.01 }, 'valor_entrada'],
    ['campo desconhecido', { usuario_id: 7 }, 'usuario_id'],
  ])('422 para %s', async (_rotulo, alteracao, campo) => {
    const r = await chamar('POST', '/simulacoes', { token: tokenAna, corpo: { ...SIM, ...alteracao } })
    expect(r.status).toBe(422)
    expect(r.corpo.detalhes[campo]).toBeDefined()
  })

  it('aceita texto numérico e entrada IGUAL ao valor do veículo', async () => {
    const r = await chamar('POST', '/simulacoes', {
      token: tokenAna,
      corpo: { ...SIM, valor_veiculo: '95000.50', valor_entrada: '95000.50' },
    })
    expect(r.status).toBe(201)
    expect(r.corpo.valor_veiculo).toBe(95000.5)
  })
})

describe('financiamentos', () => {
  let sim

  beforeEach(() => {
    sim = criarSimulacao(ana.id, { valor_veiculo: 95000 })
  })

  const url = (sufixo = '') => `/simulacoes/${sim.id}/financiamentos${sufixo}`

  it('POST -> 201 com Location; sistema em qualquer caixa volta em maiúsculas; lista em ordem de criação', async () => {
    const a = await chamar('POST', url(), { token: tokenAna, corpo: { ...FIN, nome: 'Primeira', sistema_amortizacao: 'sac' } })
    await chamar('POST', url(), { token: tokenAna, corpo: { ...FIN, nome: 'Segunda' } })
    expect(a.status).toBe(201)
    expect(a.corpo.sistema_amortizacao).toBe('SAC')
    expect(a.cabecalhos.get('Location')).toBe(`${BASE}${url(`/${a.corpo.id}`)}`)
    expect(Object.keys(a.corpo).sort()).toEqual([
      'id',
      'nome',
      'prazo_meses',
      'sistema_amortizacao',
      'taxa_juros_mensal',
      'valor_entrada',
    ])

    const lista = await chamar('GET', url(), { token: tokenAna })
    expect(lista.corpo.itens.map((f) => f.nome)).toEqual(['Primeira', 'Segunda'])
    expect(lista.corpo.total).toBe(2)
  })

  it('a 3ª opção é aceita e a 4ª dá 409 (controle: o 409 só vem no limite)', async () => {
    for (let i = 1; i <= 3; i += 1) {
      expect((await chamar('POST', url(), { token: tokenAna, corpo: { ...FIN, nome: `Opção ${i}` } })).status).toBe(201)
    }
    const quarta = await chamar('POST', url(), { token: tokenAna, corpo: FIN })
    expect(quarta.status).toBe(409)
    expect(quarta.corpo.erro).toContain('no máximo 3')
  })

  it('ordem das verificações: corpo inválido na 4ª opção dá 422 (não 409); simulação alheia dá 404 antes de tudo', async () => {
    for (let i = 0; i < 3; i += 1) criarFinanciamento(sim.id)
    const invalido = await chamar('POST', url(), { token: tokenAna, corpo: { ...FIN, prazo_meses: 0 } })
    expect(invalido.status).toBe(422)
    const alheia = await chamar('POST', url(), { token: tokenBia, corpo: { ...FIN, prazo_meses: 0 } })
    expect(alheia.status).toBe(404)
  })

  it('a entrada da opção tem de ser ESTRITAMENTE menor que o veículo', async () => {
    const igual = await chamar('POST', url(), { token: tokenAna, corpo: { ...FIN, valor_entrada: 95000 } })
    expect(igual.status).toBe(422)
    expect(igual.corpo.detalhes.valor_entrada[0]).toContain('R$ 95.000,00')
    const menor = await chamar('POST', url(), { token: tokenAna, corpo: { ...FIN, valor_entrada: 94999.99 } })
    expect(menor.status).toBe(201)
  })

  it.each([
    ['taxa acima de 20', { taxa_juros_mensal: 20.1 }, 'taxa_juros_mensal'],
    ['prazo 73', { prazo_meses: 73 }, 'prazo_meses'],
    ['sistema desconhecido', { sistema_amortizacao: 'SACRE' }, 'sistema_amortizacao'],
    ['nome vazio', { nome: '' }, 'nome'],
  ])('422 para %s', async (_rotulo, alteracao, campo) => {
    const r = await chamar('POST', url(), { token: tokenAna, corpo: { ...FIN, ...alteracao } })
    expect(r.status).toBe(422)
    expect(r.corpo.detalhes[campo]).toBeDefined()
  })

  it('valor_entrada omitido vale 0', async () => {
    const { valor_entrada: _omitido, ...semEntrada } = FIN
    const r = await chamar('POST', url(), { token: tokenAna, corpo: semEntrada })
    expect(r.corpo.valor_entrada).toBe(0)
  })

  it('PUT substitui a opção; DELETE -> 204 e some da lista', async () => {
    const f = criarFinanciamento(sim.id, { nome: 'Antiga' })
    const put = await chamar('PUT', url(`/${f.id}`), { token: tokenAna, corpo: { ...FIN, nome: 'Nova' } })
    expect(put.status).toBe(200)
    expect(put.corpo.nome).toBe('Nova')

    const del = await chamar('DELETE', url(`/${f.id}`), { token: tokenAna })
    expect(del.status).toBe(204)
    expect((await chamar('GET', url(), { token: tokenAna })).corpo.total).toBe(0)
    expect((await chamar('DELETE', url(`/${f.id}`), { token: tokenAna })).status).toBe(404)
  })

  it('o DELETE da última opção é permitido (não há mínimo)', async () => {
    const f = criarFinanciamento(sim.id)
    expect((await chamar('DELETE', url(`/${f.id}`), { token: tokenAna })).status).toBe(204)
  })

  it('opção de outra simulação -> 404; simulação alheia -> 404 (mesma resposta da inexistente)', async () => {
    const outra = criarSimulacao(ana.id)
    const deOutra = criarFinanciamento(outra.id)
    expect((await chamar('PUT', url(`/${deOutra.id}`), { token: tokenAna, corpo: FIN })).status).toBe(404)

    const alheia = await chamar('GET', url(), { token: tokenBia })
    const inexistente = await chamar('GET', '/simulacoes/999/financiamentos', { token: tokenBia })
    expect(alheia.status).toBe(404)
    expect(alheia.corpo).toEqual(inexistente.corpo)
  })

  it('exige token nas 4 rotas (401)', async () => {
    for (const [metodo, caminho, corpo] of [
      ['GET', url()],
      ['POST', url(), FIN],
      ['PUT', url('/1'), FIN],
      ['DELETE', url('/1')],
    ]) {
      expect((await chamar(metodo, caminho, { corpo })).status).toBe(401)
    }
  })
})

// Mensagens e comportamentos conferidos contra o backend REAL em 2026-09-26. Os literais abaixo são a
// referência independente: se os mocks derivarem, estes testes falham.
describe('autenticação: mensagens e regras iguais às do backend real', () => {
  const REGISTRO_OK = { nome: 'Caio Souza', email: 'caio@example.com', senha: 'uma senha longa' }
  const MSG_NOME = 'O nome deve ter entre 2 e 120 caracteres.'
  const MSG_SENHA = 'A senha deve ter entre 8 e 128 caracteres.'
  const MSG_SENHA_LOGIN = 'A senha deve ter de 1 a 128 caracteres.'
  const MSG_EMAIL = 'E-mail inválido.'

  const registrar = (corpo) => chamar('POST', '/auth/registrar', { corpo })
  const entrar = (corpo) => chamar('POST', '/auth/login', { corpo })

  describe('registro', () => {
    it('mensagens exatas por campo', async () => {
      const r = await registrar({ nome: 'A', email: 'nao-e-email', senha: 'curta' })
      expect(r.status).toBe(422)
      expect(r.corpo).toEqual({
        erro: 'Dados inválidos',
        detalhes: { nome: [MSG_NOME], email: [MSG_EMAIL], senha: [MSG_SENHA] },
      })
    })

    it('nome com espaços nas pontas é aparado antes de contar (" A " é curto)', async () => {
      const r = await registrar({ ...REGISTRO_OK, nome: ' A ' })
      expect(r.corpo.detalhes.nome).toEqual([MSG_NOME])
    })

    it('limites do nome (2 e 120 valem; 1 e 121 não) e da senha (8 e 128 valem; 7 e 129 não)', async () => {
      expect((await registrar({ ...REGISTRO_OK, email: 'a1@example.com', nome: 'Jo' })).status).toBe(201)
      expect((await registrar({ ...REGISTRO_OK, email: 'a2@example.com', nome: 'n'.repeat(120) })).status).toBe(201)
      expect((await registrar({ ...REGISTRO_OK, email: 'a3@example.com', senha: 'x'.repeat(8) })).status).toBe(201)
      expect((await registrar({ ...REGISTRO_OK, email: 'a4@example.com', senha: 'x'.repeat(128) })).status).toBe(201)
      expect((await registrar({ ...REGISTRO_OK, nome: 'n'.repeat(121) })).corpo.detalhes.nome).toEqual([MSG_NOME])
      expect((await registrar({ ...REGISTRO_OK, senha: 'x'.repeat(7) })).corpo.detalhes.senha).toEqual([MSG_SENHA])
      expect((await registrar({ ...REGISTRO_OK, senha: 'x'.repeat(129) })).corpo.detalhes.senha).toEqual([MSG_SENHA])
    })

    it('a senha NÃO é aparada: 8 espaços são uma senha válida', async () => {
      const r = await registrar({ ...REGISTRO_OK, senha: '        ' })
      expect(r.status).toBe(201)
    })

    it('e-mail com mais de 254 caracteres tem mensagem própria', async () => {
      const r = await registrar({ ...REGISTRO_OK, email: `${'a'.repeat(250)}@b.co` })
      expect(r.corpo.detalhes.email).toEqual(['O e-mail deve ter até 254 caracteres.'])
    })

    it('a validação (422) vem antes do conflito (409): e-mail existente com senha curta dá 422', async () => {
      const r = await registrar({ nome: 'Outra Ana', email: 'ana@example.com', senha: 'curta' })
      expect(r.status).toBe(422)
      expect(r.corpo.detalhes.senha).toEqual([MSG_SENHA])
      // Controle: com dados válidos, o mesmo e-mail dá 409.
      expect((await registrar({ nome: 'Outra Ana', email: 'ana@example.com', senha: 'uma senha longa' })).status).toBe(409)
    })
  })

  describe('login', () => {
    it('valida o FORMATO do e-mail (422), como o backend real', async () => {
      const r = await entrar({ email: 'nao-e-email', senha: 'x' })
      expect(r.status).toBe(422)
      expect(r.corpo).toEqual({ erro: 'Dados inválidos', detalhes: { email: [MSG_EMAIL] } })
    })

    it.each([
      ['e-mail vazio', { email: '', senha: 'x' }, 'email', MSG_EMAIL],
      ['e-mail que não é texto', { email: 123, senha: 'x' }, 'email', MSG_EMAIL],
      ['senha vazia', { email: 'ana@example.com', senha: '' }, 'senha', MSG_SENHA_LOGIN],
      ['senha com 129 caracteres', { email: 'ana@example.com', senha: 'x'.repeat(129) }, 'senha', MSG_SENHA_LOGIN],
      ['campo desconhecido', { email: 'ana@example.com', senha: 'x', lembrar: true }, 'lembrar', 'Campo desconhecido.'],
    ])('422 para %s', async (_rotulo, corpo, campo, mensagem) => {
      const r = await entrar(corpo)
      expect(r.status).toBe(422)
      expect(r.corpo.detalhes[campo]).toEqual([mensagem])
    })

    it('a senha do login também não é aparada (espaços contam)', async () => {
      const espacos = criarUsuario({ email: 'espacos@example.com', senha: '        ' })
      const r = await entrar({ email: 'espacos@example.com', senha: '        ' })
      expect(r.status).toBe(200)
      expect(r.corpo.usuario.id).toBe(espacos.id)
    })

    it('e-mail válido com senha errada dá 401, não 422 (controle da validação de formato)', async () => {
      const r = await entrar({ email: 'ana@example.com', senha: 'errada' })
      expect(r.status).toBe(401)
    })

    it('o 401 do login NÃO traz WWW-Authenticate, mas o do perfil traz', async () => {
      const login = await entrar({ email: 'ana@example.com', senha: 'errada' })
      const perfil = await chamar('GET', '/auth/perfil')
      expect(login.cabecalhos.get('WWW-Authenticate')).toBeNull()
      expect(perfil.cabecalhos.get('WWW-Authenticate')).toBe('Bearer')
    })
  })

  describe('cabeçalho Authorization', () => {
    it.each([
      ['Basic abc', 'Token de autenticação ausente'],
      ['bearer abc', 'Token de autenticação ausente'],
      ['Token abc', 'Token de autenticação ausente'],
      ['Bearer', 'Token inválido'],
      ['Bearer lixo', 'Token inválido'],
    ])('"%s" -> 401 "%s"', async (cabecalho, mensagem) => {
      const r = await chamar('GET', '/auth/perfil', { cabecalhos: { Authorization: cabecalho } })
      expect(r.status).toBe(401)
      expect(r.corpo).toEqual({ erro: mensagem })
    })

    it('"Bearer <token válido>" é aceito (controle)', async () => {
      const r = await chamar('GET', '/auth/perfil', { cabecalhos: { Authorization: `Bearer ${tokenAna}` } })
      expect(r.status).toBe(200)
    })
  })
})
