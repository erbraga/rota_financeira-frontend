import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { banco, criarSimulacao, criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { renderizarComAuth } from '../testUtils.jsx'
import Simulacoes from './Simulacoes.jsx'

const BASE = 'http://localhost:5000/api'

function Rotas() {
  return (
    <Routes>
      <Route path="/simulacoes" element={<Simulacoes />} />
      <Route path="/simulacoes/nova" element={<p>tela de nova simulação</p>} />
      <Route path="/simulacoes/:id/editar" element={<p>tela de edição</p>} />
      <Route path="/simulacoes/:id/resultado" element={<p>tela de resultado</p>} />
    </Routes>
  )
}

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

const abrir = () => renderizarComAuth(<Rotas />, { rota: '/simulacoes', token })
const titulosDosCartoes = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
const chamadasDelete = () => pedidos.filter((p) => p.startsWith('DELETE ')).length

describe('Simulacoes: carregando, lista e vazio', () => {
  it('mostra o esqueleto enquanto carrega e depois os cartões', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    abrir()
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Onix' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Carregando' })).not.toBeInTheDocument()
    expect(document.title).toBe('Minhas simulações · Rota Financeira')
  })

  it('lista do mais recente ao mais antigo, com valores em reais e a data', async () => {
    criarSimulacao(ana.id, { nome: 'Primeira', valor_veiculo: 80000, valor_entrada: 10000 })
    criarSimulacao(ana.id, { nome: 'Segunda', valor_veiculo: 95000.5, valor_entrada: 0 })
    abrir()
    await screen.findByRole('heading', { level: 2, name: 'Segunda' })
    expect(titulosDosCartoes()).toEqual(['Segunda', 'Primeira'])
    const cartao = screen.getByRole('heading', { level: 2, name: 'Segunda' }).closest('.MuiCard-root')
    expect(cartao.textContent.replaceAll(' ', ' ')).toContain('R$ 95.000,50')
    expect(cartao.textContent.replaceAll(' ', ' ')).toContain('R$ 0,00')
    expect(cartao).toHaveTextContent('15/01/2026')
  })

  it('cada cartão tem os links Ver resultado e Editar, e o botão Excluir', async () => {
    const s = criarSimulacao(ana.id, { nome: 'Onix' })
    abrir()
    await screen.findByRole('heading', { level: 2, name: 'Onix' })
    expect(screen.getByRole('link', { name: 'Ver resultado' })).toHaveAttribute('href', `/simulacoes/${s.id}/resultado`)
    expect(screen.getByRole('link', { name: 'Editar simulação Onix' })).toHaveAttribute('href', `/simulacoes/${s.id}/editar`)
    expect(screen.getByRole('button', { name: 'Excluir simulação Onix' })).toBeInTheDocument()
  })

  it('o botão Nova simulação leva a /simulacoes/nova', async () => {
    abrir()
    await screen.findByText('Nenhuma simulação ainda')
    await userEvent.click(screen.getByRole('link', { name: 'Nova simulação' }))
    expect(screen.getByText('tela de nova simulação')).toBeInTheDocument()
  })

  it('sem simulações: estado vazio com o botão "Criar a primeira simulação" (controle da lista)', async () => {
    abrir()
    expect(await screen.findByText('Nenhuma simulação ainda')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar a primeira simulação' })).toHaveAttribute('href', '/simulacoes/nova')
    expect(screen.queryByRole('heading', { level: 2, name: /Onix/ })).not.toBeInTheDocument()
  })

  it('só aparecem as simulações da pessoa logada (as de outra conta não)', async () => {
    criarSimulacao(ana.id, { nome: 'Da Ana' })
    criarSimulacao(bia.id, { nome: 'Da Bia' })
    abrir()
    await screen.findByRole('heading', { level: 2, name: 'Da Ana' })
    expect(screen.queryByText('Da Bia')).not.toBeInTheDocument()
  })

  it('não oferece paginação, ordenação nem filtros (decisão do autor)', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    abrir()
    await screen.findByRole('heading', { level: 2, name: 'Onix' })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /paginação|pagination/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/ordenar|filtrar|buscar/i)).not.toBeInTheDocument()
  })
})

describe('Simulacoes: erro ao carregar', () => {
  it('erro 503: mensagem clara e "Tentar de novo", que carrega quando o servidor volta (controle: com sucesso não há erro)', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    servidor.use(http.get(`${BASE}/simulacoes`, () => respostaErro(503, 'Serviço indisponível')))
    abrir()
    expect(await screen.findByText('Não foi possível carregar suas simulações')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Serviço indisponível')
    expect(screen.queryByText('Nenhuma simulação ainda')).not.toBeInTheDocument()

    servidor.resetHandlers(...handlers)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Onix' })).toBeInTheDocument()
    expect(screen.queryByText('Não foi possível carregar suas simulações')).not.toBeInTheDocument()
  })

  it('servidor fora do ar: mensagem própria de rede', async () => {
    servidor.use(http.get(`${BASE}/simulacoes`, () => HttpResponse.error()))
    abrir()
    expect(await screen.findByText('Não foi possível carregar suas simulações')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
  })
})

describe('Simulacoes: excluir', () => {
  it('pede confirmação com o nome da simulação e o aviso das opções', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir simulação Onix' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Excluir a simulação "Onix"?' })
    expect(dialogo).toHaveTextContent('As opções de financiamento dela também serão excluídas.')
    expect(chamadasDelete()).toBe(0)
  })

  it('Cancelar NÃO chama a API e a simulação continua na lista', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir simulação Onix' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(chamadasDelete()).toBe(0)
    expect(screen.getByRole('heading', { level: 2, name: 'Onix' })).toBeInTheDocument()
  })

  it('confirmar (204): o cartão some, mostra "Simulação excluída." e a lista é buscada de novo', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    criarSimulacao(ana.id, { nome: 'Fica' })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir simulação Onix' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))

    expect(await screen.findByText('Simulação excluída.')).toBeInTheDocument()
    // Só depois de o diálogo sair (animação) o resto da página volta a ser acessível.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: 'Onix' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 2, name: 'Fica' })).toBeInTheDocument()
    expect(chamadasDelete()).toBe(1)
    expect(pedidos.filter((p) => p === 'GET /simulacoes')).toHaveLength(2)
  })

  it('excluir a última mostra o estado vazio', async () => {
    criarSimulacao(ana.id, { nome: 'Unica' })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir simulação Unica' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Nenhuma simulação ainda')).toBeInTheDocument()
  })

  it('durante a requisição o botão fica desabilitado ("Excluindo…") e só sai UMA chamada', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    servidor.use(
      http.delete(`${BASE}/simulacoes/:id`, async () => {
        await delay(150)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir simulação Onix' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    expect(screen.getByRole('button', { name: 'Excluindo…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(chamadasDelete()).toBe(1)
  })

  it('404 na exclusão (já excluída em outro lugar) conta como sucesso, com aviso próprio', async () => {
    const s = criarSimulacao(ana.id, { nome: 'Onix' })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir simulação Onix' }))
    // Outra aba excluiu antes de a pessoa confirmar.
    banco.simulacoes = banco.simulacoes.filter((x) => x.id !== s.id)
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))

    expect(await screen.findByText('Essa simulação já tinha sido excluída.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: 'Onix' })).not.toBeInTheDocument())
  })

  it('rede fora do ar: o diálogo CONTINUA aberto com o erro e dá para tentar de novo', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    servidor.use(http.delete(`${BASE}/simulacoes/:id`, () => HttpResponse.error()))
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir simulação Onix' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))

    const dialogo = await screen.findByRole('dialog')
    expect(await within(dialogo).findByText('Não foi possível falar com o servidor.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()
    // Com o diálogo aberto o resto da página fica aria-hidden: o cartão só é acessível com hidden: true.
    expect(screen.getByRole('heading', { level: 2, name: 'Onix', hidden: true })).toBeInTheDocument()

    servidor.resetHandlers(...handlers)
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Simulação excluída.')).toBeInTheDocument()
  })

  it('erro 500 mostra a mensagem do servidor no diálogo e não mexe na lista', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    servidor.use(http.delete(`${BASE}/simulacoes/:id`, () => respostaErro(500, 'Erro interno do servidor')))
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir simulação Onix' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    expect(await within(await screen.findByRole('dialog')).findByText('Erro interno do servidor')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Onix', hidden: true })).toBeInTheDocument()
  })

  it('reabrir o diálogo depois de um erro começa sem o erro antigo', async () => {
    criarSimulacao(ana.id, { nome: 'Onix' })
    servidor.use(http.delete(`${BASE}/simulacoes/:id`, () => respostaErro(500, 'Erro interno do servidor')))
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir simulação Onix' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    await screen.findByText('Erro interno do servidor')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Excluir simulação Onix' }))
    await screen.findByRole('dialog')
    expect(screen.queryByText('Erro interno do servidor')).not.toBeInTheDocument()
  })
})
