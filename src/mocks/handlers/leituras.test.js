// @vitest-environment node
// Handlers de leitura: /resultado, /parcelas e índices. Devolvem as fixtures reais, sem recalcular.
import { beforeEach, describe, expect, it } from 'vitest'
import { criarFinanciamento, criarSimulacao, criarUsuario, semearCenarioPadrao, tokenDe } from '../banco.js'
import { chamar } from '../chamar.js'
import resultado from '../fixtures/resultado.json'
import resultadoAporte from '../fixtures/resultado-aporte.json'
import resultadoAporteInsuficiente from '../fixtures/resultado-aporte-insuficiente.json'
import parcelasPrice from '../fixtures/parcelas-price.json'
import parcelasSac from '../fixtures/parcelas-sac.json'
import { servidor } from '../servidor.js'
import { handlers } from './index.js'
import { indiceDesatualizado, indiceIndisponivel, INDICES, indiceSemSugestao } from './indices.js'
import {
  FIXTURES_DE_PARCELAS,
  parcelasDeCentavos,
  parcelasDeUmMes,
  parcelasIndisponivel,
  parcelasQuitacaoAntecipada,
  parcelasSemJuros,
} from './parcelas.js'
import { FIXTURES_DE_RESULTADO, resultadoFundoVence, resultadoIndisponivel, resultadoSemOpcoes, resultadoTresOpcoes } from './resultado.js'

let ana
let bia
let tokenAna
let tokenBia
let cenario

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ email: 'ana@example.com' })
  bia = criarUsuario({ email: 'bia@example.com' })
  tokenAna = tokenDe(ana)
  tokenBia = tokenDe(bia)
  cenario = semearCenarioPadrao(ana.id)
})

describe('GET /simulacoes/:id/resultado', () => {
  it('sem token -> 401', async () => {
    expect((await chamar('GET', '/simulacoes/1/resultado')).status).toBe(401)
  })

  it('devolve exatamente a fixture real do resultado (nada é recalculado)', async () => {
    const r = await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado`, { token: tokenAna })
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual(resultado)
  })

  it('a fixture tem o formato do contrato, incluindo os null das séries e as chaves por id', () => {
    expect(Object.keys(resultado).sort()).toEqual(['cenarios', 'menor_custo', 'series', 'simulacao'])
    expect(resultado.menor_custo).toEqual({ cenario: 'a_vista', id: null })
    const ultimo = resultado.series.at(-1)
    expect(ultimo.saldo_fundo).toBeNull()
    expect(ultimo.saldo_devedor['2']).toBeNull()
    expect(ultimo.saldo_devedor['1']).toBe(0)
    expect(Object.keys(resultado.series[0].saldo_devedor).sort()).toEqual(['1', '2'])
  })

  it('simulação alheia e inexistente dão o mesmo 404', async () => {
    const alheia = await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado`, { token: tokenBia })
    const inexistente = await chamar('GET', '/simulacoes/999/resultado', { token: tokenBia })
    expect(alheia.status).toBe(404)
    expect(alheia.corpo).toEqual({ erro: 'Simulação não encontrada' })
    expect(inexistente.corpo).toEqual(alheia.corpo)
  })

  it('aporte_mensal que alcança a meta devolve a fixture do modo aporte', async () => {
    const r = await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado?aporte_mensal=1500`, { token: tokenAna })
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual(resultadoAporte)
    expect(r.corpo.cenarios.fundo.mes_da_meta).toBe(44)
    expect(r.corpo.cenarios.fundo.alcanca_a_meta).toBe(true)
  })

  it('aporte_mensal insuficiente: não alcança em 60 meses, com null no preço e no custo do fundo', async () => {
    const r = await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado?aporte_mensal=100`, { token: tokenAna })
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual(resultadoAporteInsuficiente)
    const fundo = r.corpo.cenarios.fundo
    expect(fundo.mes_da_meta).toBeNull()
    expect(fundo.alcanca_a_meta).toBe(false)
    expect(fundo.preco_na_compra).toBeNull()
    expect(fundo.custo_total).toBeNull()
    expect(fundo.prazo_meses).toBe(60)
  })

  it.each([
    ['texto', '?aporte_mensal=abc', 'aporte_mensal'],
    ['vazio', '?aporte_mensal=', 'aporte_mensal'],
    ['negativo', '?aporte_mensal=-1', 'aporte_mensal'],
    ['acima do teto', '?aporte_mensal=10000000', 'aporte_mensal'],
    ['3 casas decimais', '?aporte_mensal=1.234', 'aporte_mensal'],
    ['repetido', '?aporte_mensal=1&aporte_mensal=2', 'aporte_mensal'],
    ['parâmetro desconhecido', '?outro=1', 'outro'],
  ])('parâmetro %s -> 422', async (_rotulo, consulta, campo) => {
    const r = await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado${consulta}`, { token: tokenAna })
    expect(r.status).toBe(422)
    expect(r.corpo.detalhes[campo]).toBeDefined()
  })

  it('o aporte zero é válido (controle dos 422)', async () => {
    const r = await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado?aporte_mensal=0`, { token: tokenAna })
    expect(r.status).toBe(200)
  })

  it('ordem: o 404 vem antes do 422', async () => {
    const r = await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado?aporte_mensal=abc`, { token: tokenBia })
    expect(r.status).toBe(404)
  })
})

// Mensagens do parâmetro aporte_mensal, copiadas do backend REAL (conta descartável, 2026-09-27): a referência são estes
// literais, nunca o próprio handler.
describe('GET /simulacoes/:id/resultado: parâmetro aporte_mensal igual ao do backend real', () => {
  const consultar = (consulta) =>
    chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado${consulta}`, { token: tokenAna })
  const FAIXA = 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.'

  it.each([
    ['texto', '?aporte_mensal=abc', 'aporte_mensal', 'Número inválido.'],
    ['vazio', '?aporte_mensal=', 'aporte_mensal', 'Número inválido.'],
    ['só espaços', '?aporte_mensal=%20%20', 'aporte_mensal', 'Número inválido.'],
    ['vírgula decimal', '?aporte_mensal=1500,5', 'aporte_mensal', 'Número inválido.'],
    ['negativo', '?aporte_mensal=-1', 'aporte_mensal', FAIXA],
    ['acima do teto (9.999.999,01)', '?aporte_mensal=9999999.01', 'aporte_mensal', FAIXA],
    ['3 casas decimais', '?aporte_mensal=1500.505', 'aporte_mensal', 'Use no máximo 2 casas decimais.'],
    ['repetido', '?aporte_mensal=2000&aporte_mensal=3000', 'aporte_mensal', 'Informe o parâmetro uma única vez.'],
    ['parâmetro desconhecido (foo)', '?foo=1', 'foo', 'Campo desconhecido.'],
    ['parâmetro desconhecido (aporte)', '?aporte=1500', 'aporte', 'Campo desconhecido.'],
    ['aporte válido com parâmetro desconhecido', '?aporte_mensal=1500&foo=1', 'foo', 'Campo desconhecido.'],
  ])('%s -> 422 com a mensagem real', async (_rotulo, consulta, campo, mensagem) => {
    const r = await consultar(consulta)
    expect(r.status).toBe(422)
    expect(r.corpo).toEqual({ erro: 'Dados inválidos', detalhes: { [campo]: [mensagem] } })
  })

  it.each(['1500', '1500.50', '100', '0', '9999999', '1e3'])('aporte %s é válido (controle dos 422)', async (valor) => {
    expect((await consultar(`?aporte_mensal=${valor}`)).status).toBe(200)
  })

  it('a ordem é 401 -> 404 -> 422 (aporte inválido em simulação que não existe dá 404)', async () => {
    expect((await chamar('GET', '/simulacoes/999999/resultado?aporte_mensal=abc', { token: tokenAna })).corpo).toEqual({
      erro: 'Simulação não encontrada',
    })
    expect((await chamar('GET', '/simulacoes/abc/resultado', { token: tokenAna })).corpo).toEqual({ erro: 'Recurso não encontrado' })
    expect((await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado?aporte_mensal=abc`)).status).toBe(401)
  })
})

describe('atalhos de teste do /resultado', () => {
  const consultar = (consulta = '') =>
    chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado${consulta}`, { token: tokenAna })

  it.each([
    ['resultadoSemOpcoes', resultadoSemOpcoes, FIXTURES_DE_RESULTADO.semOpcoes],
    ['resultadoTresOpcoes', resultadoTresOpcoes, FIXTURES_DE_RESULTADO.tresOpcoes],
    ['resultadoFundoVence', resultadoFundoVence, FIXTURES_DE_RESULTADO.fundoVence],
  ])('%s devolve a fixture real correspondente', async (_nome, atalho, fixture) => {
    servidor.use(atalho())
    const r = await consultar()
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual(fixture)
    expect(r.corpo).not.toEqual(resultado)
  })

  it('os atalhos mantêm as regras de acesso e de parâmetros (401, 404 e 422)', async () => {
    servidor.use(resultadoSemOpcoes())
    expect((await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado`)).status).toBe(401)
    expect((await chamar('GET', `/simulacoes/${cenario.simulacao.id}/resultado`, { token: tokenBia })).status).toBe(404)
    expect((await consultar('?aporte_mensal=abc')).status).toBe(422)
  })

  it('com aporte informado o atalho devolve as fixtures do modo aporte (alcança e não alcança)', async () => {
    servidor.use(resultadoTresOpcoes())
    expect((await consultar('?aporte_mensal=1500')).corpo).toEqual(resultadoAporte)
    expect((await consultar('?aporte_mensal=100')).corpo).toEqual(resultadoAporteInsuficiente)
  })

  it('resultadoIndisponivel: 503 com a mensagem genérica', async () => {
    servidor.use(resultadoIndisponivel())
    const r = await consultar()
    expect(r.status).toBe(503)
    expect(r.corpo).toEqual({ erro: 'Serviço indisponível' })
  })

  it('sem atalho, o comportamento volta ao normal (controle)', async () => {
    expect((await consultar()).corpo).toEqual(resultado)
  })
})

describe('GET /simulacoes/:id/financiamentos/:fid/parcelas', () => {

  it('sem token -> 401', async () => {
    expect((await chamar('GET', '/simulacoes/1/financiamentos/1/parcelas')).status).toBe(401)
  })

  it('opção Price devolve a fixture Price e opção SAC devolve a fixture SAC', async () => {
    const [opcaoPrice, opcaoSac] = cenario.financiamentos
    const base = `/simulacoes/${cenario.simulacao.id}/financiamentos`
    const rPrice = await chamar('GET', `${base}/${opcaoPrice.id}/parcelas`, { token: tokenAna })
    const rSac = await chamar('GET', `${base}/${opcaoSac.id}/parcelas`, { token: tokenAna })
    expect(rPrice.status).toBe(200)
    expect(rPrice.corpo).toEqual(parcelasPrice)
    expect(rSac.corpo).toEqual(parcelasSac)
    expect(rPrice.corpo).not.toEqual(rSac.corpo)
  })

  it('a fixture tem uma linha por mês e o formato do contrato', () => {
    for (const fixture of [parcelasPrice, parcelasSac]) {
      expect(Object.keys(fixture).sort()).toEqual(['financiamento', 'parcelas', 'totais'])
      expect(fixture.parcelas).toHaveLength(fixture.financiamento.prazo_meses)
      expect(Object.keys(fixture.parcelas[0]).sort()).toEqual([
        'amortizacao',
        'juros',
        'numero',
        'saldo_devedor',
        'valor_parcela',
      ])
      expect(fixture.parcelas.at(-1).saldo_devedor).toBe(0)
    }
  })

  it('opção inexistente ou de outra simulação -> 404 "Opção de financiamento não encontrada"', async () => {
    const outra = criarSimulacao(ana.id)
    const deOutra = criarFinanciamento(outra.id)
    const base = `/simulacoes/${cenario.simulacao.id}/financiamentos`
    const inexistente = await chamar('GET', `${base}/999/parcelas`, { token: tokenAna })
    const alheia = await chamar('GET', `${base}/${deOutra.id}/parcelas`, { token: tokenAna })
    expect(inexistente.status).toBe(404)
    expect(inexistente.corpo).toEqual({ erro: 'Opção de financiamento não encontrada' })
    expect(alheia.corpo).toEqual(inexistente.corpo)
  })

  it('simulação de outro usuário -> 404 "Simulação não encontrada" (dono antes da opção)', async () => {
    const r = await chamar('GET', `/simulacoes/${cenario.simulacao.id}/financiamentos/${cenario.financiamentos[0].id}/parcelas`, {
      token: tokenBia,
    })
    expect(r.status).toBe(404)
    expect(r.corpo).toEqual({ erro: 'Simulação não encontrada' })
  })
})

describe('GET /indices/:indice', () => {
  it('sem token -> 401', async () => {
    expect((await chamar('GET', '/indices/cdi')).status).toBe(401)
  })

  it.each(['cdi', 'ipca'])('%s devolve a fixture real, com sugestão e unidade', async (nome) => {
    const r = await chamar('GET', `/indices/${nome}`, { token: tokenAna })
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual(INDICES[nome])
    expect(r.corpo.indice).toBe(nome.toUpperCase())
    expect(r.corpo.unidade).toBe('% a.a.')
    expect(r.corpo.sugestao).toEqual({ data_referencia: expect.any(String), valor: expect.any(Number) })
    expect(r.corpo.desatualizado).toBe(false)
  })

  it.each(['selic', 'CDI', 'Ipca', 'xyz'])('índice "%s" -> 404 "Índice não encontrado"', async (nome) => {
    const r = await chamar('GET', `/indices/${nome}`, { token: tokenAna })
    expect(r.status).toBe(404)
    expect(r.corpo).toEqual({ erro: 'Índice não encontrado' })
  })

  it.each(['1m', '3m', '6m', '12m', '24m', '60m'])('período %s é aceito', async (periodo) => {
    expect((await chamar('GET', `/indices/cdi?periodo=${periodo}`, { token: tokenAna })).status).toBe(200)
  })

  // Mensagens literais, copiadas do backend real (2026-09-26): a referência não é o handler.
  const MENSAGEM_PERIODO = 'O período deve ser um destes: 1m, 3m, 6m, 12m, 24m, 60m.'

  it.each([['2m'], ['12M'], [''], ['abc']])('período "%s" -> 422 com a mensagem real', async (periodo) => {
    const r = await chamar('GET', `/indices/cdi?periodo=${periodo}`, { token: tokenAna })
    expect(r.status).toBe(422)
    expect(r.corpo).toEqual({ erro: 'Dados inválidos', detalhes: { periodo: [MENSAGEM_PERIODO] } })
  })

  it('período repetido -> 422 "Informe o parâmetro uma única vez."', async () => {
    const r = await chamar('GET', '/indices/cdi?periodo=12m&periodo=6m', { token: tokenAna })
    expect(r.status).toBe(422)
    expect(r.corpo).toEqual({
      erro: 'Dados inválidos',
      detalhes: { periodo: ['Informe o parâmetro uma única vez.'] },
    })
  })

  it('parâmetro desconhecido -> 422 "Campo desconhecido." (chave = o nome do parâmetro)', async () => {
    const r = await chamar('GET', '/indices/cdi?foo=1', { token: tokenAna })
    expect(r.status).toBe(422)
    expect(r.corpo).toEqual({ erro: 'Dados inválidos', detalhes: { foo: ['Campo desconhecido.'] } })
  })

  it('parâmetro desconhecido junto com período válido: só o desconhecido é recusado (controle)', async () => {
    const r = await chamar('GET', '/indices/cdi?periodo=1m&foo=1', { token: tokenAna })
    expect(r.status).toBe(422)
    expect(r.corpo.detalhes).toEqual({ foo: ['Campo desconhecido.'] })
  })

  it('sem parâmetros e com só periodo=1m continuam 200 (controle)', async () => {
    expect((await chamar('GET', '/indices/cdi', { token: tokenAna })).status).toBe(200)
    expect((await chamar('GET', '/indices/ipca?periodo=1m', { token: tokenAna })).status).toBe(200)
  })

  it('ordem: o 404 do índice vem antes do 422 do período', async () => {
    const r = await chamar('GET', '/indices/selic?periodo=xx&foo=1', { token: tokenAna })
    expect(r.status).toBe(404)
    expect(r.corpo).toEqual({ erro: 'Índice não encontrado' })
  })

  describe('atalhos de teste', () => {
    it('indiceIndisponivel: 503 com a mensagem do backend', async () => {
      servidor.use(indiceIndisponivel())
      const r = await chamar('GET', '/indices/cdi', { token: tokenAna })
      expect(r.status).toBe(503)
      expect(r.corpo).toEqual({ erro: 'Dados do Banco Central indisponíveis no momento' })
    })

    it('indiceDesatualizado: 200 com desatualizado true e o resto igual à fixture', async () => {
      servidor.use(indiceDesatualizado())
      const r = await chamar('GET', '/indices/ipca', { token: tokenAna })
      expect(r.status).toBe(200)
      expect(r.corpo.desatualizado).toBe(true)
      expect({ ...r.corpo, desatualizado: false }).toEqual(INDICES.ipca)
    })

    it('indiceSemSugestao: 200 com sugestao null', async () => {
      servidor.use(indiceSemSugestao())
      const r = await chamar('GET', '/indices/cdi', { token: tokenAna })
      expect(r.status).toBe(200)
      expect(r.corpo.sugestao).toBeNull()
      expect(r.corpo.pontos).toEqual(INDICES.cdi.pontos)
    })

    it('sem atalho, o comportamento volta ao normal (controle)', async () => {
      const r = await chamar('GET', '/indices/cdi', { token: tokenAna })
      expect(r.status).toBe(200)
      expect(r.corpo.desatualizado).toBe(false)
      expect(r.corpo.sugestao).not.toBeNull()
    })
  })
})

// Acesso e atalhos do /parcelas, com os literais do backend REAL (conta descartável, 2026-09-27): a referência são estes
// literais, nunca o próprio handler.
describe('GET /simulacoes/:id/financiamentos/:fid/parcelas igual ao backend real', () => {
  const caminho = (simulacaoId = cenario.simulacao.id, fid = cenario.financiamentos[0].id) =>
    `/simulacoes/${simulacaoId}/financiamentos/${fid}/parcelas`
  const consultar = (url = caminho(), token = tokenAna) => chamar('GET', url, { token })

  it('401 sem token', async () => {
    expect((await chamar('GET', caminho())).status).toBe(401)
  })

  it.each([
    ['simulação inexistente', () => caminho(999999), 'Simulação não encontrada'],
    ['simulação com id 0', () => caminho(0), 'Simulação não encontrada'],
    ['opção inexistente', () => caminho(undefined, 999999), 'Opção de financiamento não encontrada'],
    ['opção com id 0', () => caminho(undefined, 0), 'Opção de financiamento não encontrada'],
    ['simulação com id não numérico', () => caminho('abc'), 'Recurso não encontrado'],
    ['opção com id não numérico', () => caminho(undefined, 'abc'), 'Recurso não encontrado'],
  ])('%s -> 404 "%s"', async (_rotulo, url, mensagem) => {
    const r = await consultar(url())
    expect(r.status).toBe(404)
    expect(r.corpo).toEqual({ erro: mensagem })
  })

  it('a simulação de OUTRA pessoa dá o mesmo 404 da inexistente', async () => {
    const r = await consultar(caminho(), tokenBia)
    expect(r.status).toBe(404)
    expect(r.corpo).toEqual({ erro: 'Simulação não encontrada' })
  })

  it('a opção de OUTRA simulação (da mesma dona) dá o 404 da opção inexistente', async () => {
    const outra = criarSimulacao(ana.id)
    const r = await consultar(caminho(outra.id, cenario.financiamentos[0].id))
    expect(r.status).toBe(404)
    expect(r.corpo).toEqual({ erro: 'Opção de financiamento não encontrada' })
  })

  it('a ordem é 401 -> simulação -> opção (simulação e opção inexistentes juntas dão o 404 da simulação)', async () => {
    const r = await consultar(caminho(999999, 999999))
    expect(r.corpo).toEqual({ erro: 'Simulação não encontrada' })
  })

  it('parâmetros de consulta são IGNORADOS (200 com ?foo=1), ao contrário do /resultado', async () => {
    const r = await consultar(`${caminho()}?foo=1`)
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual(FIXTURES_DE_PARCELAS.price)
  })

  it('Price devolve a fixture Price e SAC devolve a SAC (controle: são diferentes)', async () => {
    const [price, sac] = cenario.financiamentos
    expect((await consultar(caminho(undefined, price.id))).corpo).toEqual(FIXTURES_DE_PARCELAS.price)
    expect((await consultar(caminho(undefined, sac.id))).corpo).toEqual(FIXTURES_DE_PARCELAS.sac)
    expect(FIXTURES_DE_PARCELAS.price).not.toEqual(FIXTURES_DE_PARCELAS.sac)
  })

  describe('atalhos de teste', () => {
    it.each([
      ['parcelasSemJuros', parcelasSemJuros, FIXTURES_DE_PARCELAS.semJuros],
      ['parcelasDeUmMes', parcelasDeUmMes, FIXTURES_DE_PARCELAS.umMes],
      ['parcelasDeCentavos', parcelasDeCentavos, FIXTURES_DE_PARCELAS.centavos],
      ['parcelasQuitacaoAntecipada', parcelasQuitacaoAntecipada, FIXTURES_DE_PARCELAS.quitacaoAntecipada],
    ])('%s devolve a fixture real correspondente', async (_nome, atalho, fixture) => {
      servidor.use(atalho())
      const r = await consultar()
      expect(r.status).toBe(200)
      expect(r.corpo).toEqual(fixture)
      expect(r.corpo).not.toEqual(FIXTURES_DE_PARCELAS.price)
    })

    it('os atalhos mantêm as regras de acesso (401 e os dois 404)', async () => {
      servidor.use(parcelasSemJuros())
      expect((await chamar('GET', caminho())).status).toBe(401)
      expect((await consultar(caminho(999999))).corpo).toEqual({ erro: 'Simulação não encontrada' })
      expect((await consultar(caminho(undefined, 999999))).corpo).toEqual({ erro: 'Opção de financiamento não encontrada' })
      expect((await consultar(caminho(), tokenBia)).status).toBe(404)
    })

    it('parcelasIndisponivel: 503 com a mensagem genérica', async () => {
      servidor.use(parcelasIndisponivel())
      const r = await consultar()
      expect(r.status).toBe(503)
      expect(r.corpo).toEqual({ erro: 'Serviço indisponível' })
    })

    it('sem atalho, o comportamento volta ao normal (controle)', async () => {
      expect((await consultar()).corpo).toEqual(FIXTURES_DE_PARCELAS.price)
    })
  })
})
