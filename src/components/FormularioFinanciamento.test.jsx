import { screen, waitFor } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ErroApi, ErroRede } from '../api/erros.js'
import { renderizar } from '../testUtils.jsx'
import FormularioFinanciamento from './FormularioFinanciamento.jsx'

const OPCAO = { id: 7, nome: 'Banco A', taxa_juros_mensal: 1.5, prazo_meses: 48, sistema_amortizacao: 'PRICE', valor_entrada: 10000 }
const ENTRADA_MAIOR =
  'A entrada deve ser menor que o valor do veículo (R$ 95.000,00); com a entrada igual ao valor não há o que financiar.'

const R = {
  nome: 'Nome da opção',
  taxa: 'Taxa de juros (% a.m.)',
  prazo: 'Prazo (meses)',
  entrada: 'Valor da entrada (R$)',
}
const campo = (rotulo) => screen.getByLabelText(rotulo)
const price = () => screen.getByRole('radio', { name: 'Price' })
const sac = () => screen.getByRole('radio', { name: 'SAC' })
const salvar = () => screen.getByRole('button', { name: /^Salvar$|^Salvando/ })

function abrir({ aoEnviar = vi.fn().mockResolvedValue(undefined), aoCancelar = vi.fn(), ...resto } = {}) {
  renderizar(<FormularioFinanciamento aberto valorVeiculo={95000} aoEnviar={aoEnviar} aoCancelar={aoCancelar} {...resto} />)
  return { aoEnviar, aoCancelar }
}

async function preencher({ nome = 'Banco A', taxa = '1,5', prazo = '48', sistema = 'Price', entrada = '10000' } = {}) {
  const digitar = async (rotulo, texto) => {
    await userEvent.clear(campo(rotulo))
    if (texto !== '') await userEvent.type(campo(rotulo), texto)
  }
  await digitar(R.nome, nome)
  await digitar(R.taxa, taxa)
  await digitar(R.prazo, prazo)
  if (sistema) await userEvent.click(screen.getByRole('radio', { name: sistema }))
  await digitar(R.entrada, entrada)
}

describe('FormularioFinanciamento: abrir', () => {
  it('adicionar: vazio, entrada em "0,00", sistema SEM marca, foco no nome e a ajuda cita o valor do veículo', () => {
    abrir()
    const dialogo = screen.getByRole('dialog', { name: 'Adicionar opção de financiamento' })
    expect(dialogo).toBeInTheDocument()
    expect(campo(R.nome)).toHaveValue('')
    expect(campo(R.taxa)).toHaveValue('')
    expect(campo(R.prazo)).toHaveValue('')
    expect(campo(R.entrada)).toHaveValue('0,00')
    expect(price()).not.toBeChecked()
    expect(sac()).not.toBeChecked()
    expect(campo(R.nome)).toHaveFocus()
    expect(screen.getByText(/Menor que o valor do veículo \(R\$\s95\.000,00\)/)).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Sistema de amortização' })).toBeInTheDocument()
  })

  it('editar: título próprio e tudo preenchido no formato dos campos', () => {
    abrir({ financiamento: OPCAO })
    expect(screen.getByRole('dialog', { name: 'Editar opção de financiamento' })).toBeInTheDocument()
    expect(campo(R.nome)).toHaveValue('Banco A')
    expect(campo(R.taxa)).toHaveValue('1,5')
    expect(campo(R.prazo)).toHaveValue('48')
    expect(campo(R.entrada)).toHaveValue('10.000,00')
    expect(price()).toBeChecked()
    expect(sac()).not.toBeChecked()
  })

  it('editar uma opção SAC marca SAC', () => {
    abrir({ financiamento: { ...OPCAO, sistema_amortizacao: 'SAC' } })
    expect(sac()).toBeChecked()
    expect(price()).not.toBeChecked()
  })

  it('fechado não mostra o diálogo (controle)', () => {
    abrir({ aberto: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sem o valor do veículo (null) a ajuda não o cita', () => {
    abrir({ valorVeiculo: null })
    expect(screen.queryByText(/valor do veículo/)).not.toBeInTheDocument()
    expect(screen.getByText('De 0,00 a 9.999.999,00. Vazio vale 0')).toBeInTheDocument()
  })
})

describe('FormularioFinanciamento: validação no cliente (não chama a API)', () => {
  it('tudo vazio: as quatro obrigatórias pedem preenchimento (a entrada não) e o foco vai ao nome', async () => {
    const { aoEnviar } = abrir()
    await userEvent.click(salvar())
    expect(await screen.findAllByText('Campo obrigatório.')).toHaveLength(4)
    expect(aoEnviar).not.toHaveBeenCalled()
    await waitFor(() => expect(campo(R.nome)).toHaveFocus())
  })

  it('sistema não marcado: "Campo obrigatório." no grupo e o foco vai ao primeiro botão do grupo', async () => {
    const { aoEnviar } = abrir()
    await preencher({ sistema: null })
    await userEvent.click(salvar())
    const grupo = screen.getByRole('radiogroup', { name: 'Sistema de amortização' })
    expect(await screen.findByText('Campo obrigatório.')).toBeInTheDocument()
    expect(grupo.closest('fieldset')).toHaveTextContent('Campo obrigatório.')
    expect(aoEnviar).not.toHaveBeenCalled()
    await waitFor(() => expect(price()).toHaveFocus())
  })

  it('entrada IGUAL ao valor do veículo: mensagem real, com o valor formatado', async () => {
    const { aoEnviar } = abrir()
    await preencher({ entrada: '95000' })
    await userEvent.click(salvar())
    expect(await screen.findByText(ENTRADA_MAIOR)).toBeInTheDocument()
    expect(campo(R.entrada)).toHaveAttribute('aria-invalid', 'true')
    expect(aoEnviar).not.toHaveBeenCalled()
  })

  it.each([
    ['taxa 20,01', { taxa: '20,01' }, 'A taxa de juros mensal deve estar entre 0 e 20.'],
    ['prazo 73', { prazo: '73' }, 'O prazo (em meses) deve estar entre 1 e 72.'],
    ['prazo 12,5', { prazo: '12,5' }, 'Número inteiro inválido.'],
    ['entrada com 3 casas', { entrada: '100,123' }, 'Use no máximo 2 casas decimais.'],
  ])('%s: mostra a mensagem do backend no campo e não envia', async (_rotulo, alteracao, mensagem) => {
    const { aoEnviar } = abrir()
    await preencher(alteracao)
    await userEvent.click(salvar())
    expect(await screen.findByText(mensagem)).toBeInTheDocument()
    expect(aoEnviar).not.toHaveBeenCalled()
  })

  it('controle: com os limites aceitos (taxa 20, prazo 72, entrada 0) o envio sai', async () => {
    const { aoEnviar } = abrir()
    await preencher({ taxa: '20', prazo: '72', entrada: '0' })
    await userEvent.click(salvar())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
  })
})

describe('FormularioFinanciamento: envio', () => {
  it('o corpo tem números, prazo inteiro, sistema em maiúsculas e o nome aparado', async () => {
    const { aoEnviar } = abrir()
    await preencher({ nome: '  Banco A  ', taxa: '1,5', prazo: '48', sistema: 'SAC', entrada: '10.000,50' })
    await userEvent.click(salvar())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
    expect(aoEnviar.mock.calls[0][0]).toEqual({
      nome: 'Banco A',
      taxa_juros_mensal: 1.5,
      prazo_meses: 48,
      sistema_amortizacao: 'SAC',
      valor_entrada: 10000.5,
    })
  })

  it('a entrada vazia vai como 0 (nunca null)', async () => {
    const { aoEnviar } = abrir()
    await preencher({ entrada: '' })
    await userEvent.click(salvar())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
    expect(aoEnviar.mock.calls[0][0].valor_entrada).toBe(0)
  })

  it('editar sem mudar nada envia o mesmo corpo da opção (corpo COMPLETO)', async () => {
    const { aoEnviar } = abrir({ financiamento: OPCAO })
    await userEvent.click(salvar())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
    expect(aoEnviar.mock.calls[0][0]).toEqual({
      nome: 'Banco A',
      taxa_juros_mensal: 1.5,
      prazo_meses: 48,
      sistema_amortizacao: 'PRICE',
      valor_entrada: 10000,
    })
  })

  it('duplo envio: desabilita o botão ("Salvando…") e só sai UMA chamada (clique forçado e Enter)', async () => {
    let concluir
    const aoEnviar = vi.fn(() => new Promise((resolver) => { concluir = resolver }))
    const forcado = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never })
    abrir({ aoEnviar })
    await preencher()
    await userEvent.click(salvar())

    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    await forcado.click(screen.getByRole('button', { name: 'Salvando…' }))
    await forcado.type(campo(R.nome), '{Enter}')
    expect(aoEnviar).toHaveBeenCalledTimes(1)

    concluir(undefined)
    await waitFor(() => expect(salvar()).toBeEnabled())
    expect(aoEnviar).toHaveBeenCalledTimes(1)
  })
})

describe('FormularioFinanciamento: erros do servidor', () => {
  const valores = { nome: 'Banco A', taxa: '1,5', prazo: '48', sistema: 'Price', entrada: '10000' }

  it('422 em cada campo: mensagem no campo certo, foco no PRIMEIRO com erro e os valores digitados mantidos', async () => {
    const erro = new ErroApi({
      status: 422,
      erro: 'Dados inválidos',
      detalhes: {
        prazo_meses: ['O prazo (em meses) deve estar entre 1 e 72.'],
        valor_entrada: [ENTRADA_MAIOR],
        taxa_juros_mensal: ['A taxa de juros mensal deve estar entre 0 e 20.'],
      },
    })
    abrir({ aoEnviar: vi.fn().mockRejectedValue(erro) })
    await preencher(valores)
    await userEvent.click(salvar())

    expect(await screen.findByText('O prazo (em meses) deve estar entre 1 e 72.')).toBeInTheDocument()
    expect(screen.getByText('A taxa de juros mensal deve estar entre 0 e 20.')).toBeInTheDocument()
    expect(screen.getByText(ENTRADA_MAIOR)).toBeInTheDocument()
    expect(campo(R.taxa)).toHaveAttribute('aria-invalid', 'true')
    expect(campo(R.nome)).not.toHaveAttribute('aria-invalid', 'true') // controle: o campo sem erro
    await waitFor(() => expect(campo(R.taxa)).toHaveFocus()) // taxa vem antes de prazo e entrada
    expect(campo(R.nome)).toHaveValue('Banco A')
    expect(campo(R.prazo)).toHaveValue('48')
    expect(price()).toBeChecked()
    expect(screen.getByRole('dialog')).toBeInTheDocument() // continua aberto
  })

  it('422 no sistema leva o foco ao grupo', async () => {
    const erro = new ErroApi({ status: 422, erro: 'Dados inválidos', detalhes: { sistema_amortizacao: ['Sistema de amortização inválido. Use PRICE ou SAC.'] } })
    abrir({ aoEnviar: vi.fn().mockRejectedValue(erro) })
    await preencher(valores)
    await userEvent.click(salvar())
    expect(await screen.findByText('Sistema de amortização inválido. Use PRICE ou SAC.')).toBeInTheDocument()
    await waitFor(() => expect(price()).toHaveFocus())
  })

  it('409 (limite de 3): aviso no diálogo com a orientação, dados mantidos e o diálogo continua aberto', async () => {
    const erro = new ErroApi({ status: 409, erro: 'Uma simulação aceita no máximo 3 opções de financiamento' })
    abrir({ aoEnviar: vi.fn().mockRejectedValue(erro) })
    await preencher(valores)
    await userEvent.click(salvar())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Uma simulação aceita no máximo 3 opções de financiamento. Exclua uma opção antes de adicionar outra.',
    )
    expect(campo(R.nome)).toHaveValue('Banco A')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('servidor fora do ar: alerta de rede, dados mantidos e dá para tentar de novo', async () => {
    const aoEnviar = vi.fn().mockRejectedValueOnce(new ErroRede()).mockResolvedValue(undefined)
    abrir({ aoEnviar })
    await preencher(valores)
    await userEvent.click(salvar())
    await screen.findByText('Não foi possível falar com o servidor.')
    expect(campo(R.nome)).toHaveValue('Banco A')

    await userEvent.click(salvar())
    await waitFor(() => expect(screen.queryByText('Não foi possível falar com o servidor.')).not.toBeInTheDocument())
    expect(aoEnviar).toHaveBeenCalledTimes(2)
  })

  it('um erro que não é da API vira mensagem genérica (sem detalhes técnicos)', async () => {
    abrir({ aoEnviar: vi.fn().mockRejectedValue(new Error('boom interno')) })
    await preencher(valores)
    await userEvent.click(salvar())
    expect(await screen.findByRole('alert')).toHaveTextContent('Ocorreu um erro inesperado. Tente novamente.')
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument()
  })
})

describe('FormularioFinanciamento: fechar', () => {
  it('Cancelar e Esc chamam aoCancelar e NÃO enviam', async () => {
    const { aoCancelar, aoEnviar } = abrir()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aoCancelar).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(aoCancelar).toHaveBeenCalledTimes(2))
    expect(aoEnviar).not.toHaveBeenCalled()
  })

  it('durante o envio Esc NÃO fecha (controle: sem envio, fecha)', async () => {
    let concluir
    const aoEnviar = vi.fn(() => new Promise((resolver) => { concluir = resolver }))
    const { aoCancelar } = abrir({ aoEnviar })
    await preencher()
    await userEvent.click(salvar())
    await screen.findByRole('button', { name: 'Salvando…' })
    await userEvent.keyboard('{Escape}')
    expect(aoCancelar).not.toHaveBeenCalled()

    concluir(undefined)
    await waitFor(() => expect(salvar()).toBeEnabled())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(aoCancelar).toHaveBeenCalledTimes(1))
  })
})

describe('FormularioFinanciamento: cada abertura começa do zero', () => {
  function Reabrir() {
    const [estado, setEstado] = useState({ aberto: true, financiamento: OPCAO })
    return (
      <>
        <button onClick={() => setEstado((e) => ({ ...e, aberto: false }))}>fechar</button>
        <button onClick={() => setEstado({ aberto: true, financiamento: { ...OPCAO, id: 8, nome: 'Banco B', sistema_amortizacao: 'SAC' } })}>abrir B</button>
        <button onClick={() => setEstado({ aberto: true, financiamento: null })}>abrir nova</button>
        <button onClick={() => setEstado((e) => ({ ...e, aberto: true }))}>reabrir</button>
        <FormularioFinanciamento
          aberto={estado.aberto}
          financiamento={estado.financiamento}
          valorVeiculo={95000}
          aoEnviar={vi.fn()}
          aoCancelar={() => setEstado((e) => ({ ...e, aberto: false }))}
        />
      </>
    )
  }

  async function fechar() {
    await userEvent.click(screen.getByRole('button', { name: 'fechar', hidden: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  }

  it('reabrir para OUTRA opção traz os valores dela, não os da anterior', async () => {
    renderizar(<Reabrir />)
    await userEvent.clear(campo(R.nome))
    await userEvent.type(campo(R.nome), 'digitado e não salvo')
    await fechar()
    await userEvent.click(screen.getByRole('button', { name: 'abrir B' }))
    expect(campo(R.nome)).toHaveValue('Banco B')
    expect(sac()).toBeChecked()
  })

  it('adicionar depois de editar abre VAZIO', async () => {
    renderizar(<Reabrir />)
    await fechar()
    await userEvent.click(screen.getByRole('button', { name: 'abrir nova' }))
    expect(campo(R.nome)).toHaveValue('')
    expect(campo(R.entrada)).toHaveValue('0,00')
    expect(price()).not.toBeChecked()
    expect(sac()).not.toBeChecked()
  })

  it('controle: reabrir a mesma opção descarta o que foi digitado e não enviado (volta ao valor gravado)', async () => {
    renderizar(<Reabrir />)
    await userEvent.clear(campo(R.nome))
    await userEvent.type(campo(R.nome), 'digitado e não salvo')
    await fechar()
    await userEvent.click(screen.getByRole('button', { name: 'reabrir' }))
    expect(campo(R.nome)).toHaveValue('Banco A')
  })
})
