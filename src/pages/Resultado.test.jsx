import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarSimulacao, criarUsuario, semearCenarioPadrao, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { FIXTURES_DE_RESULTADO, resultadoFundoVence, resultadoIndisponivel, resultadoSemOpcoes, resultadoTresOpcoes } from '../mocks/handlers/resultado.js'
import { servidor } from '../mocks/servidor.js'
import App from '../App.jsx'
import { criarQueryClient } from '../queryClient.js'
import { renderizarComAuth } from '../testUtils.jsx'
import Resultado from './Resultado.jsx'

// O jsdom não mede o layout: o ResponsiveContainer recebe um tamanho fixo (o gráfico é o de verdade).
vi.mock('recharts', async (importarOriginal) => {
  const real = await importarOriginal()
  const { cloneElement } = await import('react')
  return { ...real, ResponsiveContainer: ({ children }) => cloneElement(children, { width: 800, height: 320 }) }
})

const BASE = 'http://localhost:5000/api'
const norm = (texto) => texto.replaceAll(' ', ' ')

let ana
let bia
let token
let sim

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  bia = criarUsuario({ nome: 'Bia', email: 'bia@example.com' })
  token = tokenDe(ana)
  sim = semearCenarioPadrao(ana.id).simulacao
})

function abrir(id = sim.id, opcoes = {}) {
  return renderizarComAuth(
    <Routes>
      <Route path="/simulacoes/:id/resultado" element={<Resultado />} />
    </Routes>,
    { rota: `/simulacoes/${id}/resultado`, token, ...opcoes },
  )
}

const h1 = () => screen.findByRole('heading', { level: 1 })
const cartoes = () => screen.getAllByRole('article').map((c) => within(c).getByRole('heading', { level: 3 }).textContent)
const destacados = () =>
  screen
    .getAllByRole('article')
    .filter((c) => within(c).queryByText('Menor custo'))
    .map((c) => within(c).getByRole('heading', { level: 3 }).textContent)
const esperarTela = () => screen.findByRole('heading', { level: 2, name: 'Evolução mês a mês' })

describe('Resultado: carregando e sucesso', () => {
  it('mostra o esqueleto enquanto carrega (controle: depois aparecem os cartões)', async () => {
    let liberar
    const comporta = new Promise((resolver) => { liberar = resolver })
    servidor.use(
      http.get(`${BASE}/simulacoes/${sim.id}/resultado`, async () => {
        await comporta
        return HttpResponse.json(FIXTURES_DE_RESULTADO.padrao)
      }),
    )
    abrir()
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    liberar()
    await esperarTela()
    expect(screen.queryByRole('status', { name: 'Carregando' })).not.toBeInTheDocument()
    expect(cartoes()).toHaveLength(4)
  })

  it('cabeçalho: nome do eco da simulação, dados formatados e os links', async () => {
    abrir()
    expect(await h1()).toHaveTextContent('Resultado: Carro de exemplo')
    expect(norm(screen.getByText('Valor do veículo', { selector: 'dt' }).nextElementSibling.textContent)).toBe('R$ 95.000,00')
    const texto = norm(screen.getByLabelText('Dados da simulação').textContent)
    expect(texto).toContain('EntradaR$ 20.000,00')
    expect(texto).toContain('Rendimento do fundo12,00% a.a.')
    expect(texto).toContain('IPCA projetado4,50% a.a.')
    expect(texto).toContain('Prazo do fundo36 meses')
    expect(screen.getByRole('link', { name: 'Editar simulação' })).toHaveAttribute('href', `/simulacoes/${sim.id}/editar`)
    expect(screen.getByRole('link', { name: 'Voltar ao histórico' })).toHaveAttribute('href', '/simulacoes')
  })

  it('cartões (à vista, 2 financiamentos, fundo), destaque no à vista e o gráfico', async () => {
    abrir()
    await esperarTela()
    expect(cartoes()).toEqual(['Compra à vista', 'Banco Exemplo Price 48x', 'Banco Exemplo SAC 36x', 'Fundo de investimento'])
    expect(destacados()).toEqual(['Compra à vista'])
    expect(screen.getByText(/O custo total é o que se paga pelo carro/)).toBeInTheDocument()
    expect(document.querySelectorAll('path.recharts-line-curve')).toHaveLength(4)
  })

  it('os números na tela são a formatação do que a API traz (nada recalculado): custos das fixtures', async () => {
    abrir()
    await esperarTela()
    const custo = (nome) => norm(within(screen.getByRole('article', { name: nome })).getByText('Custo total').nextElementSibling.textContent)
    expect(custo('Compra à vista')).toBe('R$ 95.000,00')
    expect(custo('Banco Exemplo Price 48x')).toBe('R$ 125.750,09')
    expect(custo('Banco Exemplo SAC 36x')).toBe('R$ 111.835,04')
    expect(custo('Fundo de investimento')).toBe('R$ 108.410,78')
  })

  it('3 opções com prazos diferentes: 5 cartões e 5 linhas no gráfico', async () => {
    servidor.use(resultadoTresOpcoes())
    abrir()
    await esperarTela()
    expect(cartoes()).toHaveLength(5)
    expect(document.querySelectorAll('path.recharts-line-curve')).toHaveLength(5)
  })

  it('sem opções: só à vista e fundo, com o convite para adicionar opções', async () => {
    servidor.use(resultadoSemOpcoes())
    abrir()
    await esperarTela()
    expect(cartoes()).toEqual(['Compra à vista', 'Fundo de investimento'])
    expect(screen.getByRole('link', { name: 'Adicionar opções' })).toHaveAttribute('href', `/simulacoes/${sim.id}/editar`)
    expect(document.querySelectorAll('path.recharts-line-curve')).toHaveLength(2)
  })

  it('o fundo vence (IPCA negativo): o destaque vai para o fundo (controle do anterior)', async () => {
    servidor.use(resultadoFundoVence())
    abrir()
    await esperarTela()
    expect(destacados()).toEqual(['Fundo de investimento'])
  })
})

describe('Resultado: erros', () => {
  it('erro 503: mensagem clara e Tentar de novo, que carrega quando o servidor volta', async () => {
    servidor.use(resultadoIndisponivel())
    abrir()
    expect(await screen.findByText('Não foi possível carregar o resultado')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Serviço indisponível')

    servidor.resetHandlers(...handlers)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await esperarTela()
    expect(cartoes()).toHaveLength(4)
  })

  it('servidor fora do ar: a mensagem própria de rede', async () => {
    servidor.use(http.get(`${BASE}/simulacoes/${sim.id}/resultado`, () => HttpResponse.error()))
    abrir()
    expect(await screen.findByText('Não foi possível carregar o resultado')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
  })

  it('erro 5xx com o cache de produção repete UMA vez antes de mostrar o erro', async () => {
    let chamadas = 0
    servidor.use(
      http.get(`${BASE}/simulacoes/${sim.id}/resultado`, () => {
        chamadas += 1
        return respostaErro(503, 'Serviço indisponível')
      }),
    )
    abrir(sim.id, { queryClient: criarQueryClient({ retryDelay: 0 }) })
    await screen.findByText('Não foi possível carregar o resultado')
    expect(chamadas).toBe(2)
  })

  it('id inexistente e simulação de OUTRA pessoa mostram o MESMO estado "Simulação não encontrada"', async () => {
    const dela = criarSimulacao(bia.id, { nome: 'Da Bia' })
    const { unmount } = abrir(999999)
    expect(await screen.findByRole('heading', { level: 1, name: 'Simulação não encontrada' })).toBeInTheDocument()
    const inexistente = document.body.textContent
    unmount()

    abrir(dela.id)
    expect(await screen.findByRole('heading', { level: 1, name: 'Simulação não encontrada' })).toBeInTheDocument()
    expect(document.body.textContent).toBe(inexistente)
    expect(screen.queryByText(/Da Bia/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao histórico' })).toHaveAttribute('href', '/simulacoes')
  })

  it('id não numérico ("abc"): também "Simulação não encontrada" (o backend responde "Recurso não encontrado")', async () => {
    abrir('abc')
    expect(await screen.findByRole('heading', { level: 1, name: 'Simulação não encontrada' })).toBeInTheDocument()
  })
})

describe('Resultado: sessão', () => {
  it('um 401 do resultado (token expirado) encerra a sessão e leva ao login, como nas outras telas', async () => {
    servidor.use(http.get(`${BASE}/simulacoes/${sim.id}/resultado`, () => respostaErro(401, 'Token expirado')))
    renderizarComAuth(<App />, { rota: `/simulacoes/${sim.id}/resultado`, token })
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('Não foi possível carregar o resultado')).not.toBeInTheDocument()
  })

  it('controle: com a sessão válida a mesma rota mostra o resultado', async () => {
    renderizarComAuth(<App />, { rota: `/simulacoes/${sim.id}/resultado`, token })
    expect(await screen.findByRole('heading', { level: 2, name: 'Custo de cada cenário' })).toBeInTheDocument()
    await esperarTela()
  })
})

// ---- O "e se eu guardar X por mês?" no endereço --------------------------------------------------------------------
function Sonda() {
  const { search } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <p data-testid="endereco">{search}</p>
      <button onClick={() => navigate(-1)}>voltar do navegador</button>
    </>
  )
}

describe('Resultado: aporte no endereço', () => {
  let chamadas

  beforeEach(() => {
    chamadas = []
    servidor.events.on('request:start', ({ request }) => {
      const url = new URL(request.url)
      if (url.pathname.endsWith('/resultado')) chamadas.push(url)
    })
  })
  afterEach(() => servidor.events.removeAllListeners())

  const aportesEnviados = () => chamadas.map((u) => u.searchParams.get('aporte_mensal'))
  const endereco = () => screen.getByTestId('endereco').textContent
  const campo = () => screen.getByLabelText('E se eu guardar (R$ por mês)?')
  const simular = () => screen.getByRole('button', { name: /^Simular$|^Simulando/ })
  const fundo = () => screen.getByRole('article', { name: 'Fundo de investimento' })

  function abrirComAporte(consulta = '', opcoes = {}) {
    return renderizarComAuth(
      <Routes>
        <Route
          path="/simulacoes/:id/resultado"
          element={
            <>
              <Sonda />
              <Resultado />
            </>
          }
        />
      </Routes>,
      { rota: `/simulacoes/${sim.id}/resultado${consulta}`, token, ...opcoes },
    )
  }

  it('o campo do aporte fica DENTRO do cartão do fundo, vazio, sem chamar com aporte (controle)', async () => {
    abrirComAporte()
    await esperarTela()
    expect(within(fundo()).getByLabelText('E se eu guardar (R$ por mês)?')).toHaveValue('')
    expect(within(screen.getByRole('article', { name: 'Compra à vista' })).queryByLabelText(/E se eu guardar/)).not.toBeInTheDocument()
    expect(aportesEnviados()).toEqual([null])
  })

  it('?aporte_mensal=1500 busca COM o aporte e mostra "alcança a meta no mês 44", com o valor no campo', async () => {
    abrirComAporte('?aporte_mensal=1500')
    await esperarTela()
    expect(aportesEnviados()).toEqual(['1500'])
    expect(within(fundo()).getByText('Alcança a meta no mês 44.')).toBeInTheDocument()
    expect(campo()).toHaveValue('1500')
    expect(within(fundo()).getByRole('button', { name: 'Voltar ao valor calculado' })).toBeInTheDocument()
  })

  it('?aporte_mensal=100: "não alcança a meta em 60 meses", custo do fundo "—" e o fundo fora do destaque', async () => {
    abrirComAporte('?aporte_mensal=100')
    await esperarTela()
    expect(within(fundo()).getByText('Não alcança a meta em 60 meses.')).toBeInTheDocument()
    expect(norm(within(fundo()).getByText('Custo total').nextElementSibling.textContent)).toBe('—')
    expect(destacados()).toEqual(['Compra à vista'])
    expect(destacados()).not.toContain('Fundo de investimento')
  })

  it('?aporte_mensal=0 é um aporte válido (vai ao servidor) e não alcança a meta', async () => {
    abrirComAporte('?aporte_mensal=0')
    await esperarTela()
    expect(aportesEnviados()).toEqual(['0'])
    expect(campo()).toHaveValue('0')
  })

  it('simular pelo campo põe o aporte no endereço (vírgula legível, sem milhar) e ENVIA o número com ponto', async () => {
    abrirComAporte()
    await esperarTela()
    await userEvent.type(campo(), '1.500,50')
    await userEvent.click(simular())
    await waitFor(() => expect(endereco()).toBe('?aporte_mensal=1500,5'))
    await waitFor(() => expect(within(fundo()).getByText('Alcança a meta no mês 44.')).toBeInTheDocument())
    expect(aportesEnviados()).toEqual([null, '1500.5'])
    expect(chamadas.at(-1).search).not.toContain(',')
  })

  it('o resultado anterior fica na tela enquanto o novo carrega e o campo não perde o que foi digitado', async () => {
    abrirComAporte()
    await esperarTela()
    let liberar
    const comporta = new Promise((resolver) => { liberar = resolver })
    servidor.use(
      http.get(`${BASE}/simulacoes/${sim.id}/resultado`, async ({ request }) => {
        if (new URL(request.url).searchParams.has('aporte_mensal')) await comporta
        return HttpResponse.json(FIXTURES_DE_RESULTADO.aporteQueAlcanca)
      }),
    )
    await userEvent.type(campo(), '1500')
    await userEvent.click(simular())
    expect(await screen.findByRole('button', { name: 'Simulando…' })).toBeDisabled()
    expect(cartoes()).toHaveLength(4) // os cartões continuam
    expect(campo()).toHaveValue('1500')
    liberar()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Simular' })).toBeEnabled())
  })

  it('"Voltar ao valor calculado" tira o parâmetro e volta ao padrão SEM nova chamada (cache de 30 s); controle: com o cache limpo faz a chamada', async () => {
    const queryClient = criarQueryClient({ retryDelay: 0 })
    abrirComAporte('', { queryClient })
    await esperarTela()
    await userEvent.type(campo(), '1500')
    await userEvent.click(simular())
    await waitFor(() => expect(within(fundo()).getByText('Alcança a meta no mês 44.')).toBeInTheDocument())
    expect(chamadas).toHaveLength(2)

    await userEvent.click(within(fundo()).getByRole('button', { name: 'Voltar ao valor calculado' }))
    await waitFor(() => expect(endereco()).toBe(''))
    await waitFor(() => expect(within(fundo()).getByText('Alcança a meta no mês 36.')).toBeInTheDocument())
    expect(chamadas).toHaveLength(2) // veio do cache
    expect(campo()).toHaveValue('')
    expect(within(fundo()).queryByRole('button', { name: 'Voltar ao valor calculado' })).not.toBeInTheDocument()
  })

  it('controle do cache: com o resultado padrão removido do cache, voltar ao valor calculado busca de novo', async () => {
    const queryClient = criarQueryClient({ retryDelay: 0 })
    abrirComAporte('', { queryClient })
    await esperarTela()
    await userEvent.type(campo(), '1500')
    await userEvent.click(simular())
    await waitFor(() => expect(within(fundo()).getByText('Alcança a meta no mês 44.')).toBeInTheDocument())
    queryClient.removeQueries({ queryKey: ['simulacoes', String(sim.id), 'resultado'], exact: true })
    await userEvent.click(within(fundo()).getByRole('button', { name: 'Voltar ao valor calculado' }))
    await waitFor(() => expect(chamadas).toHaveLength(3))
  })

  it('o Voltar do navegador desfaz o aporte (o endereço e o campo acompanham)', async () => {
    abrirComAporte()
    await esperarTela()
    await userEvent.type(campo(), '1500')
    await userEvent.click(simular())
    await waitFor(() => expect(endereco()).toBe('?aporte_mensal=1500'))
    await waitFor(() => expect(campo()).toHaveValue('1500'))

    await userEvent.click(screen.getByRole('button', { name: 'voltar do navegador' }))
    await waitFor(() => expect(endereco()).toBe(''))
    await waitFor(() => expect(campo()).toHaveValue(''))
    expect(within(fundo()).getByText('Alcança a meta no mês 36.')).toBeInTheDocument()
  })

  it('o aporte do endereço sobrevive a recarregar a página (nova montagem com o mesmo endereço)', async () => {
    const primeira = abrirComAporte('?aporte_mensal=1500,5')
    await esperarTela()
    expect(campo()).toHaveValue('1500,5')
    primeira.unmount()

    abrirComAporte('?aporte_mensal=1500,5')
    await esperarTela()
    expect(campo()).toHaveValue('1500,5')
    expect(within(fundo()).getByText('Alcança a meta no mês 44.')).toBeInTheDocument()
    expect(aportesEnviados().at(-1)).toBe('1500.5')
  })

  it.each([
    ['1500.5', 'Use vírgula para decimais'],
    ['abc', 'Use vírgula para decimais'],
    ['-1', 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.'],
    ['9999999,01', 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.'],
    ['1500,505', 'Use no máximo 2 casas decimais.'],
    ['', 'Informe quanto você guardaria por mês.'],
  ])('endereço com aporte inválido "%s": aviso no campo, resultado padrão e NENHUMA chamada com aporte', async (texto, aviso) => {
    abrirComAporte(`?aporte_mensal=${encodeURIComponent(texto)}`)
    await esperarTela()
    expect(screen.getByText(new RegExp(aviso.replace(/[()]/g, '\\$&')))).toBeInTheDocument()
    expect(campo()).toHaveAttribute('aria-invalid', 'true')
    expect(campo()).toHaveValue(texto)
    expect(within(fundo()).getByText('Alcança a meta no mês 36.')).toBeInTheDocument() // o padrão
    expect(aportesEnviados()).toEqual([null]) // só a chamada sem aporte
  })

  it('controle do anterior: o mesmo endereço com um aporte VÁLIDO chama com o aporte', async () => {
    abrirComAporte('?aporte_mensal=1500')
    await esperarTela()
    expect(aportesEnviados()).toEqual(['1500'])
  })

  it('aporte inválido digitado no campo: mensagem no campo, endereço e resultado intactos, nenhuma chamada nova', async () => {
    abrirComAporte()
    await esperarTela()
    await userEvent.type(campo(), '10.000.000')
    await userEvent.click(simular())
    expect(screen.getByText('O aporte mensal deve estar entre 0,00 e 9.999.999,00.')).toBeInTheDocument()
    expect(endereco()).toBe('')
    expect(aportesEnviados()).toEqual([null])
  })

  it('"Voltar ao valor calculado" com o aporte inválido no endereço limpa o aviso e o endereço', async () => {
    abrirComAporte('?aporte_mensal=abc')
    await esperarTela()
    await userEvent.click(within(fundo()).getByRole('button', { name: 'Voltar ao valor calculado' }))
    await waitFor(() => expect(endereco()).toBe(''))
    expect(campo()).toHaveValue('')
    expect(campo()).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('outros parâmetros do endereço são preservados ao simular', async () => {
    abrirComAporte('?foo=1')
    await esperarTela()
    await userEvent.type(campo(), '1500')
    await userEvent.click(simular())
    await waitFor(() => expect(endereco()).toBe('?foo=1&aporte_mensal=1500'))
  })

  it('422 do servidor (as regras mudaram): o resultado padrão fica na tela e a mensagem aparece NO CAMPO', async () => {
    servidor.use(
      http.get(`${BASE}/simulacoes/${sim.id}/resultado`, ({ request }) => {
        if (new URL(request.url).searchParams.has('aporte_mensal')) {
          return HttpResponse.json(
            { erro: 'Dados inválidos', detalhes: { aporte_mensal: ['O aporte mensal deve estar entre 0,00 e 9.999.999,00.'] } },
            { status: 422 },
          )
        }
        return HttpResponse.json(FIXTURES_DE_RESULTADO.padrao)
      }),
    )
    abrirComAporte('?aporte_mensal=1500')
    expect(await screen.findByText('O aporte mensal deve estar entre 0,00 e 9.999.999,00.')).toBeInTheDocument()
    expect(campo()).toHaveAttribute('aria-invalid', 'true')
    expect(cartoes()).toHaveLength(4)
    expect(within(fundo()).getByText('Alcança a meta no mês 36.')).toBeInTheDocument()
  })
})
