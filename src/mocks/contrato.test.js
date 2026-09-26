// @vitest-environment node
// Proteção contra a deriva dos mocks: cada resposta dos handlers tem de ter EXATAMENTE as chaves do contrato.
import { beforeEach, describe, expect, it } from 'vitest'
import { criarUsuario, semearCenarioPadrao, tokenDe } from './banco.js'
import { chamar } from './chamar.js'
import { CONTRATO } from './contrato.js'
import resultado from './fixtures/resultado.json'
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
