import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { banco, criarFinanciamento, criarSimulacao, criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { criarQueryClient } from '../queryClient.js'
import { renderizarComAuth } from '../testUtils.jsx'
import SimulacaoForm from './SimulacaoForm.jsx'

const BASE = 'http://localhost:5000/api'

// Mostra o caminho atual e COMO se chegou nele (PUSH, REPLACE ou POP), para provar o "replace" da criação.
function Sonda() {
  const { pathname } = useLocation()
  const tipo = useNavigationType()
  return (
    <>
      <p data-testid="caminho">{pathname}</p>
      <p data-testid="navegacao">{tipo}</p>
    </>
  )
}

function Rotas() {
  return (
    <>
      <Sonda />
      <Routes>
        <Route path="/simulacoes" element={<p>histórico</p>} />
        <Route path="/simulacoes/nova" element={<SimulacaoForm />} />
        <Route path="/simulacoes/:id/editar" element={<SimulacaoForm />} />
        <Route path="/simulacoes/:id/resultado" element={<p>resultado</p>} />
      </Routes>
    </>
  )
}

const R = {
  nome: 'Nome da simulação',
  veiculo: 'Valor do veículo (R$)',
  entrada: 'Valor da entrada (R$)',
  fundo: 'Rendimento do fundo (% a.a.)',
  prazo: 'Prazo para juntar o valor (meses)',
  ipca: 'IPCA projetado (% a.a.)',
}
const campo = (rotulo) => screen.getByLabelText(rotulo)
const caminho = () => screen.getByTestId('caminho').textContent

let ana
let bia
let token
let pedidos

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana Souza', email: 'ana@example.com' })
  bia = criarUsuario({ nome: 'Bia', email: 'bia@example.com' })
  token = tokenDe(ana)
  pedidos = []
  servidor.events.on('request:start', ({ request }) => pedidos.push(`${request.method} ${new URL(request.url).pathname.replace('/api', '')}`))
})

afterEach(() => servidor.events.removeAllListeners())

const abrir = (rota) => renderizarComAuth(<Rotas />, { rota, token })

async function preencherValidos() {
  await userEvent.type(campo(R.nome), 'Onix 2026')
  await userEvent.type(campo(R.veiculo), '95000,5')
  await userEvent.clear(campo(R.entrada))
  await userEvent.type(campo(R.entrada), '20000')
  await userEvent.type(campo(R.fundo), '12')
  await userEvent.type(campo(R.prazo), '36')
  await userEvent.type(campo(R.ipca), '4,5')
}

describe('SimulacaoForm: nova simulação', () => {
  it('mostra o título, o formulário (entrada em 0,00) e o Cancelar que volta ao histórico', () => {
    abrir('/simulacoes/nova')
    expect(screen.getByRole('heading', { level: 1, name: 'Nova simulação' })).toBeInTheDocument()
    expect(campo(R.entrada)).toHaveValue('0,00')
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/simulacoes')
    expect(screen.getByRole('button', { name: 'Criar simulação' })).toBeInTheDocument()
  })

  it('criar: envia o corpo exato, vai para a EDIÇÃO da nova simulação COM REPLACE e mostra "Simulação criada."', async () => {
    abrir('/simulacoes/nova')
    expect(screen.getByTestId('navegacao')).toHaveTextContent('POP')
    await preencherValidos()
    await userEvent.click(screen.getByRole('button', { name: 'Criar simulação' }))

    await waitFor(() => expect(caminho()).toMatch(/^\/simulacoes\/\d+\/editar$/))
    expect(screen.getByTestId('navegacao')).toHaveTextContent('REPLACE')
    expect(await screen.findByText('Simulação criada.')).toBeInTheDocument()

    const criada = banco.simulacoes[0]
    expect(criada).toMatchObject({
      nome: 'Onix 2026',
      valor_veiculo: 95000.5,
      valor_entrada: 20000,
      taxa_ipca_projetada: 4.5,
      taxa_fundo_rendimento: 12,
      prazo_meses_fundo: 36,
      usuario_id: ana.id,
    })
    expect(caminho()).toBe(`/simulacoes/${criada.id}/editar`)
  })

  it('a edição da simulação recém-criada já vem preenchida, SEM buscar o detalhe de novo (está no cache)', async () => {
    // Política de cache de PRODUÇÃO (staleTime de 30 s): o cliente de teste padrão usa staleTime 0 e refaria a busca.
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/nova', token, queryClient: criarQueryClient({ retry: false, gcTime: Infinity }) })
    await preencherValidos()
    await userEvent.click(screen.getByRole('button', { name: 'Criar simulação' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })).toBeInTheDocument()
    expect(campo(R.nome)).toHaveValue('Onix 2026')
    expect(campo(R.veiculo)).toHaveValue('95.000,50')
    expect(campo(R.entrada)).toHaveValue('20.000,00')
    expect(pedidos.filter((p) => /^GET \/simulacoes\/\d+$/.test(p))).toEqual([])
  })

  it('validação no cliente: não chama a API e não navega', async () => {
    abrir('/simulacoes/nova')
    await userEvent.click(screen.getByRole('button', { name: 'Criar simulação' }))
    expect(await screen.findAllByText('Campo obrigatório.')).toHaveLength(5)
    expect(pedidos.filter((p) => p === 'POST /simulacoes')).toEqual([])
    expect(caminho()).toBe('/simulacoes/nova')
  })

  it('422 do servidor: mostra no campo certo, continua na tela e não avisa "criada"', async () => {
    servidor.use(
      http.post(`${BASE}/simulacoes`, () =>
        HttpResponse.json(
          { erro: 'Dados inválidos', detalhes: { prazo_meses_fundo: ['O prazo do fundo (em meses) deve estar entre 1 e 60.'] } },
          { status: 422 },
        ),
      ),
    )
    abrir('/simulacoes/nova')
    await preencherValidos()
    await userEvent.click(screen.getByRole('button', { name: 'Criar simulação' }))

    expect(await screen.findByText('O prazo do fundo (em meses) deve estar entre 1 e 60.')).toBeInTheDocument()
    expect(campo(R.prazo)).toHaveAttribute('aria-invalid', 'true')
    expect(caminho()).toBe('/simulacoes/nova')
    expect(screen.queryByText('Simulação criada.')).not.toBeInTheDocument()
    expect(banco.simulacoes).toHaveLength(0)
  })

  it('servidor fora do ar: alerta de rede, dados mantidos e dá para tentar de novo', async () => {
    servidor.use(http.post(`${BASE}/simulacoes`, () => HttpResponse.error()))
    abrir('/simulacoes/nova')
    await preencherValidos()
    await userEvent.click(screen.getByRole('button', { name: 'Criar simulação' }))
    expect(await screen.findByText('Não foi possível falar com o servidor.')).toBeInTheDocument()
    expect(campo(R.nome)).toHaveValue('Onix 2026')

    servidor.resetHandlers(...handlers)
    await userEvent.click(screen.getByRole('button', { name: 'Criar simulação' }))
    await waitFor(() => expect(caminho()).toMatch(/\/editar$/))
  })

  it('a entrada vazia cria a simulação com entrada 0', async () => {
    abrir('/simulacoes/nova')
    await userEvent.type(campo(R.nome), 'Sem entrada')
    await userEvent.type(campo(R.veiculo), '80000')
    await userEvent.clear(campo(R.entrada))
    await userEvent.type(campo(R.fundo), '10')
    await userEvent.type(campo(R.prazo), '24')
    await userEvent.type(campo(R.ipca), '4')
    await userEvent.click(screen.getByRole('button', { name: 'Criar simulação' }))
    await waitFor(() => expect(banco.simulacoes).toHaveLength(1))
    expect(banco.simulacoes[0].valor_entrada).toBe(0)
  })
})

describe('SimulacaoForm: editar', () => {
  const nova = () => criarSimulacao(ana.id, { nome: 'Onix', valor_veiculo: 95000, valor_entrada: 20000, taxa_ipca_projetada: 4.5, taxa_fundo_rendimento: 12, prazo_meses_fundo: 36 })

  it('mostra o esqueleto, e depois o formulário preenchido no formato dos campos', async () => {
    const s = nova()
    abrir(`/simulacoes/${s.id}/editar`)
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })).toBeInTheDocument()
    expect(campo(R.nome)).toHaveValue('Onix')
    expect(campo(R.veiculo)).toHaveValue('95.000,00')
    expect(campo(R.entrada)).toHaveValue('20.000,00')
    expect(campo(R.fundo)).toHaveValue('12')
    expect(campo(R.prazo)).toHaveValue('36')
    expect(campo(R.ipca)).toHaveValue('4,5')
  })

  it('salvar: PUT com o corpo COMPLETO, CONTINUA na tela, avisa "Alterações salvas." e mostra os valores reformatados', async () => {
    const s = nova()
    abrir(`/simulacoes/${s.id}/editar`)
    await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })
    await userEvent.clear(campo(R.veiculo))
    await userEvent.type(campo(R.veiculo), '80000,5')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument()
    await waitFor(() => expect(campo(R.veiculo)).toHaveValue('80.000,50'))
    expect(caminho()).toBe(`/simulacoes/${s.id}/editar`)
    expect(banco.simulacoes[0]).toMatchObject({
      nome: 'Onix',
      valor_veiculo: 80000.5,
      valor_entrada: 20000,
      taxa_ipca_projetada: 4.5,
      taxa_fundo_rendimento: 12,
      prazo_meses_fundo: 36,
    })
    expect(pedidos.filter((p) => p === `PUT /simulacoes/${s.id}`)).toHaveLength(1)
  })

  it('dá para salvar de novo, quantas vezes for preciso', async () => {
    const s = nova()
    abrir(`/simulacoes/${s.id}/editar`)
    await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(pedidos.filter((p) => p.startsWith('PUT '))).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(pedidos.filter((p) => p.startsWith('PUT '))).toHaveLength(2))
  })

  it('Ver resultado e Voltar ao histórico estão sempre visíveis e apontam para as rotas certas', async () => {
    const s = nova()
    abrir(`/simulacoes/${s.id}/editar`)
    await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })
    expect(screen.getByRole('link', { name: 'Ver resultado' })).toHaveAttribute('href', `/simulacoes/${s.id}/resultado`)
    expect(screen.getByRole('link', { name: 'Voltar ao histórico' })).toHaveAttribute('href', '/simulacoes')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await screen.findByText('Alterações salvas.')
    expect(screen.getByRole('link', { name: 'Ver resultado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao histórico' })).toBeInTheDocument()
  })

  it('validação no cliente: não faz o PUT', async () => {
    const s = nova()
    abrir(`/simulacoes/${s.id}/editar`)
    await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })
    await userEvent.clear(campo(R.prazo))
    await userEvent.type(campo(R.prazo), '61')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('O prazo do fundo (em meses) deve estar entre 1 e 60.')).toBeInTheDocument()
    expect(pedidos.filter((p) => p.startsWith('PUT '))).toEqual([])
  })

  it('422 do servidor por conta da entrada de uma opção: a mensagem real (com o nome da opção) aparece no veículo', async () => {
    const s = nova()
    criarFinanciamento(s.id, { nome: 'Banco X', valor_entrada: 50000 })
    abrir(`/simulacoes/${s.id}/editar`)
    await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })
    await userEvent.clear(campo(R.veiculo))
    await userEvent.type(campo(R.veiculo), '50000')
    await userEvent.clear(campo(R.entrada))
    await userEvent.type(campo(R.entrada), '0')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText(/"Banco X" \(R\$ 50\.000,00\)\. Ajuste a opção antes\./)).toBeInTheDocument()
    expect(campo(R.veiculo)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Alterações salvas.')).not.toBeInTheDocument()
    expect(banco.simulacoes[0].valor_veiculo).toBe(95000)
  })

  it('servidor fora do ar ao salvar: alerta de rede e nada muda', async () => {
    const s = nova()
    servidor.use(http.put(`${BASE}/simulacoes/${s.id}`, () => HttpResponse.error()))
    abrir(`/simulacoes/${s.id}/editar`)
    await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Não foi possível falar com o servidor.')).toBeInTheDocument()
    expect(screen.queryByText('Alterações salvas.')).not.toBeInTheDocument()
  })
})

describe('SimulacaoForm: não encontrada e erros ao carregar', () => {
  it.each([
    ['inexistente', '999999'],
    ['com id não numérico (o backend responde "Recurso não encontrado")', 'abc'],
  ])('%s: mostra "Simulação não encontrada" com o link ao histórico', async (_rotulo, id) => {
    abrir(`/simulacoes/${id}/editar`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Simulação não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao histórico' })).toHaveAttribute('href', '/simulacoes')
    expect(screen.queryByLabelText(R.nome)).not.toBeInTheDocument()
  })

  it('a simulação de OUTRA pessoa mostra exatamente o mesmo estado (não vaza que ela existe)', async () => {
    const dela = criarSimulacao(bia.id, { nome: 'Da Bia' })
    abrir(`/simulacoes/${dela.id}/editar`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Simulação não encontrada' })).toBeInTheDocument()
    expect(screen.queryByText('Da Bia')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(R.nome)).not.toBeInTheDocument()
  })

  it('um 404 no PUT (excluída em outro lugar) troca o formulário pelo mesmo estado', async () => {
    const s = criarSimulacao(ana.id)
    abrir(`/simulacoes/${s.id}/editar`)
    await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })
    banco.simulacoes = banco.simulacoes.filter((x) => x.id !== s.id)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Simulação não encontrada' })).toBeInTheDocument()
    expect(screen.queryByText('Alterações salvas.')).not.toBeInTheDocument()
  })

  it('erro ao carregar (503): mensagem clara e Tentar de novo, que abre o formulário quando o servidor volta', async () => {
    const s = criarSimulacao(ana.id, { nome: 'Onix' })
    servidor.use(http.get(`${BASE}/simulacoes/${s.id}`, () => respostaErro(503, 'Serviço indisponível')))
    abrir(`/simulacoes/${s.id}/editar`)
    expect(await screen.findByText('Não foi possível carregar a simulação')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Serviço indisponível')

    servidor.resetHandlers(...handlers)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Editar simulação' })).toBeInTheDocument()
    expect(campo(R.nome)).toHaveValue('Onix')
  })

  it('servidor fora do ar ao carregar: mensagem própria de rede', async () => {
    const s = criarSimulacao(ana.id)
    servidor.use(http.get(`${BASE}/simulacoes/${s.id}`, () => HttpResponse.error()))
    abrir(`/simulacoes/${s.id}/editar`)
    expect(await screen.findByText('Não foi possível carregar a simulação')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
  })
})
