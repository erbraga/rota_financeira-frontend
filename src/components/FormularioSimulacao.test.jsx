import { act, screen, waitFor } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ErroApi, ErroRede } from '../api/erros.js'
import { INDICES } from '../mocks/handlers/indices.js'
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

// ---- Sugestões do Banco Central (Etapa 4) ----------------------------------------------------------------------
// As consultas são simuladas (a integração com o MSW está em pages/SimulacaoForm.test.jsx): aqui interessa o que o
// formulário faz com o momento em que a sugestão chega.
const consulta = (estado, extra = {}) => ({
  isPending: estado === 'carregando',
  isError: estado === 'erro',
  isFetching: estado === 'carregando',
  data: estado === 'ok' ? extra.data : undefined,
  refetch: vi.fn(),
})
const ok = (indice, alteracoes = {}) => consulta('ok', { data: { ...INDICES[indice], ...alteracoes } })
const naoChegou = () => ({ taxaFundoRendimento: consulta('carregando'), taxaIpcaProjetada: consulta('carregando') })
const chegou = (alteracoes) => ({ taxaFundoRendimento: ok('cdi', alteracoes), taxaIpcaProjetada: ok('ipca', alteracoes) })

// Controla a chegada das consultas SEM clicar em nada (um clique tiraria o foco do campo e o tocaria).
const ganchos = { chegar: null }
function ComSugestoes({ inicial = naoChegou(), aoEnviar = vi.fn().mockResolvedValue(undefined), valores = valoresIniciais(), preencher = true }) {
  const [sugestoes, setSugestoes] = useState(inicial)
  useEffect(() => {
    ganchos.chegar = setSugestoes
  }, [])
  return <FormularioSimulacao valoresIniciais={valores} aoEnviar={aoEnviar} sugestoes={sugestoes} preencherSugestoes={preencher} />
}
const abrirComSugestoes = (ui) => renderizar(ui)
const chegar = (sugestoes) => act(async () => ganchos.chegar(sugestoes))
const salvos = deSimulacaoParaForm({
  nome: 'Onix',
  valor_veiculo: 95000,
  valor_entrada: 20000,
  taxa_ipca_projetada: 5,
  taxa_fundo_rendimento: 11,
  prazo_meses_fundo: 36,
})

describe('FormularioSimulacao: sugestões preenchem a simulação nova', () => {
  it('enquanto busca, os campos ficam vazios e digitáveis; quando chega, preenche só as duas taxas', async () => {
    abrirComSugestoes(<ComSugestoes />)
    expect(campo(R.fundo)).toHaveValue('')
    expect(campo(R.ipca)).toHaveValue('')
    expect(screen.getAllByText('Buscando a sugestão do Banco Central…')).toHaveLength(2)
    await userEvent.type(campo(R.nome), 'Onix') // digitável durante a espera

    await chegar(chegou())
    expect(campo(R.fundo)).toHaveValue('13,65')
    expect(campo(R.ipca)).toHaveValue('4,22')
    expect(campo(R.nome)).toHaveValue('Onix')
    expect(campo(R.veiculo)).toHaveValue('')
    expect(campo(R.entrada)).toHaveValue('0,00')
    expect(campo(R.prazo)).toHaveValue('')
    expect(screen.queryByText(/entre 0 e 100/)).not.toBeInTheDocument()
  })

  it('cada linha de apoio mostra a origem e o botão Usar de SEU índice', async () => {
    abrirComSugestoes(<ComSugestoes />)
    await chegar(chegou())
    expect(document.getElementById('sugestao-taxaFundoRendimento').textContent).toContain('CDI de 24/09/2026')
    expect(document.getElementById('sugestao-taxaIpcaProjetada').textContent).toContain('até ago/2026')
    expect(screen.getByRole('button', { name: 'Usar a sugestão do CDI: 13,65%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar a sugestão do IPCA: 4,22%' })).toBeInTheDocument()
  })

  it('o campo é descrito pela ajuda E pela linha de apoio (aria-describedby)', () => {
    abrirComSugestoes(<ComSugestoes />)
    const ids = campo(R.fundo).getAttribute('aria-describedby').split(' ')
    expect(ids).toContain('sugestao-taxaFundoRendimento')
    expect(document.getElementById(ids[0])).toHaveTextContent('De 0 a 100. Por exemplo, o CDI')
  })

  it('NÃO sobrescreve o que foi digitado antes da resposta; o campo intocado é preenchido (controle)', async () => {
    abrirComSugestoes(<ComSugestoes />)
    await userEvent.type(campo(R.fundo), '12') // digitou e continua no campo
    await chegar(chegou())
    expect(campo(R.fundo)).toHaveValue('12')
    expect(campo(R.ipca)).toHaveValue('4,22') // controle: o outro campo estava intocado
    // a sugestão continua disponível, só com o botão
    expect(screen.getByRole('button', { name: 'Usar a sugestão do CDI: 13,65%' })).toBeInTheDocument()
  })

  it('NÃO preenche o campo em que a pessoa digitou, apagou e saiu (já foi tocado)', async () => {
    abrirComSugestoes(<ComSugestoes />)
    await userEvent.type(campo(R.fundo), '12')
    await userEvent.clear(campo(R.fundo))
    await userEvent.tab()
    await chegar(chegou())
    expect(campo(R.fundo)).toHaveValue('')
    expect(campo(R.ipca)).toHaveValue('4,22')
  })

  it('a sugestão é aplicada UMA vez: uma resposta nova depois não sobrescreve o que a pessoa fez', async () => {
    abrirComSugestoes(<ComSugestoes />)
    await chegar(chegou())
    await userEvent.clear(campo(R.fundo))
    await userEvent.type(campo(R.fundo), '9')
    await userEvent.tab()
    await chegar(chegou({ sugestao: { valor: 14, data_referencia: '2026-09-25' } }))
    expect(campo(R.fundo)).toHaveValue('9')
    expect(campo(R.ipca)).toHaveValue('4,22') // o outro também não muda
    // ... mas a linha de apoio mostra o valor novo
    expect(screen.getByRole('button', { name: 'Usar a sugestão do CDI: 14,00%' })).toBeInTheDocument()
  })

  it('uma sugestão que chega ao montar (cache) já preenche', () => {
    abrirComSugestoes(<ComSugestoes inicial={chegou()} />)
    expect(campo(R.fundo)).toHaveValue('13,65')
    expect(campo(R.ipca)).toHaveValue('4,22')
  })

  it('o valor pré-preenchido é enviado como NÚMERO (13,65 -> 13.65)', async () => {
    const aoEnviar = vi.fn().mockResolvedValue(undefined)
    abrirComSugestoes(<ComSugestoes aoEnviar={aoEnviar} />)
    await chegar(chegou())
    await preencher({ nome: 'Onix', valorVeiculo: '95000', valorEntrada: '20000', prazoMesesFundo: '36' })
    await userEvent.click(botao())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
    const corpo = aoEnviar.mock.calls[0][0]
    expect(corpo.taxa_fundo_rendimento).toBe(13.65)
    expect(corpo.taxa_ipca_projetada).toBe(4.22)
    expect(typeof corpo.taxa_fundo_rendimento).toBe('number')
  })
})

describe('FormularioSimulacao: botão Usar', () => {
  it('restaura a sugestão depois de editar, valida e devolve o foco ao campo', async () => {
    abrirComSugestoes(<ComSugestoes />)
    await chegar(chegou())
    await userEvent.clear(campo(R.fundo))
    await userEvent.type(campo(R.fundo), '150')
    await userEvent.tab()
    expect(await screen.findByText('A taxa de rendimento do fundo deve estar entre 0 e 100.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Usar a sugestão do CDI: 13,65%' }))
    expect(campo(R.fundo)).toHaveValue('13,65')
    await waitFor(() => expect(campo(R.fundo)).toHaveFocus())
    await waitFor(() => expect(screen.queryByText(/entre 0 e 100/)).not.toBeInTheDocument()) // validou
  })

  it('preenche um campo que estava vazio depois de tocado (apagar e sair -> Usar)', async () => {
    abrirComSugestoes(<ComSugestoes />)
    await userEvent.type(campo(R.ipca), '3')
    await userEvent.clear(campo(R.ipca))
    await userEvent.tab()
    await chegar(chegou())
    expect(campo(R.ipca)).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Usar a sugestão do IPCA: 4,22%' }))
    expect(campo(R.ipca)).toHaveValue('4,22')
  })
})

describe('FormularioSimulacao: edição não é sobrescrita', () => {
  it('os valores gravados ficam intactos quando a sugestão chega (e a sugestão aparece só como informação)', async () => {
    abrirComSugestoes(<ComSugestoes valores={salvos} preencher={false} />)
    await chegar(chegou())
    expect(campo(R.fundo)).toHaveValue('11')
    expect(campo(R.ipca)).toHaveValue('5')
    expect(screen.getByRole('button', { name: 'Usar a sugestão do CDI: 13,65%' })).toBeInTheDocument()
  })

  it('só o clique em Usar muda o campo na edição', async () => {
    abrirComSugestoes(<ComSugestoes valores={salvos} preencher={false} />)
    await chegar(chegou())
    await userEvent.click(screen.getByRole('button', { name: 'Usar a sugestão do CDI: 13,65%' }))
    expect(campo(R.fundo)).toHaveValue('13,65')
    expect(campo(R.ipca)).toHaveValue('5') // o outro segue como estava
  })

  it('controle: com preencherSugestoes ligado, o mesmo campo intocado seria preenchido', async () => {
    abrirComSugestoes(<ComSugestoes valores={{ ...salvos, taxaFundoRendimento: '' }} preencher />)
    await chegar(chegou())
    expect(campo(R.fundo)).toHaveValue('13,65')
  })
})

describe('FormularioSimulacao: sugestão ausente, defasada ou com erro não bloqueia o envio', () => {
  async function enviarCom(sugestoes, digitadas) {
    const aoEnviar = vi.fn().mockResolvedValue(undefined)
    abrirComSugestoes(<ComSugestoes inicial={sugestoes} aoEnviar={aoEnviar} />)
    await preencher({ nome: 'Onix', valorVeiculo: '95000', valorEntrada: '20000', prazoMesesFundo: '36', ...digitadas })
    await userEvent.click(botao())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
    return aoEnviar.mock.calls[0][0]
  }

  it('desatualizado: pré-preenche, avisa e envia normalmente', async () => {
    const corpo = await enviarCom(chegou({ desatualizado: true }), {})
    expect(screen.getAllByText('Dados do cache, podem estar defasados.')).toHaveLength(2)
    expect(corpo).toMatchObject({ taxa_fundo_rendimento: 13.65, taxa_ipca_projetada: 4.22 })
  })

  it('sugestao null: nada é preenchido, sem botão Usar, e as taxas digitadas são enviadas', async () => {
    const sugestoes = chegou({ sugestao: null })
    const corpo = await enviarCom(sugestoes, { taxaFundoRendimento: '12', taxaIpcaProjetada: '4,5' })
    expect(screen.getAllByText('Sem sugestão do Banco Central disponível agora. Digite a taxa.')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Usar a sugestão/ })).not.toBeInTheDocument()
    expect(corpo).toMatchObject({ taxa_fundo_rendimento: 12, taxa_ipca_projetada: 4.5 })
  })

  it('erro (503, rede): aviso nos dois campos, Tentar de novo, e o envio funciona com as taxas digitadas', async () => {
    const sugestoes = { taxaFundoRendimento: consulta('erro'), taxaIpcaProjetada: consulta('erro') }
    const corpo = await enviarCom(sugestoes, { taxaFundoRendimento: '12', taxaIpcaProjetada: '4,5' })
    expect(screen.getAllByText(/Não foi possível obter a sugestão do Banco Central agora/)).toHaveLength(2)
    expect(corpo).toMatchObject({ taxa_fundo_rendimento: 12, taxa_ipca_projetada: 4.5 })
  })

  it('só o CDI falha: o IPCA continua com a sua sugestão (linhas independentes)', async () => {
    const sugestoes = { taxaFundoRendimento: consulta('erro'), taxaIpcaProjetada: ok('ipca') }
    abrirComSugestoes(<ComSugestoes inicial={sugestoes} />)
    expect(campo(R.fundo)).toHaveValue('')
    expect(campo(R.ipca)).toHaveValue('4,22')
    expect(screen.getAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(1)
  })

  it('Tentar de novo refaz só a consulta daquele campo', async () => {
    const sugestoes = { taxaFundoRendimento: consulta('erro'), taxaIpcaProjetada: consulta('erro') }
    abrirComSugestoes(<ComSugestoes inicial={sugestoes} />)
    const [doCdi, doIpca] = [sugestoes.taxaFundoRendimento, sugestoes.taxaIpcaProjetada]
    await userEvent.click(screen.getAllByRole('button', { name: 'Tentar de novo' })[1])
    expect(doIpca.refetch).toHaveBeenCalledTimes(1)
    expect(doCdi.refetch).not.toHaveBeenCalled()
  })

  it('depois do erro, a sugestão que chega preenche o campo que continua intocado', async () => {
    const sugestoes = { taxaFundoRendimento: consulta('erro'), taxaIpcaProjetada: consulta('erro') }
    abrirComSugestoes(<ComSugestoes inicial={sugestoes} />)
    await chegar(chegou())
    expect(campo(R.fundo)).toHaveValue('13,65')
  })
})
