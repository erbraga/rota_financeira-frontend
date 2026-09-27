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
