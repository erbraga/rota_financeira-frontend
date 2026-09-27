import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { criarFinanciamento, criarSimulacao, criarUsuario, semearCenarioPadrao, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import {
  FIXTURES_DE_PARCELAS,
  parcelasDeCentavos,
  parcelasDeUmMes,
  parcelasIndisponivel,
  parcelasQuitacaoAntecipada,
  parcelasSemJuros,
} from '../mocks/handlers/parcelas.js'
import { servidor } from '../mocks/servidor.js'
import { criarQueryClient } from '../queryClient.js'
import { renderizarComAuth } from '../testUtils.jsx'
import Amortizacao from './Amortizacao.jsx'

// O jsdom não mede o layout: o ResponsiveContainer recebe um tamanho fixo (o gráfico é o de verdade).
vi.mock('recharts', async (importarOriginal) => {
  const real = await importarOriginal()
  const { cloneElement } = await import('react')
  return { ...real, ResponsiveContainer: ({ children }) => cloneElement(children, { width: 800, height: 260 }) }
})

const BASE = 'http://localhost:5000/api'
const norm = (texto) => texto.replaceAll(' ', ' ')

let ana
let bia
let token
let cenario

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  bia = criarUsuario({ nome: 'Bia', email: 'bia@example.com' })
  token = tokenDe(ana)
  cenario = semearCenarioPadrao(ana.id) // simulação 1 com a opção 1 (Price) e a 2 (SAC)
})

const sim = () => cenario.simulacao.id
const [PRICE, SAC] = [1, 2]

function abrir(simulacaoId = sim(), fid = PRICE, opcoes = {}) {
  return renderizarComAuth(
    <Routes>
      <Route path="/simulacoes/:id/financiamentos/:fid" element={<Amortizacao />} />
    </Routes>,
    { rota: `/simulacoes/${simulacaoId}/financiamentos/${fid}`, token, ...opcoes },
  )
}

const esperarTela = () => screen.findByRole('heading', { level: 2, name: 'Parcelas mês a mês' })
const linhas = () => screen.getAllByRole('row').slice(1).map((linha) => Array.from(linha.querySelectorAll('th, td')).map((c) => norm(c.textContent)))
const valorDe = (rotulo) => norm(screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling.textContent)
const NOTA_ZERADAS = 'Parcelas de R$ 0,00 aparecem quando os centavos do saldo já foram quitados.'

describe('Amortizacao: carregando e sucesso', () => {
  it('mostra o esqueleto enquanto carrega (controle: depois aparece a tabela)', async () => {
    let liberar
    const comporta = new Promise((resolver) => { liberar = resolver })
    servidor.use(
      http.get(`${BASE}/simulacoes/${sim()}/financiamentos/${PRICE}/parcelas`, async () => {
        await comporta
        return HttpResponse.json(FIXTURES_DE_PARCELAS.price)
      }),
    )
    abrir()
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    liberar()
    await esperarTela()
    expect(screen.queryByRole('status', { name: 'Carregando' })).not.toBeInTheDocument()
  })

  it('Price: título com o nome da opção, links, resumo com os totais, gráfico e a tabela de 48 linhas', async () => {
    abrir()
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Amortização: Banco Exemplo Price 48x')
    await esperarTela()
    expect(screen.getByRole('link', { name: 'Voltar ao resultado' })).toHaveAttribute('href', `/simulacoes/${sim()}/resultado`)
    expect(screen.getByRole('link', { name: 'Editar simulação' })).toHaveAttribute('href', `/simulacoes/${sim()}/editar`)
    expect(valorDe('Sistema')).toBe('Price')
    expect(valorDe('Taxa de juros')).toBe('1,50% a.m.')
    expect(valorDe('Total pago')).toBe('R$ 105.750,09')
    expect(valorDe('Custo total')).toBe('R$ 125.750,09')
    expect(screen.getByRole('heading', { level: 2, name: 'Juros e amortização de cada parcela' })).toBeInTheDocument()
    expect(linhas()).toHaveLength(48)
    expect(linhas()[0]).toEqual(['1', 'R$ 2.203,12', 'R$ 1.125,00', 'R$ 1.078,12', 'R$ 73.921,88'])
    expect(linhas().at(-1)).toEqual(['48', 'R$ 2.203,45', 'R$ 32,56', 'R$ 2.170,89', 'R$ 0,00'])
    expect(document.querySelectorAll('.recharts-bar')).toHaveLength(2)
  })

  it('SAC (opção 2): a fixture da SAC, 36 linhas e o nome dela', async () => {
    abrir(sim(), SAC)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Amortização: Banco Exemplo SAC 36x')
    await esperarTela()
    expect(valorDe('Sistema')).toBe('SAC')
    expect(linhas()).toHaveLength(36)
    expect(linhas()[0]).toEqual(['1', 'R$ 2.854,44', 'R$ 910,00', 'R$ 1.944,44', 'R$ 68.055,56'])
  })

  it('a ordem de leitura é resumo, gráfico e tabela', async () => {
    abrir()
    await esperarTela()
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Resumo do financiamento', 'Juros e amortização de cada parcela', 'Parcelas mês a mês'])
  })

  it('parâmetros de consulta no endereço (?foo=1) são ignorados', async () => {
    renderizarComAuth(
      <Routes>
        <Route path="/simulacoes/:id/financiamentos/:fid" element={<Amortizacao />} />
      </Routes>,
      { rota: `/simulacoes/${sim()}/financiamentos/${PRICE}?foo=1`, token },
    )
    await esperarTela()
    expect(linhas()).toHaveLength(48)
  })
})

describe('Amortizacao: casos extremos', () => {
  it('sem juros: 72 linhas, juros "R$ 0,00" em todas e taxa "0,00% a.m.", sem a nota das parcelas zeradas', async () => {
    servidor.use(parcelasSemJuros())
    abrir()
    await esperarTela()
    expect(linhas()).toHaveLength(72)
    expect(linhas().every((l) => l[2] === 'R$ 0,00')).toBe(true)
    expect(valorDe('Taxa de juros')).toBe('0,00% a.m.')
    expect(screen.queryByText(NOTA_ZERADAS)).not.toBeInTheDocument()
  })

  it('1 mês: uma linha e "1 mês"', async () => {
    servidor.use(parcelasDeUmMes())
    abrir()
    await esperarTela()
    expect(linhas()).toHaveLength(1)
    expect(valorDe('Prazo')).toBe('1 mês')
  })

  it('centavos: 71 linhas de R$ 0,00 e a última de R$ 0,01, com a nota', async () => {
    servidor.use(parcelasDeCentavos())
    abrir()
    await esperarTela()
    expect(linhas().filter((l) => l[1] === 'R$ 0,00')).toHaveLength(71)
    expect(linhas().at(-1)[1]).toBe('R$ 0,01')
    expect(screen.getByText(NOTA_ZERADAS)).toBeInTheDocument()
  })

  it('quitação antecipada: a linha zerada aparece como vem, com a nota', async () => {
    servidor.use(parcelasQuitacaoAntecipada())
    abrir()
    await esperarTela()
    expect(linhas()).toHaveLength(3)
    expect(linhas()[2]).toEqual(['3', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00'])
    expect(screen.getByText(NOTA_ZERADAS)).toBeInTheDocument()
  })

  it('controle: a Price normal não mostra a nota das parcelas zeradas', async () => {
    abrir()
    await esperarTela()
    expect(screen.queryByText(NOTA_ZERADAS)).not.toBeInTheDocument()
  })
})

describe('Amortizacao: erros', () => {
  it('erro 503: mensagem clara e Tentar de novo, que carrega a tabela quando o servidor volta', async () => {
    servidor.use(parcelasIndisponivel())
    abrir()
    expect(await screen.findByText('Não foi possível carregar a tabela de amortização')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Serviço indisponível')

    servidor.resetHandlers(...handlers)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await esperarTela()
    expect(linhas()).toHaveLength(48)
  })

  it('servidor fora do ar: a mensagem própria de rede', async () => {
    servidor.use(http.get(`${BASE}/simulacoes/${sim()}/financiamentos/${PRICE}/parcelas`, () => HttpResponse.error()))
    abrir()
    expect(await screen.findByText('Não foi possível carregar a tabela de amortização')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
  })

  it('erro 5xx com o cache de produção repete UMA vez antes de mostrar o erro', async () => {
    let chamadas = 0
    servidor.use(
      http.get(`${BASE}/simulacoes/${sim()}/financiamentos/${PRICE}/parcelas`, () => {
        chamadas += 1
        return respostaErro(503, 'Serviço indisponível')
      }),
    )
    abrir(sim(), PRICE, { queryClient: criarQueryClient({ retryDelay: 0 }) })
    await screen.findByText('Não foi possível carregar a tabela de amortização')
    expect(chamadas).toBe(2)
  })
})

describe('Amortizacao: os quatro 404 dão o MESMO estado, sem vazar nada', () => {
  // Cada caso desmonta a tela e devolve o texto inteiro do documento.
  async function textoDoCaso(simulacaoId, fid) {
    const { unmount, container } = abrir(simulacaoId, fid)
    expect(await screen.findByRole('heading', { level: 1, name: 'Simulação não encontrada' })).toBeInTheDocument()
    // O contêiner da tela (o body traz o <span> de medição que o Recharts deixa de outros testes).
    const texto = container.textContent
    expect(screen.getByRole('link', { name: 'Voltar ao histórico' })).toHaveAttribute('href', '/simulacoes')
    unmount()
    return texto
  }

  it('simulação inexistente, simulação alheia, opção inexistente e opção de outra simulação', async () => {
    const dela = criarSimulacao(bia.id, { nome: 'Da Bia' })
    const deBia = criarFinanciamento(dela.id, { nome: 'Opção da Bia' })
    const outraDaAna = criarSimulacao(ana.id, { nome: 'Outra da Ana' })

    const inexistente = await textoDoCaso(999999, PRICE)
    const alheia = await textoDoCaso(dela.id, deBia.id)
    const opcaoInexistente = await textoDoCaso(sim(), 999999)
    const opcaoDeOutraSimulacao = await textoDoCaso(outraDaAna.id, PRICE) // a opção 1 é da simulação 1, não desta

    expect(alheia).toBe(inexistente)
    expect(opcaoInexistente).toBe(inexistente)
    expect(opcaoDeOutraSimulacao).toBe(inexistente)
    for (const texto of [inexistente, alheia, opcaoInexistente, opcaoDeOutraSimulacao]) {
      expect(texto).not.toMatch(/Da Bia|Opção da Bia|Outra da Ana|Banco Exemplo|R\$/)
    }
  })

  it('ids não numéricos (abc): também "Simulação não encontrada"', async () => {
    expect(await textoDoCaso('abc', PRICE)).toContain('Simulação não encontrada')
    expect(await textoDoCaso(sim(), 'abc')).toContain('Simulação não encontrada')
  })

  it('controle: a opção certa da simulação certa abre a tabela', async () => {
    abrir()
    await esperarTela()
    expect(screen.queryByRole('heading', { level: 1, name: 'Simulação não encontrada' })).not.toBeInTheDocument()
  })
})

describe('Amortizacao: sessão', () => {
  it('um 401 (token expirado) encerra a sessão e leva ao login, como nas outras telas', async () => {
    servidor.use(http.get(`${BASE}/simulacoes/${sim()}/financiamentos/${PRICE}/parcelas`, () => respostaErro(401, 'Token expirado')))
    renderizarComAuth(<App />, { rota: `/simulacoes/${sim()}/financiamentos/${PRICE}`, token })
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(within(document.body).queryByText('Não foi possível carregar a tabela de amortização')).not.toBeInTheDocument()
  })

  it('controle: com a sessão válida a mesma rota mostra a tabela', async () => {
    renderizarComAuth(<App />, { rota: `/simulacoes/${sim()}/financiamentos/${PRICE}`, token })
    expect(await screen.findByRole('heading', { level: 2, name: 'Parcelas mês a mês' })).toBeInTheDocument()
  })
})
