import { screen, waitFor } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErroApi, ErroRede } from '../api/erros.js'
import { deSimulacaoParaForm, valoresIniciais } from '../schemas/simulacao.js'
import { renderizar } from '../testUtils.jsx'
import FormularioSimulacao from './FormularioSimulacao.jsx'

const VALIDOS = {
  nome: 'Onix 2026',
  valorVeiculo: '95000,5',
  valorEntrada: '20000',
  taxaFundoRendimento: '12',
  prazoMesesFundo: '36',
  taxaIpcaProjetada: '4,5',
}

const campo = (rotulo) => screen.getByLabelText(rotulo)
const botao = () => screen.getByRole('button', { name: /^Salvar$|^Salvando/ })
const R = {
  nome: 'Nome da simulação',
  veiculo: 'Valor do veículo (R$)',
  entrada: 'Valor da entrada (R$)',
  fundo: 'Rendimento do fundo (% a.a.)',
  prazo: 'Prazo para juntar o valor (meses)',
  ipca: 'IPCA projetado (% a.a.)',
}

function abrir({ aoEnviar = vi.fn().mockResolvedValue(undefined), valores = valoresIniciais(), ...resto } = {}) {
  renderizar(<FormularioSimulacao valoresIniciais={valores} aoEnviar={aoEnviar} {...resto} />)
  return { aoEnviar }
}

async function preencher(valores = VALIDOS) {
  const ordem = [
    [R.nome, valores.nome],
    [R.veiculo, valores.valorVeiculo],
    [R.entrada, valores.valorEntrada],
    [R.fundo, valores.taxaFundoRendimento],
    [R.prazo, valores.prazoMesesFundo],
    [R.ipca, valores.taxaIpcaProjetada],
  ]
  for (const [rotulo, texto] of ordem) {
    if (texto === undefined) continue
    await userEvent.clear(campo(rotulo))
    if (texto !== '') await userEvent.type(campo(rotulo), texto)
  }
}

describe('FormularioSimulacao: campos', () => {
  it('mostra os seis campos com as unidades explícitas, as ajudas e a entrada em "0,00"', () => {
    abrir()
    for (const rotulo of Object.values(R)) expect(campo(rotulo)).toBeInTheDocument()
    expect(campo(R.entrada)).toHaveValue('0,00')
    expect(campo(R.nome)).toHaveFocus()
    expect(screen.getByText('De 0,01 a 9.999.999,00')).toBeInTheDocument()
    expect(screen.getByText('Número inteiro, de 1 a 60')).toBeInTheDocument()
    expect(screen.getByText(/igual vale/)).toBeInTheDocument()
    for (const titulo of ['Veículo', 'Fundo de acumulação', 'Correção do preço do carro']) {
      expect(screen.getByText(titulo)).toBeInTheDocument()
    }
  })

  it('mostra o texto do botão recebido e as ações extras ao lado', () => {
    abrir({ rotuloEnviar: 'Criar simulação', acoes: <button type="button">Cancelar</button> })
    expect(screen.getByRole('button', { name: 'Criar simulação' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('preenche com os valores recebidos (edição), no formato dos campos', () => {
    abrir({
      valores: deSimulacaoParaForm({
        nome: 'Onix',
        valor_veiculo: 95000.5,
        valor_entrada: 20000,
        taxa_ipca_projetada: 4.5,
        taxa_fundo_rendimento: 12,
        prazo_meses_fundo: 36,
      }),
    })
    expect(campo(R.veiculo)).toHaveValue('95.000,50')
    expect(campo(R.entrada)).toHaveValue('20.000,00')
    expect(campo(R.ipca)).toHaveValue('4,5')
    expect(campo(R.prazo)).toHaveValue('36')
  })

  it('reescreve o valor ao sair do campo (95000,5 -> 95.000,50) e não enquanto digita', async () => {
    abrir()
    await userEvent.type(campo(R.veiculo), '95000,5')
    expect(campo(R.veiculo)).toHaveValue('95000,5')
    await userEvent.tab()
    expect(campo(R.veiculo)).toHaveValue('95.000,50')
  })
})

describe('FormularioSimulacao: envio válido', () => {
  it('chama aoEnviar UMA vez com o corpo exato: snake_case, números, prazo inteiro e nome aparado', async () => {
    const { aoEnviar } = abrir()
    await preencher({ ...VALIDOS, nome: '  Onix 2026  ' })
    await userEvent.click(botao())

    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
    const corpo = aoEnviar.mock.calls[0][0]
    expect(corpo).toEqual({
      nome: 'Onix 2026',
      valor_veiculo: 95000.5,
      valor_entrada: 20000,
      taxa_ipca_projetada: 4.5,
      taxa_fundo_rendimento: 12,
      prazo_meses_fundo: 36,
    })
    expect(typeof corpo.prazo_meses_fundo).toBe('number')
    expect(Object.keys(corpo).sort()).toEqual(['nome', 'prazo_meses_fundo', 'taxa_fundo_rendimento', 'taxa_ipca_projetada', 'valor_entrada', 'valor_veiculo'])
  })

  it('a entrada vazia é enviada como 0 (o backend recusa null)', async () => {
    const { aoEnviar } = abrir()
    await preencher({ ...VALIDOS, valorEntrada: '' })
    await userEvent.click(botao())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
    expect(aoEnviar.mock.calls[0][0].valor_entrada).toBe(0)
  })

  it('a entrada intocada ("0,00") também vai como 0', async () => {
    const { aoEnviar } = abrir()
    await preencher({ ...VALIDOS, valorEntrada: undefined })
    await userEvent.click(botao())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
    expect(aoEnviar.mock.calls[0][0].valor_entrada).toBe(0)
  })

  it('depois de salvar, mostra os valores devolvidos pelo servidor, reformatados', async () => {
    const aoEnviar = vi.fn().mockResolvedValue({
      nome: 'Onix 2026',
      valor_veiculo: 95000.5,
      valor_entrada: 20000,
      taxa_ipca_projetada: 4.5,
      taxa_fundo_rendimento: 12,
      prazo_meses_fundo: 36,
    })
    abrir({ aoEnviar })
    await preencher({ ...VALIDOS, valorVeiculo: '95000,5', valorEntrada: '20000', taxaIpcaProjetada: '4,50' })
    await userEvent.click(botao())
    await waitFor(() => expect(campo(R.veiculo)).toHaveValue('95.000,50'))
    expect(campo(R.entrada)).toHaveValue('20.000,00')
    expect(campo(R.ipca)).toHaveValue('4,5')
  })

  it('sem retorno de aoEnviar os campos ficam como estavam (controle)', async () => {
    abrir()
    await preencher()
    await userEvent.tab()
    await userEvent.click(botao())
    await waitFor(() => expect(campo(R.veiculo)).toHaveValue('95.000,50'))
  })
})

describe('FormularioSimulacao: validação no cliente (mensagens do backend, sem chamar a API)', () => {
  it('tudo vazio: "Campo obrigatório." nos cinco obrigatórios, foco no nome e nenhuma chamada', async () => {
    const { aoEnviar } = abrir()
    await userEvent.click(botao())
    expect(await screen.findAllByText('Campo obrigatório.')).toHaveLength(5)
    await waitFor(() => expect(campo(R.nome)).toHaveFocus())
    expect(aoEnviar).not.toHaveBeenCalled()
  })

  it.each([
    ['veículo 0', R.veiculo, '0', 'O valor do veículo deve estar entre 0,01 e 9.999.999,00.'],
    ['veículo acima do teto', R.veiculo, '10000000', 'O valor do veículo deve estar entre 0,01 e 9.999.999,00.'],
    ['veículo com 3 casas', R.veiculo, '95000,123', 'Use no máximo 2 casas decimais.'],
    ['IPCA abaixo do limite', R.ipca, '-21', 'A taxa de IPCA projetada deve estar entre -20 e 100.'],
    ['IPCA acima do limite', R.ipca, '101', 'A taxa de IPCA projetada deve estar entre -20 e 100.'],
    ['IPCA com 7 casas', R.ipca, '4,1234567', 'Use no máximo 6 casas decimais.'],
    ['rendimento negativo', R.fundo, '-1', 'A taxa de rendimento do fundo deve estar entre 0 e 100.'],
    ['prazo 61', R.prazo, '61', 'O prazo do fundo (em meses) deve estar entre 1 e 60.'],
    ['prazo 0', R.prazo, '0', 'O prazo do fundo (em meses) deve estar entre 1 e 60.'],
    ['prazo fracionado', R.prazo, '12,5', 'Número inteiro inválido.'],
    ['taxa com ponto (12.5)', R.fundo, '12.5', 'Use vírgula para decimais (ex.: 12,5) e ponto só para milhares (ex.: 1.234,56).'],
    ['letras no veículo', R.veiculo, 'abc', 'Use vírgula para decimais (ex.: 12,5) e ponto só para milhares (ex.: 1.234,56).'],
  ])('%s', async (_rotulo, rotulo, digitado, mensagem) => {
    const { aoEnviar } = abrir()
    await preencher({ ...VALIDOS, valorEntrada: '0' })
    await userEvent.clear(campo(rotulo))
    await userEvent.type(campo(rotulo), digitado)
    await userEvent.click(botao())
    expect(await screen.findByText(mensagem)).toBeInTheDocument()
    expect(campo(rotulo)).toHaveAttribute('aria-invalid', 'true')
    expect(aoEnviar).not.toHaveBeenCalled()
  })

  it('entrada maior que o veículo: erro NA ENTRADA; igual ao veículo é aceito (controle)', async () => {
    const { aoEnviar } = abrir()
    await preencher({ ...VALIDOS, valorVeiculo: '50000', valorEntrada: '50000,01' })
    await userEvent.click(botao())
    expect(await screen.findByText('A entrada não pode ser maior que o valor do veículo.')).toBeInTheDocument()
    expect(campo(R.entrada)).toHaveAttribute('aria-invalid', 'true')
    expect(aoEnviar).not.toHaveBeenCalled()

    await userEvent.clear(campo(R.entrada))
    await userEvent.type(campo(R.entrada), '50000')
    await userEvent.click(botao())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
  })

  it('reduzir o veículo abaixo da entrada mostra o erro na entrada ao sair do veículo (revalidação cruzada), sem enviar', async () => {
    abrir()
    await preencher({ ...VALIDOS, valorVeiculo: '95000', valorEntrada: '60000' })
    await userEvent.tab()
    expect(screen.queryByText('A entrada não pode ser maior que o valor do veículo.')).not.toBeInTheDocument()

    await userEvent.clear(campo(R.veiculo))
    await userEvent.type(campo(R.veiculo), '50000')
    await userEvent.tab()
    expect(await screen.findByText('A entrada não pode ser maior que o valor do veículo.')).toBeInTheDocument()
  })

  it('nome só com espaços é tratado como vazio', async () => {
    const { aoEnviar } = abrir()
    await preencher({ ...VALIDOS, nome: '   ' })
    await userEvent.click(botao())
    expect(await screen.findByText('Campo obrigatório.')).toBeInTheDocument()
    expect(aoEnviar).not.toHaveBeenCalled()
  })

  it('o erro de um campo aparece ao sair dele (sem precisar enviar)', async () => {
    abrir()
    await userEvent.type(campo(R.prazo), '99')
    await userEvent.tab()
    expect(await screen.findByText('O prazo do fundo (em meses) deve estar entre 1 e 60.')).toBeInTheDocument()
  })
})

describe('FormularioSimulacao: erros do servidor', () => {
  const erro422 = (detalhes) => new ErroApi({ status: 422, erro: 'Dados inválidos', detalhes })

  it('422 vai para o campo certo (snake_case -> formulário), com a mensagem real, e o foco no primeiro', async () => {
    const aoEnviar = vi.fn().mockRejectedValue(
      erro422({
        valor_veiculo: ['O valor do veículo deve ser maior que a entrada da opção de financiamento "Banco X" (R$ 50.000,00). Ajuste a opção antes.'],
        prazo_meses_fundo: ['O prazo do fundo (em meses) deve estar entre 1 e 60.'],
      }),
    )
    abrir({ aoEnviar })
    await preencher()
    await userEvent.click(botao())

    expect(await screen.findByText(/Ajuste a opção antes\./)).toBeInTheDocument()
    expect(campo(R.veiculo)).toHaveAttribute('aria-invalid', 'true')
    expect(campo(R.prazo)).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(campo(R.veiculo)).toHaveFocus())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(botao()).toBeEnabled()
  })

  it('chave desconhecida do servidor vira alerta geral (e os campos conhecidos continuam marcados)', async () => {
    const aoEnviar = vi.fn().mockRejectedValue(erro422({ valor_entrada: ['Entrada inválida.'], usuario_id: ['Campo desconhecido.'] }))
    abrir({ aoEnviar })
    await preencher()
    await userEvent.click(botao())
    expect(await screen.findByText('Entrada inválida.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Dados inválidos')
  })

  it('servidor fora do ar: alerta com a mensagem de rede, dados mantidos e botão de volta', async () => {
    const aoEnviar = vi.fn().mockRejectedValue(new ErroRede())
    abrir({ aoEnviar })
    await preencher()
    await userEvent.click(botao())
    expect(await screen.findByText('Não foi possível falar com o servidor.')).toBeInTheDocument()
    expect(campo(R.nome)).toHaveValue('Onix 2026')
    expect(botao()).toBeEnabled()
  })

  it('erro 500 (sem detalhes): alerta com a mensagem do servidor', async () => {
    const aoEnviar = vi.fn().mockRejectedValue(new ErroApi({ status: 500, erro: 'Erro interno do servidor' }))
    abrir({ aoEnviar })
    await preencher()
    await userEvent.click(botao())
    expect(await screen.findByText('Erro interno do servidor')).toBeInTheDocument()
  })

  it('o alerta some no envio seguinte e dá para enviar de novo com sucesso', async () => {
    const aoEnviar = vi.fn().mockRejectedValueOnce(new ErroRede()).mockResolvedValue(undefined)
    abrir({ aoEnviar })
    await preencher()
    await userEvent.click(botao())
    await screen.findByText('Não foi possível falar com o servidor.')

    await userEvent.click(botao())
    await waitFor(() => expect(screen.queryByText('Não foi possível falar com o servidor.')).not.toBeInTheDocument())
    expect(aoEnviar).toHaveBeenCalledTimes(2)
  })
})

describe('FormularioSimulacao: duplo envio', () => {
  it('desabilita o botão durante a requisição ("Salvando…") e só sai UMA chamada (clique forçado e Enter)', async () => {
    let concluir
    const aoEnviar = vi.fn(() => new Promise((resolver) => { concluir = resolver }))
    const forcado = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never })
    abrir({ aoEnviar })
    await preencher()
    await userEvent.click(botao())

    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeDisabled()
    await forcado.click(screen.getByRole('button', { name: 'Salvando…' }))
    await forcado.type(campo(R.nome), '{Enter}')
    expect(aoEnviar).toHaveBeenCalledTimes(1)

    concluir(undefined)
    await waitFor(() => expect(botao()).toBeEnabled())
    expect(aoEnviar).toHaveBeenCalledTimes(1)
  })
})
