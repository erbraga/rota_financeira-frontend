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
    expect(r.cabecalhos.get('Location')).toBe(`/api/simulacoes/${r.corpo.id}`)
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
    expect(a.cabecalhos.get('Location')).toBe(`/api${url(`/${a.corpo.id}`)}`)
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

// Mensagens de simulação conferidas contra o backend REAL em 2026-09-26 (sonda com conta descartável).
// Os literais abaixo são a referência independente: se os mocks derivarem, estes testes falham.
describe('simulações: mensagens e tipos iguais aos do backend real', () => {
  const MSG_NOME = 'O nome deve ter entre 1 e 120 caracteres.'
  const MSG_VEICULO = 'O valor do veículo deve estar entre 0,01 e 9.999.999,00.'
  const MSG_ENTRADA = 'O valor da entrada deve estar entre 0,00 e 9.999.999,00.'
  const MSG_IPCA = 'A taxa de IPCA projetada deve estar entre -20 e 100.'
  const MSG_FUNDO = 'A taxa de rendimento do fundo deve estar entre 0 e 100.'
  const MSG_PRAZO = 'O prazo do fundo (em meses) deve estar entre 1 e 60.'

  const criarInvalida = (alteracao) => chamar('POST', '/simulacoes', { token: tokenAna, corpo: { ...SIM, ...alteracao } })

  it('corpo vazio: "Campo obrigatório." nos cinco campos obrigatórios (a entrada é opcional)', async () => {
    const r = await chamar('POST', '/simulacoes', { token: tokenAna, corpo: {} })
    expect(r.status).toBe(422)
    expect(r.corpo.detalhes).toEqual({
      nome: ['Campo obrigatório.'],
      valor_veiculo: ['Campo obrigatório.'],
      taxa_ipca_projetada: ['Campo obrigatório.'],
      taxa_fundo_rendimento: ['Campo obrigatório.'],
      prazo_meses_fundo: ['Campo obrigatório.'],
    })
  })

  it.each([
    ['nome vazio', { nome: '' }, 'nome', MSG_NOME],
    ['nome só com espaços', { nome: '   ' }, 'nome', MSG_NOME],
    ['nome com 121 caracteres', { nome: 'n'.repeat(121) }, 'nome', MSG_NOME],
    ['nome que não é texto', { nome: 123 }, 'nome', 'Nome inválido.'],
    ['veículo 0', { valor_veiculo: 0 }, 'valor_veiculo', MSG_VEICULO],
    ['veículo -1', { valor_veiculo: -1 }, 'valor_veiculo', MSG_VEICULO],
    ['veículo 10.000.000', { valor_veiculo: 10000000 }, 'valor_veiculo', MSG_VEICULO],
    ['veículo em notação científica enorme', { valor_veiculo: '1e999999' }, 'valor_veiculo', MSG_VEICULO],
    ['veículo com 3 casas', { valor_veiculo: 95000.123 }, 'valor_veiculo', 'Use no máximo 2 casas decimais.'],
    ['veículo texto', { valor_veiculo: 'abc' }, 'valor_veiculo', 'Número inválido.'],
    ['veículo booleano', { valor_veiculo: true }, 'valor_veiculo', 'Número inválido.'],
    ['veículo null', { valor_veiculo: null }, 'valor_veiculo', 'Campo obrigatório.'],
    ['entrada -1', { valor_entrada: -1 }, 'valor_entrada', MSG_ENTRADA],
    ['entrada maior que o veículo', { valor_entrada: 95000.01 }, 'valor_entrada', 'A entrada não pode ser maior que o valor do veículo.'],
    ['entrada com 3 casas', { valor_entrada: 20000.001 }, 'valor_entrada', 'Use no máximo 2 casas decimais.'],
    ['entrada null (recusada; omitir vale 0)', { valor_entrada: null }, 'valor_entrada', 'Campo obrigatório.'],
    ['IPCA -20,5', { taxa_ipca_projetada: -20.5 }, 'taxa_ipca_projetada', MSG_IPCA],
    ['IPCA 100,1', { taxa_ipca_projetada: 100.1 }, 'taxa_ipca_projetada', MSG_IPCA],
    ['IPCA com 7 casas', { taxa_ipca_projetada: 12.1234567 }, 'taxa_ipca_projetada', 'Use no máximo 6 casas decimais.'],
    ['fundo -0,1', { taxa_fundo_rendimento: -0.1 }, 'taxa_fundo_rendimento', MSG_FUNDO],
    ['fundo 100,1', { taxa_fundo_rendimento: 100.1 }, 'taxa_fundo_rendimento', MSG_FUNDO],
    ['prazo 0', { prazo_meses_fundo: 0 }, 'prazo_meses_fundo', MSG_PRAZO],
    ['prazo 61', { prazo_meses_fundo: 61 }, 'prazo_meses_fundo', MSG_PRAZO],
    ['prazo fracionado 12,5', { prazo_meses_fundo: 12.5 }, 'prazo_meses_fundo', 'Número inteiro inválido.'],
    ['prazo texto "abc"', { prazo_meses_fundo: 'abc' }, 'prazo_meses_fundo', 'Número inteiro inválido.'],
    ['prazo em TEXTO numérico "12" (só vale número JSON)', { prazo_meses_fundo: '12' }, 'prazo_meses_fundo', 'Número inteiro inválido.'],
    ['campo desconhecido', { usuario_id: 7 }, 'usuario_id', 'Campo desconhecido.'],
  ])('422 para %s', async (_rotulo, alteracao, campo, mensagem) => {
    const r = await criarInvalida(alteracao)
    expect(r.status).toBe(422)
    expect(r.corpo.erro).toBe('Dados inválidos')
    expect(r.corpo.detalhes[campo]).toEqual([mensagem])
  })

  it('os valores-limite VÁLIDOS são aceitos (controle das recusas)', async () => {
    const minimos = { valor_veiculo: 0.01, valor_entrada: 0, taxa_ipca_projetada: -20, taxa_fundo_rendimento: 0, prazo_meses_fundo: 1 }
    const maximos = { valor_veiculo: 9999999, valor_entrada: 9999999, taxa_ipca_projetada: 100, taxa_fundo_rendimento: 100, prazo_meses_fundo: 60 }
    const seisCasas = { taxa_ipca_projetada: 12.123456, taxa_fundo_rendimento: 0.000001 }
    const veiculoIgualEntrada = { valor_veiculo: 50000, valor_entrada: 50000 }
    for (const alteracao of [minimos, maximos, seisCasas, veiculoIgualEntrada]) {
      expect((await criarInvalida(alteracao)).status).toBe(201)
    }
  })

  it('texto numérico vale para dinheiro e taxas, mas não para o prazo', async () => {
    const r = await criarInvalida({ valor_veiculo: '95000.50', valor_entrada: '0', taxa_ipca_projetada: '4.5', taxa_fundo_rendimento: '12' })
    expect(r.status).toBe(201)
    expect(r.corpo.valor_veiculo).toBe(95000.5)
  })

  it('entrada omitida vale 0', async () => {
    const { valor_entrada: _omitida, ...semEntrada } = SIM
    const r = await chamar('POST', '/simulacoes', { token: tokenAna, corpo: semEntrada })
    expect(r.status).toBe(201)
    expect(r.corpo.valor_entrada).toBe(0)
  })

  it('o PUT parcial também dá "Campo obrigatório." (substitui tudo)', async () => {
    const s = criarSimulacao(ana.id)
    const r = await chamar('PUT', `/simulacoes/${s.id}`, { token: tokenAna, corpo: { nome: 'Novo' } })
    expect(r.status).toBe(422)
    expect(Object.keys(r.corpo.detalhes).sort()).toEqual(['prazo_meses_fundo', 'taxa_fundo_rendimento', 'taxa_ipca_projetada', 'valor_veiculo'])
  })
})

// Comportamentos conferidos contra o backend REAL em 2026-09-26.
describe('simulações: 404, Location e PUT contra a entrada de uma opção (backend real)', () => {
  it('id NÃO numérico ("abc", "-1"): 404 genérico "Recurso não encontrado", em qualquer método e rota aninhada', async () => {
    for (const id of ['abc', '-1']) {
      for (const [metodo, sufixo, corpo] of [
        ['GET', ''],
        ['PUT', '', SIM],
        ['DELETE', ''],
        ['GET', '/financiamentos'],
        ['GET', '/resultado'],
      ]) {
        const r = await chamar(metodo, `/simulacoes/${id}${sufixo}`, { token: tokenAna, corpo })
        expect(r.status, `${metodo} ${id}${sufixo}`).toBe(404)
        expect(r.corpo).toEqual({ erro: 'Recurso não encontrado' })
      }
    }
  })

  it('id numérico que não existe, "0" e acima do INTEGER: 404 "Simulação não encontrada" (controle dos não numéricos)', async () => {
    for (const id of ['999999', '0', '99999999999']) {
      const r = await chamar('GET', `/simulacoes/${id}`, { token: tokenAna })
      expect(r.status).toBe(404)
      expect(r.corpo).toEqual({ erro: 'Simulação não encontrada' })
    }
  })

  it('opção: id não numérico dá "Recurso não encontrado" e numérico inexistente, "Opção de financiamento não encontrada"', async () => {
    const s = criarSimulacao(ana.id)
    const naoNumerico = await chamar('PUT', `/simulacoes/${s.id}/financiamentos/abc`, { token: tokenAna, corpo: FIN })
    const inexistente = await chamar('PUT', `/simulacoes/${s.id}/financiamentos/999`, { token: tokenAna, corpo: FIN })
    expect(naoNumerico.corpo).toEqual({ erro: 'Recurso não encontrado' })
    expect(inexistente.corpo).toEqual({ erro: 'Opção de financiamento não encontrada' })
  })

  it('o Location do POST é RELATIVO ("/api/simulacoes/7"), não uma URL absoluta', async () => {
    const r = await chamar('POST', '/simulacoes', { token: tokenAna, corpo: SIM })
    const location = r.cabecalhos.get('Location')
    expect(location).toBe(`/api/simulacoes/${r.corpo.id}`)
    expect(location).not.toMatch(/^https?:/)
  })

  it('PUT com veículo <= entrada de uma opção: a mensagem real cita o NOME e o VALOR da opção', async () => {
    const s = criarSimulacao(ana.id, { valor_veiculo: 95000 })
    criarFinanciamento(s.id, { nome: 'Banco X', valor_entrada: 50000 })
    const r = await chamar('PUT', `/simulacoes/${s.id}`, {
      token: tokenAna,
      corpo: { ...SIM, valor_veiculo: 50000, valor_entrada: 0 },
    })
    expect(r.status).toBe(422)
    expect(r.corpo).toEqual({
      erro: 'Dados inválidos',
      detalhes: {
        valor_veiculo: [
          'O valor do veículo deve ser maior que a entrada da opção de financiamento "Banco X" (R$ 50.000,00). Ajuste a opção antes.',
        ],
      },
    })
    // Controle: um centavo acima da entrada da opção é aceito.
    const aceito = await chamar('PUT', `/simulacoes/${s.id}`, {
      token: tokenAna,
      corpo: { ...SIM, valor_veiculo: 50000.01, valor_entrada: 0 },
    })
    expect(aceito.status).toBe(200)
  })

  it('com várias opções, a mensagem cita a primeira (na ordem de criação) que conflita', async () => {
    const s = criarSimulacao(ana.id, { valor_veiculo: 95000 })
    criarFinanciamento(s.id, { nome: 'Banco A', valor_entrada: 30000 })
    criarFinanciamento(s.id, { nome: 'Banco B', valor_entrada: 60000 })
    const soB = await chamar('PUT', `/simulacoes/${s.id}`, { token: tokenAna, corpo: { ...SIM, valor_veiculo: 40000, valor_entrada: 0 } })
    expect(soB.corpo.detalhes.valor_veiculo[0]).toContain('"Banco B" (R$ 60.000,00)')
    const ambas = await chamar('PUT', `/simulacoes/${s.id}`, { token: tokenAna, corpo: { ...SIM, valor_veiculo: 20000, valor_entrada: 0 } })
    expect(ambas.corpo.detalhes.valor_veiculo[0]).toContain('"Banco A" (R$ 30.000,00)')
  })
})

// Mensagens e regras das opções de financiamento, copiadas do backend REAL (conta descartável, 2026-09-26).
// A referência são estes literais, nunca o próprio handler.
describe('financiamentos: mensagens e regras iguais às do backend real', () => {
  let sim

  beforeEach(() => {
    sim = criarSimulacao(ana.id, { valor_veiculo: 95000 })
  })

  const url = (sufixo = '') => `/simulacoes/${sim.id}/financiamentos${sufixo}`
  const enviar = (corpo, metodo = 'POST', sufixo = '') => chamar(metodo, url(sufixo), { token: tokenAna, corpo })

  const NOME = 'O nome deve ter entre 1 e 120 caracteres.'
  const TAXA = 'A taxa de juros mensal deve estar entre 0 e 20.'
  const PRAZO = 'O prazo (em meses) deve estar entre 1 e 72.'
  const SISTEMA = 'Sistema de amortização inválido. Use PRICE ou SAC.'
  const ENTRADA = 'O valor da entrada deve estar entre 0,00 e 9.999.999,00.'
  const ENTRADA_MAIOR =
    'A entrada deve ser menor que o valor do veículo (R$ 95.000,00); com a entrada igual ao valor não há o que financiar.'

  it.each([
    ['nome vazio', { nome: '' }, 'nome', NOME],
    ['nome com 121 caracteres', { nome: 'x'.repeat(121) }, 'nome', NOME],
    ['nome que não é texto', { nome: 5 }, 'nome', 'Nome inválido.'],
    ['taxa -0,01', { taxa_juros_mensal: -0.01 }, 'taxa_juros_mensal', TAXA],
    ['taxa 20,01', { taxa_juros_mensal: 20.01 }, 'taxa_juros_mensal', TAXA],
    ['taxa com 7 casas', { taxa_juros_mensal: 1.1234567 }, 'taxa_juros_mensal', 'Use no máximo 6 casas decimais.'],
    ['taxa "abc"', { taxa_juros_mensal: 'abc' }, 'taxa_juros_mensal', 'Número inválido.'],
    ['taxa null', { taxa_juros_mensal: null }, 'taxa_juros_mensal', 'Campo obrigatório.'],
    ['prazo 0', { prazo_meses: 0 }, 'prazo_meses', PRAZO],
    ['prazo 73', { prazo_meses: 73 }, 'prazo_meses', PRAZO],
    ['prazo em texto ("48")', { prazo_meses: '48' }, 'prazo_meses', 'Número inteiro inválido.'],
    ['prazo 12,5', { prazo_meses: 12.5 }, 'prazo_meses', 'Número inteiro inválido.'],
    ['prazo null', { prazo_meses: null }, 'prazo_meses', 'Campo obrigatório.'],
    ['sistema "PRAZO"', { sistema_amortizacao: 'PRAZO' }, 'sistema_amortizacao', SISTEMA],
    ['sistema vazio', { sistema_amortizacao: '' }, 'sistema_amortizacao', SISTEMA],
    ['sistema que é número', { sistema_amortizacao: 1 }, 'sistema_amortizacao', SISTEMA],
    ['entrada -1', { valor_entrada: -1 }, 'valor_entrada', ENTRADA],
    ['entrada 10.000.000', { valor_entrada: 10000000 }, 'valor_entrada', ENTRADA],
    ['entrada com 3 casas', { valor_entrada: 100.123 }, 'valor_entrada', 'Use no máximo 2 casas decimais.'],
    ['entrada igual ao veículo', { valor_entrada: 95000 }, 'valor_entrada', ENTRADA_MAIOR],
    ['entrada maior que o veículo', { valor_entrada: 95000.01 }, 'valor_entrada', ENTRADA_MAIOR],
    ['entrada null', { valor_entrada: null }, 'valor_entrada', 'Campo obrigatório.'],
    ['campo desconhecido', { extra: 1 }, 'extra', 'Campo desconhecido.'],
    ['usuario_id (nunca vem do cliente)', { usuario_id: 1 }, 'usuario_id', 'Campo desconhecido.'],
  ])('POST com %s -> 422 com a mensagem real', async (_rotulo, alteracao, campo, mensagem) => {
    const r = await enviar({ ...FIN, ...alteracao })
    expect(r.status).toBe(422)
    expect(r.corpo).toEqual({ erro: 'Dados inválidos', detalhes: { [campo]: [mensagem] } })
  })

  it('a faixa vem antes da regra "entrada < veículo" (entrada > 9.999.999 dá a mensagem da faixa)', async () => {
    const r = await enviar({ ...FIN, valor_entrada: 10000000 })
    expect(r.corpo.detalhes).toEqual({ valor_entrada: [ENTRADA] })
  })

  it('corpo vazio: "Campo obrigatório." nos quatro campos que não têm padrão (a entrada é opcional)', async () => {
    const r = await enviar({})
    expect(r.status).toBe(422)
    expect(r.corpo.detalhes).toEqual({
      nome: ['Campo obrigatório.'],
      prazo_meses: ['Campo obrigatório.'],
      sistema_amortizacao: ['Campo obrigatório.'],
      taxa_juros_mensal: ['Campo obrigatório.'],
    })
  })

  it('controle: os limites (taxa 20, prazo 1 e 72, entrada 0) são aceitos', async () => {
    for (const alteracao of [{ taxa_juros_mensal: 20 }, { taxa_juros_mensal: 0 }, { prazo_meses: 1 }, { prazo_meses: 72 }, { valor_entrada: 0 }]) {
      const r = await enviar({ ...FIN, ...alteracao })
      expect(r.status, JSON.stringify(alteracao)).toBe(201)
      await enviar(undefined, 'DELETE', `/${r.corpo.id}`) // libera a vaga para o próximo limite
    }
  })

  it('taxa em texto numérico e valor_entrada omitido são aceitos (a entrada vale 0)', async () => {
    const r = await enviar({ nome: 'B', taxa_juros_mensal: '2.5', prazo_meses: 48, sistema_amortizacao: 'sac' })
    expect(r.status).toBe(201)
    expect(r.corpo).toMatchObject({ taxa_juros_mensal: 2.5, valor_entrada: 0, sistema_amortizacao: 'SAC' })
  })

  it('o PUT substitui tudo: sem valor_entrada volta a 0; parcial dá "Campo obrigatório."; sistema em qualquer caixa', async () => {
    const criada = (await enviar(FIN)).corpo
    const semEntrada = { nome: 'Nova', taxa_juros_mensal: 1.5, prazo_meses: 48, sistema_amortizacao: 'Sac' }
    const r = await enviar(semEntrada, 'PUT', `/${criada.id}`)
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual({ id: criada.id, ...semEntrada, sistema_amortizacao: 'SAC' , valor_entrada: 0 })

    const parcial = await enviar({ nome: 'só o nome' }, 'PUT', `/${criada.id}`)
    expect(parcial.status).toBe(422)
    expect(parcial.corpo.detalhes).toEqual({
      prazo_meses: ['Campo obrigatório.'],
      sistema_amortizacao: ['Campo obrigatório.'],
      taxa_juros_mensal: ['Campo obrigatório.'],
    })
  })

  it('ordem: 4ª opção INVÁLIDA dá 422 (a validação vem antes do 409); válida dá 409 sem detalhes', async () => {
    for (let i = 0; i < 3; i += 1) await enviar({ ...FIN, nome: `Opção ${i}` })
    const invalida = await enviar({ ...FIN, prazo_meses: 0 })
    expect(invalida.status).toBe(422)
    expect(invalida.corpo.detalhes).toEqual({ prazo_meses: [PRAZO] })

    const valida = await enviar(FIN)
    expect(valida.status).toBe(409)
    expect(valida.corpo).toEqual({ erro: 'Uma simulação aceita no máximo 3 opções de financiamento' })
  })

  it('ordem: o 404 da opção vem antes do 422 do corpo (PUT de opção inexistente com corpo vazio)', async () => {
    const r = await enviar({}, 'PUT', '/999999')
    expect(r.status).toBe(404)
    expect(r.corpo).toEqual({ erro: 'Opção de financiamento não encontrada' })
  })

  it('GET de uma opção só não existe: 405 "Método não permitido", com ou sem token', async () => {
    const criada = (await enviar(FIN)).corpo
    for (const token of [tokenAna, undefined]) {
      const r = await chamar('GET', url(`/${criada.id}`), { token })
      expect(r.status).toBe(405)
      expect(r.corpo).toEqual({ erro: 'Método não permitido' })
    }
  })
})

describe('corpo da requisição: 400 e 415 iguais aos do backend real (em todas as rotas com corpo)', () => {
  const ROTAS = [
    ['POST', '/auth/login'],
    ['POST', '/auth/registrar'],
    ['POST', '/simulacoes'],
    ['POST', '/simulacoes/:sim/financiamentos'],
  ]
  let caminhoDe
  beforeEach(() => {
    const sim = criarSimulacao(ana.id) // o dono da simulação é verificado antes do corpo
    caminhoDe = (caminho) => caminho.replace(':sim', sim.id)
  })

  it.each(ROTAS)('%s %s: [], null, vazio e JSON inválido dão a MESMA mensagem 400', async (metodo, caminho) => {
    for (const bruto of ['[]', 'null', '', '{x']) {
      const r = await chamar(metodo, caminhoDe(caminho), { token: tokenAna, bruto, cabecalhos: { 'Content-Type': 'application/json' } })
      expect(r.status, `${caminho} ${JSON.stringify(bruto)}`).toBe(400)
      expect(r.corpo).toEqual({ erro: 'Corpo da requisição deve ser um objeto JSON' })
    }
  })

  it.each(ROTAS)('%s %s: sem Content-Type de JSON dá 415 "Tipo de conteúdo não suportado"', async (metodo, caminho) => {
    for (const tipo of ['text/plain', undefined]) {
      const r = await chamar(metodo, caminhoDe(caminho), { token: tokenAna, bruto: '{}', cabecalhos: tipo ? { 'Content-Type': tipo } : {} })
      expect(r.status, `${caminho} ${tipo}`).toBe(415)
      expect(r.corpo).toEqual({ erro: 'Tipo de conteúdo não suportado' })
    }
  })

  it('controle: um objeto JSON vazio passa do 400 e cai na validação (422)', async () => {
    const r = await chamar('POST', '/auth/login', { corpo: {} })
    expect(r.status).toBe(422)
  })
})
