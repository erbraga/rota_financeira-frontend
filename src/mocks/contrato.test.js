// @vitest-environment node
// Proteção contra a deriva dos mocks: cada resposta dos handlers tem de ter EXATAMENTE as chaves do contrato.
import { beforeEach, describe, expect, it } from 'vitest'
import { criarUsuario, semearCenarioPadrao, tokenDe } from './banco.js'
import { chamar } from './chamar.js'
import { CONTRATO } from './contrato.js'
import resultado from './fixtures/resultado.json'
import resultadoAporte from './fixtures/resultado-aporte.json'
import resultadoAporteInsuficiente from './fixtures/resultado-aporte-insuficiente.json'
import resultadoFundoVence from './fixtures/resultado-fundo-vence.json'
import resultadoSemOpcoes from './fixtures/resultado-sem-opcoes.json'
import resultadoTresOpcoes from './fixtures/resultado-tres-opcoes.json'
import { handlers } from './handlers/index.js'
import { indiceSemSugestao } from './handlers/indices.js'
import { servidor } from './servidor.js'

// Falha se o objeto tiver chave a mais ou a menos em relação ao contrato.
function conferirChaves(objeto, nome) {
  expect(Object.keys(objeto).sort(), `chaves de ${nome}`).toEqual([...CONTRATO[nome]].sort())
}

let token
let idSimulacao

beforeEach(() => {
  servidor.use(...handlers)
  const usuario = criarUsuario({ email: 'ana@example.com' })
  token = tokenDe(usuario)
  idSimulacao = semearCenarioPadrao(usuario.id).simulacao.id
})

describe('conferirChaves detecta deriva (controle do teste de formato)', () => {
  it('falha com uma chave a menos', () => {
    const { mes: _removida, ...semMes } = resultado.series[0]
    expect(() => conferirChaves(semMes, 'PontoSerie')).toThrow()
  })

  it('falha com uma chave a mais', () => {
    expect(() => conferirChaves({ ...resultado.simulacao, usuario_id: 1 }, 'SimulacaoNoResultado')).toThrow()
  })

  it('passa com o objeto certo', () => {
    expect(() => conferirChaves(resultado.series[0], 'PontoSerie')).not.toThrow()
  })
})

// Todas as fixtures de /resultado (capturadas do backend real) têm as chaves do contrato em todos os blocos.
const FIXTURES_DE_RESULTADO = {
  padrao: resultado,
  'aporte que alcança a meta': resultadoAporte,
  'aporte que não alcança': resultadoAporteInsuficiente,
  'sem opções': resultadoSemOpcoes,
  'três opções (prazos 48, 36 e 72)': resultadoTresOpcoes,
  'o fundo vence': resultadoFundoVence,
}

describe('fixtures de /resultado', () => {
  it.each(Object.entries(FIXTURES_DE_RESULTADO))('%s: todos os blocos com as chaves do contrato', (_nome, corpo) => {
    conferirChaves(corpo, 'Resultado')
    conferirChaves(corpo.simulacao, 'SimulacaoNoResultado')
    conferirChaves(corpo.cenarios, 'Cenarios')
    conferirChaves(corpo.cenarios.a_vista, 'AVista')
    conferirChaves(corpo.cenarios.fundo, 'ResultadoFundo')
    conferirChaves(corpo.menor_custo, 'MenorCusto')
    for (const financiamento of corpo.cenarios.financiamentos) conferirChaves(financiamento, 'ResultadoFinanciamento')
    for (const ponto of corpo.series) conferirChaves(ponto, 'PontoSerie')
  })

  it('as séries têm um ponto por mês, do mês 0 ao maior prazo, e o saldo_devedor tem uma chave por opção (id como texto)', () => {
    const esperado = { 'sem opções': 37, 'três opções (prazos 48, 36 e 72)': 73, 'o fundo vence': 37, padrao: 49 }
    for (const [nome, pontos] of Object.entries(esperado)) {
      const corpo = FIXTURES_DE_RESULTADO[nome]
      expect(corpo.series, nome).toHaveLength(pontos)
      expect(corpo.series.map((p) => p.mes), nome).toEqual(Array.from({ length: pontos }, (_, mes) => mes))
      const ids = corpo.cenarios.financiamentos.map((f) => String(f.id)).sort()
      for (const ponto of corpo.series) expect(Object.keys(ponto.saldo_devedor).sort(), nome).toEqual(ids)
    }
  })

  it('sem opções: saldo_devedor vem vazio ({}) e a lista de financiamentos também', () => {
    expect(resultadoSemOpcoes.cenarios.financiamentos).toEqual([])
    expect(resultadoSemOpcoes.series.every((p) => Object.keys(p.saldo_devedor).length === 0)).toBe(true)
  })

  it('o vencedor é "a_vista" ou "fundo" (id null); o fundo vence com IPCA negativo', () => {
    expect(resultadoFundoVence.menor_custo).toEqual({ cenario: 'fundo', id: null })
    expect(resultadoFundoVence.simulacao.taxa_ipca_projetada).toBeLessThan(0)
    expect(resultadoTresOpcoes.menor_custo).toEqual({ cenario: 'a_vista', id: null })
  })

  it('o null marca onde a série terminou: saldo do fundo depois do prazo e saldo da opção depois do último mês', () => {
    const tres = resultadoTresOpcoes.series
    expect(tres[36].saldo_fundo).not.toBeNull()
    expect(tres[37].saldo_fundo).toBeNull() // o fundo terminou no mês 36
    expect(tres[36].saldo_devedor['2']).toBe(0) // a SAC de 36 meses termina zerada no mês 36
    expect(tres[37].saldo_devedor['2']).toBeNull() // e depois vem null
    expect(tres[72].saldo_devedor['3']).toBe(0)
    expect(tres.every((p) => p.preco_corrigido !== null)).toBe(true) // o preço corrigido existe em todo o eixo
  })

  it('controle: uma fixture sem a chave saldo_fundo é recusada', () => {
    const { saldo_fundo: _removida, ...semSaldo } = resultadoSemOpcoes.series[0]
    expect(() => conferirChaves(semSaldo, 'PontoSerie')).toThrow()
  })
})

describe('formato das respostas dos handlers', () => {
  it('auth: registro, login e perfil', async () => {
    const registro = await chamar('POST', '/auth/registrar', {
      corpo: { nome: 'Caio', email: 'caio@example.com', senha: 'uma senha longa' },
    })
    conferirChaves(registro.corpo, 'Usuario')

    const login = await chamar('POST', '/auth/login', {
      corpo: { email: 'caio@example.com', senha: 'uma senha longa' },
    })
    conferirChaves(login.corpo, 'LoginResposta')
    conferirChaves(login.corpo.usuario, 'UsuarioResumo')

    conferirChaves((await chamar('GET', '/auth/perfil', { token })).corpo, 'Usuario')
  })

  it('simulações: detalhe, lista e criação', async () => {
    conferirChaves((await chamar('GET', `/simulacoes/${idSimulacao}`, { token })).corpo, 'Simulacao')

    const lista = await chamar('GET', '/simulacoes', { token })
    conferirChaves(lista.corpo, 'Lista')
    conferirChaves(lista.corpo.itens[0], 'Simulacao')

    const criada = await chamar('POST', '/simulacoes', {
      token,
      corpo: {
        nome: 'Nova',
        valor_veiculo: 80000,
        taxa_ipca_projetada: 4,
        taxa_fundo_rendimento: 10,
        prazo_meses_fundo: 24,
      },
    })
    conferirChaves(criada.corpo, 'Simulacao')
    // O Location do backend real é relativo ao servidor.
    expect(criada.cabecalhos.get('Location')).toBe(`/api/simulacoes/${criada.corpo.id}`)
  })

  it('financiamentos: lista e criação', async () => {
    const lista = await chamar('GET', `/simulacoes/${idSimulacao}/financiamentos`, { token })
    conferirChaves(lista.corpo, 'Lista')
    conferirChaves(lista.corpo.itens[0], 'Financiamento')

    const criada = await chamar('POST', `/simulacoes/${idSimulacao}/financiamentos`, {
      token,
      corpo: { nome: 'Extra', taxa_juros_mensal: 1, prazo_meses: 12, sistema_amortizacao: 'sac' },
    })
    conferirChaves(criada.corpo, 'Financiamento')
  })

  it('resultado, com e sem aporte: todos os blocos', async () => {
    for (const consulta of ['', '?aporte_mensal=1500', '?aporte_mensal=100']) {
      const { corpo } = await chamar('GET', `/simulacoes/${idSimulacao}/resultado${consulta}`, { token })
      conferirChaves(corpo, 'Resultado')
      conferirChaves(corpo.simulacao, 'SimulacaoNoResultado')
      conferirChaves(corpo.cenarios, 'Cenarios')
      conferirChaves(corpo.cenarios.a_vista, 'AVista')
      conferirChaves(corpo.cenarios.fundo, 'ResultadoFundo')
      conferirChaves(corpo.menor_custo, 'MenorCusto')
      for (const financiamento of corpo.cenarios.financiamentos) conferirChaves(financiamento, 'ResultadoFinanciamento')
      for (const ponto of corpo.series) conferirChaves(ponto, 'PontoSerie')
    }
  })

  it('parcelas (Price e SAC): cabeçalho, linhas e totais', async () => {
    for (const financiamentoId of [1, 2]) {
      const { corpo } = await chamar('GET', `/simulacoes/${idSimulacao}/financiamentos/${financiamentoId}/parcelas`, {
        token,
      })
      conferirChaves(corpo, 'ParcelasFinanciamento')
      conferirChaves(corpo.financiamento, 'ParcelasCabecalho')
      conferirChaves(corpo.totais, 'ParcelasTotais')
      for (const parcela of corpo.parcelas) conferirChaves(parcela, 'Parcela')
    }
  })

  it('índices (cdi e ipca), inclusive sem sugestão (sugestao anulável)', async () => {
    for (const nome of ['cdi', 'ipca']) {
      const { corpo } = await chamar('GET', `/indices/${nome}`, { token })
      conferirChaves(corpo, 'IndiceEconomico')
      conferirChaves(corpo.periodo, 'IndicePeriodo')
      conferirChaves(corpo.sugestao, 'IndiceSugestao')
      for (const ponto of corpo.pontos) conferirChaves(ponto, 'IndicePonto')
    }

    servidor.use(indiceSemSugestao())
    const semSugestao = await chamar('GET', '/indices/cdi', { token })
    conferirChaves(semSugestao.corpo, 'IndiceEconomico')
    expect(semSugestao.corpo.sugestao).toBeNull()
  })

  it('erros: só { erro }, ou { erro, detalhes } na validação', async () => {
    const naoEncontrada = await chamar('GET', '/simulacoes/999', { token })
    conferirChaves(naoEncontrada.corpo, 'Erro')

    const invalida = await chamar('POST', '/simulacoes', { token, corpo: {} })
    expect(invalida.status).toBe(422)
    conferirChaves(invalida.corpo, 'ErroComDetalhes')

    const semToken = await chamar('GET', '/simulacoes')
    conferirChaves(semToken.corpo, 'Erro')
  })
})
