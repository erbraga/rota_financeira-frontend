import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { banco, criarFinanciamento, criarSimulacao, criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { criarQueryClient } from '../queryClient.js'
import { renderizarComAuth } from '../testUtils.jsx'
import SecaoFinanciamentos from './SecaoFinanciamentos.jsx'

const BASE = 'http://localhost:5000/api'
const R = { nome: 'Nome da opção', taxa: 'Taxa de juros (% a.m.)', prazo: 'Prazo (meses)', entrada: 'Valor da entrada (R$)' }
const ENTRADA_MAIOR = (valor) =>
  `A entrada deve ser menor que o valor do veículo (R$ ${valor}); com a entrada igual ao valor não há o que financiar.`

let ana
let token
let sim
let pedidos

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  token = tokenDe(ana)
  sim = criarSimulacao(ana.id, { valor_veiculo: 95000 })
  pedidos = []
  servidor.events.on('request:start', ({ request }) => pedidos.push(`${request.method} ${new URL(request.url).pathname.replace('/api', '')}`))
})

afterEach(() => servidor.events.removeAllListeners())

const LISTA = () => `GET /simulacoes/${sim.id}/financiamentos`
const chamadas = (rotulo) => pedidos.filter((p) => p === rotulo).length
const opcoesNoBanco = () => banco.financiamentos.filter((f) => f.simulacao_id === sim.id)

// Cache de PRODUÇÃO (staleTime de 30 s): o cliente de teste refaria a busca e esconderia o "sem novo GET".
const producao = () => criarQueryClient({ retry: false, gcTime: Infinity })

function montar({ valorVeiculo = 95000, simulacaoId = sim.id, queryClient = producao() } = {}) {
  return renderizarComAuth(<SecaoFinanciamentos simulacaoId={simulacaoId} valorVeiculo={valorVeiculo} />, { token, queryClient })
}

const adicionar = () => screen.getByRole('button', { name: 'Adicionar opção' })
const cartao = (nome) => screen.getByRole('heading', { level: 3, name: nome })
const dialogo = () => screen.getByRole('dialog')
const salvar = () => within(dialogo()).getByRole('button', { name: /^Salvar$|^Salvando/ })

async function preencherDialogo({ nome = 'Banco A', taxa = '1,5', prazo = '48', sistema = 'Price', entrada = '10000' } = {}) {
  const digitar = async (rotulo, texto) => {
    const alvo = screen.getByLabelText(rotulo)
    await userEvent.clear(alvo)
    if (texto !== '') await userEvent.type(alvo, texto)
  }
  await digitar(R.nome, nome)
  await digitar(R.taxa, taxa)
  await digitar(R.prazo, prazo)
  await userEvent.click(within(dialogo()).getByRole('radio', { name: sistema }))
  await digitar(R.entrada, entrada)
}

async function esperarLista() {
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Carregando' })).not.toBeInTheDocument())
}

describe('SecaoFinanciamentos: estados da lista', () => {
  it('carregando: mostra o esqueleto e o botão de adicionar desabilitado (controle: depois habilita)', async () => {
    let liberar
    const comporta = new Promise((resolver) => { liberar = resolver })
    servidor.use(
      http.get(`${BASE}/simulacoes/${sim.id}/financiamentos`, async () => {
        await comporta
        return HttpResponse.json({ itens: [], total: 0 })
      }),
    )
    montar()
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument()
    expect(adicionar()).toBeDisabled()
    liberar()
    await waitFor(() => expect(adicionar()).toBeEnabled())
  })

  it('título, texto de apoio (compara os três cenários; cada opção é salva na hora) e o botão', async () => {
    montar()
    expect(screen.getByRole('heading', { level: 2, name: 'Opções de financiamento' })).toBeInTheDocument()
    expect(screen.getByText(/Compare a compra à vista, o financiamento e o fundo\. Cada opção é salva na hora/)).toBeInTheDocument()
    await esperarLista()
  })

  it('vazio (0 opções): mensagem própria e o botão de adicionar habilitado', async () => {
    montar()
    expect(await screen.findByText('Nenhuma opção ainda. Adicione ao menos 2 opções para comparar financiamentos.')).toBeInTheDocument()
    expect(adicionar()).toBeEnabled()
  })

  it('erro (503): mensagem clara com Tentar de novo, que carrega a lista quando o servidor volta; adicionar desabilitado no erro', async () => {
    servidor.use(http.get(`${BASE}/simulacoes/${sim.id}/financiamentos`, () => respostaErro(503, 'Serviço indisponível')))
    criarFinanciamento(sim.id, { nome: 'Banco A' })
    montar()
    expect(await screen.findByText('Não foi possível carregar as opções de financiamento')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Serviço indisponível')
    expect(adicionar()).toBeDisabled()

    servidor.resetHandlers(...handlers)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Banco A' })).toBeInTheDocument()
    expect(adicionar()).toBeEnabled()
  })

  it('servidor fora do ar: a mensagem própria de rede', async () => {
    servidor.use(http.get(`${BASE}/simulacoes/${sim.id}/financiamentos`, () => HttpResponse.error()))
    montar()
    expect(await screen.findByText('Não foi possível carregar as opções de financiamento')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
  })

  it('a simulação que sumiu (404): mostra o erro com a mensagem do backend', async () => {
    montar({ simulacaoId: 999999 })
    expect(await screen.findByText('Não foi possível carregar as opções de financiamento')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Simulação não encontrada')
  })

  it('lista as opções em ordem de criação, em cartões', async () => {
    criarFinanciamento(sim.id, { nome: 'Primeira' })
    criarFinanciamento(sim.id, { nome: 'Segunda' })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'Primeira' })
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Primeira', 'Segunda'])
  })

  it('NÃO mostra valor financiado, parcela nem custo (o frontend não calcula)', async () => {
    criarFinanciamento(sim.id, { nome: 'Banco A' })
    const { container } = montar()
    await screen.findByRole('heading', { level: 3, name: 'Banco A' })
    expect(container.textContent).not.toMatch(/valor financiado|parcela|custo total/i)
  })
})

describe('SecaoFinanciamentos: incentivo (2 ou 3) e limite (3)', () => {
  it('com 1 opção: aviso de incentivo; com 2 e com 3 não há aviso (controle)', async () => {
    criarFinanciamento(sim.id, { nome: 'A' })
    const { unmount } = montar()
    expect(await screen.findByText('Adicione ao menos 2 opções para comparar financiamentos.')).toBeInTheDocument()
    unmount()

    criarFinanciamento(sim.id, { nome: 'B' })
    const segunda = montar()
    await screen.findByRole('heading', { level: 3, name: 'B' })
    expect(screen.queryByText(/Adicione ao menos 2 opções/)).not.toBeInTheDocument()
    segunda.unmount()

    criarFinanciamento(sim.id, { nome: 'C' })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'C' })
    expect(screen.queryByText(/Adicione ao menos 2 opções/)).not.toBeInTheDocument()
  })

  it('com 3 opções: botão desabilitado com o texto do limite; com 2 está habilitado (controle)', async () => {
    criarFinanciamento(sim.id, { nome: 'A' })
    criarFinanciamento(sim.id, { nome: 'B' })
    const { unmount } = montar()
    await screen.findByRole('heading', { level: 3, name: 'B' })
    expect(adicionar()).toBeEnabled()
    expect(screen.queryByText(/Limite de 3 opções/)).not.toBeInTheDocument()
    unmount()

    criarFinanciamento(sim.id, { nome: 'C' })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'C' })
    expect(adicionar()).toBeDisabled()
    expect(screen.getByText('Limite de 3 opções: exclua uma para adicionar outra.')).toBeInTheDocument()
    expect(adicionar()).toHaveAccessibleDescription('Limite de 3 opções: exclua uma para adicionar outra.')
  })

  it('excluir uma das 3 libera o botão e some o texto do limite', async () => {
    for (const nome of ['A', 'B', 'C']) criarFinanciamento(sim.id, { nome })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'C' })
    expect(adicionar()).toBeDisabled() // antes: no limite
    expect(screen.getByText(/Limite de 3 opções/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Excluir opção C' }))
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(adicionar()).toBeEnabled())
    expect(screen.queryByText(/Limite de 3 opções/)).not.toBeInTheDocument()
  })
})

describe('SecaoFinanciamentos: adicionar', () => {
  it('abre o diálogo vazio; ao salvar, a opção aparece SEM novo GET, o diálogo fecha e avisa "Opção adicionada."', async () => {
    montar()
    await esperarLista()
    await userEvent.click(adicionar())
    expect(dialogo()).toHaveAccessibleName('Adicionar opção de financiamento')
    await preencherDialogo({ nome: 'Banco A', sistema: 'SAC' })
    await userEvent.click(salvar())

    expect(await screen.findByText('Opção adicionada.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cartao('Banco A')).toBeInTheDocument()
    expect(screen.getByText('SAC')).toBeInTheDocument()
    expect(chamadas(LISTA())).toBe(1)
    expect(opcoesNoBanco()).toHaveLength(1)
    expect(opcoesNoBanco()[0]).toMatchObject({ nome: 'Banco A', sistema_amortizacao: 'SAC', taxa_juros_mensal: 1.5, prazo_meses: 48, valor_entrada: 10000 })
  })

  it('cancelar não cria nada (controle) e a próxima abertura começa vazia', async () => {
    montar()
    await esperarLista()
    await userEvent.click(adicionar())
    await userEvent.type(screen.getByLabelText(R.nome), 'rascunho')
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opcoesNoBanco()).toHaveLength(0)
    await userEvent.click(adicionar())
    expect(screen.getByLabelText(R.nome)).toHaveValue('')
  })

  it('a regra da entrada usa o valor do veículo SALVO recebido (50.000, não 95.000)', async () => {
    montar({ valorVeiculo: 50000 })
    await esperarLista()
    await userEvent.click(adicionar())
    expect(screen.getByText(/Menor que o valor do veículo \(R\$\s50\.000,00\)/)).toBeInTheDocument() // a ajuda cita o valor
    await preencherDialogo({ entrada: '60000' })
    await userEvent.click(salvar())
    expect(await screen.findByText(ENTRADA_MAIOR('50.000,00'))).toBeInTheDocument()
    expect(opcoesNoBanco()).toHaveLength(0)
  })

  it('422 do servidor (valor do veículo mudou em outra aba): a mensagem real aparece no campo da entrada', async () => {
    montar({ valorVeiculo: 200000 }) // o cliente acha que cabe; o servidor sabe que o veículo é de 95.000
    await esperarLista()
    await userEvent.click(adicionar())
    await preencherDialogo({ entrada: '100000' })
    await userEvent.click(salvar())
    expect(await screen.findByText(ENTRADA_MAIOR('95.000,00'))).toBeInTheDocument()
    expect(screen.getByLabelText(R.entrada)).toHaveAttribute('aria-invalid', 'true')
    expect(dialogo()).toBeInTheDocument()
  })

  it('409 com o botão habilitado por uma lista velha: o diálogo explica E a lista é atualizada (passa a mostrar 3 e trava o botão)', async () => {
    criarFinanciamento(sim.id, { nome: 'A' })
    criarFinanciamento(sim.id, { nome: 'B' })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'B' })
    expect(adicionar()).toBeEnabled()
    criarFinanciamento(sim.id, { nome: 'C de outra aba' }) // a terceira entra em outro lugar

    await userEvent.click(adicionar())
    await preencherDialogo({ nome: 'Quarta' })
    await userEvent.click(salvar())

    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(
      'Uma simulação aceita no máximo 3 opções de financiamento. Exclua uma opção antes de adicionar outra.',
    )
    expect(screen.getByLabelText(R.nome)).toHaveValue('Quarta') // os dados ficam
    await waitFor(() => expect(chamadas(LISTA())).toBe(2)) // a lista foi buscada de novo
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { level: 3, name: 'C de outra aba' })).toBeInTheDocument()
    expect(adicionar()).toBeDisabled()
    expect(opcoesNoBanco()).toHaveLength(3)
  })

  it('servidor fora do ar ao salvar: alerta de rede, dados mantidos, e tentar de novo funciona', async () => {
    servidor.use(http.post(`${BASE}/simulacoes/${sim.id}/financiamentos`, () => HttpResponse.error()))
    montar()
    await esperarLista()
    await userEvent.click(adicionar())
    await preencherDialogo()
    await userEvent.click(salvar())
    expect(await within(dialogo()).findByText('Não foi possível falar com o servidor.')).toBeInTheDocument()
    expect(screen.getByLabelText(R.nome)).toHaveValue('Banco A')

    servidor.resetHandlers(...handlers)
    await userEvent.click(salvar())
    expect(await screen.findByText('Opção adicionada.')).toBeInTheDocument()
    expect(opcoesNoBanco()).toHaveLength(1)
  })
})

describe('SecaoFinanciamentos: editar', () => {
  const opcao = () => criarFinanciamento(sim.id, { nome: 'Banco A', taxa_juros_mensal: 1.5, prazo_meses: 48, sistema_amortizacao: 'PRICE', valor_entrada: 10000 })

  it('abre preenchido no formato dos campos; ao salvar troca o cartão, sem novo GET, e avisa "Opção salva."', async () => {
    opcao()
    criarFinanciamento(sim.id, { nome: 'Outra' })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'Banco A' })
    await userEvent.click(screen.getByRole('button', { name: 'Editar opção Banco A' }))

    expect(dialogo()).toHaveAccessibleName('Editar opção de financiamento')
    expect(screen.getByLabelText(R.nome)).toHaveValue('Banco A')
    expect(screen.getByLabelText(R.taxa)).toHaveValue('1,5')
    expect(screen.getByLabelText(R.prazo)).toHaveValue('48')
    expect(screen.getByLabelText(R.entrada)).toHaveValue('10.000,00')
    expect(within(dialogo()).getByRole('radio', { name: 'Price' })).toBeChecked()

    await userEvent.clear(screen.getByLabelText(R.nome))
    await userEvent.type(screen.getByLabelText(R.nome), 'Banco A editado')
    await userEvent.click(within(dialogo()).getByRole('radio', { name: 'SAC' }))
    await userEvent.click(salvar())

    expect(await screen.findByText('Opção salva.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Banco A editado', 'Outra'])
    expect(chamadas(LISTA())).toBe(1)
    expect(opcoesNoBanco()[0]).toMatchObject({ nome: 'Banco A editado', sistema_amortizacao: 'SAC' })
  })

  it('a opção excluída em outra aba (404 no PUT): fecha o diálogo, atualiza a lista e avisa que ela não existe mais', async () => {
    const a = opcao()
    criarFinanciamento(sim.id, { nome: 'Outra' })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'Banco A' })
    await userEvent.click(screen.getByRole('button', { name: 'Editar opção Banco A' }))
    banco.financiamentos = banco.financiamentos.filter((f) => f.id !== a.id) // some em outra aba
    await userEvent.click(salvar())

    expect(await screen.findByText('Esta opção não existe mais.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Banco A' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 3, name: 'Outra' })).toBeInTheDocument()
    expect(chamadas(LISTA())).toBe(2)
  })

  it('controle: um 404 ao ADICIONAR (simulação sumiu) NÃO usa o aviso da opção; fica no diálogo com a mensagem', async () => {
    montar()
    await esperarLista()
    await userEvent.click(adicionar())
    banco.simulacoes = []
    await preencherDialogo()
    await userEvent.click(salvar())
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Simulação não encontrada')
    expect(screen.queryByText('Esta opção não existe mais.')).not.toBeInTheDocument()
  })
})

describe('SecaoFinanciamentos: excluir', () => {
  it('pede confirmação com o nome da opção; ao confirmar, o cartão sai sem novo GET e avisa "Opção excluída."', async () => {
    criarFinanciamento(sim.id, { nome: 'Banco A' })
    criarFinanciamento(sim.id, { nome: 'Outra' })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'Banco A' })
    await userEvent.click(screen.getByRole('button', { name: 'Excluir opção Banco A' }))

    expect(dialogo()).toHaveAccessibleName('Excluir a opção "Banco A"?')
    expect(dialogo()).toHaveTextContent('Esta ação não pode ser desfeita.')
    expect(opcoesNoBanco()).toHaveLength(2) // ainda não excluiu
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByText('Opção excluída.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Banco A' })).not.toBeInTheDocument())
    expect(opcoesNoBanco().map((f) => f.nome)).toEqual(['Outra'])
    expect(chamadas(LISTA())).toBe(1)
  })

  it('Cancelar não exclui (controle)', async () => {
    criarFinanciamento(sim.id, { nome: 'Banco A' })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'Banco A' })
    await userEvent.click(screen.getByRole('button', { name: 'Excluir opção Banco A' }))
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opcoesNoBanco()).toHaveLength(1)
    expect(cartao('Banco A')).toBeInTheDocument()
  })

  it('404 no DELETE conta como sucesso: "Essa opção já tinha sido excluída." e o cartão sai', async () => {
    const a = criarFinanciamento(sim.id, { nome: 'Banco A' })
    montar()
    await screen.findByRole('heading', { level: 3, name: 'Banco A' })
    await userEvent.click(screen.getByRole('button', { name: 'Excluir opção Banco A' }))
    banco.financiamentos = banco.financiamentos.filter((f) => f.id !== a.id)
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Essa opção já tinha sido excluída.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: 'Banco A' })).not.toBeInTheDocument())
  })

  it('rede fora do ar: a confirmação continua aberta com o erro, e o cartão fica', async () => {
    const a = criarFinanciamento(sim.id, { nome: 'Banco A' })
    servidor.use(http.delete(`${BASE}/simulacoes/${sim.id}/financiamentos/${a.id}`, () => HttpResponse.error()))
    montar()
    await screen.findByRole('heading', { level: 3, name: 'Banco A' })
    await userEvent.click(screen.getByRole('button', { name: 'Excluir opção Banco A' }))
    await userEvent.click(within(dialogo()).getByRole('button', { name: 'Excluir' }))
    expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
    expect(opcoesNoBanco()).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 3, name: 'Banco A', hidden: true })).toBeInTheDocument()
  })
})
