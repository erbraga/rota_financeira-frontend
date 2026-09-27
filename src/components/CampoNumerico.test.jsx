import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import CampoNumerico from './CampoNumerico.jsx'

// Formulário mínimo: um campo; o resolver devolve o erro do teste (se houver), para conferir a exibição.
const captura = { formulario: null }
function Formulario({ formato, valorInicial = '', erro, ajuda }) {
  const formulario = useForm({
    defaultValues: { campo: valorInicial },
    mode: 'onBlur',
    resolver: () => ({ values: {}, errors: erro ? { campo: { type: 'x', message: erro } } : {} }),
  })
  useEffect(() => {
    captura.formulario = formulario
  })
  return <CampoNumerico control={formulario.control} name="campo" label="Campo" formato={formato} helperText={ajuda} />
}

const campo = () => screen.getByLabelText('Campo')

// Digita e sai do campo (Tab), como a pessoa faria.
async function digitarESair(texto) {
  await userEvent.clear(campo())
  if (texto !== '') await userEvent.type(campo(), texto)
  await userEvent.tab()
}

describe('CampoNumerico: dinheiro (2 casas, com milhar)', () => {
  it.each([
    ['95000,5', '95.000,50'],
    ['0', '0,00'],
    ['20.000', '20.000,00'],
    ['1234,56', '1.234,56'],
    ['9999999', '9.999.999,00'],
    ['0,01', '0,01'],
  ])('%s -> %s ao sair', async (digitado, esperado) => {
    render(<Formulario formato="dinheiro" />)
    await digitarESair(digitado)
    expect(campo()).toHaveValue(esperado)
  })

  it('NÃO reformata enquanto digita (só ao sair)', async () => {
    render(<Formulario formato="dinheiro" />)
    await userEvent.type(campo(), '95000')
    expect(campo()).toHaveValue('95000')
    await userEvent.tab()
    expect(campo()).toHaveValue('95.000,00')
  })

  it('com 3 casas NÃO é reescrito (nunca arredonda): fica como digitado para o esquema mostrar o erro', async () => {
    render(<Formulario formato="dinheiro" />)
    await digitarESair('0,123')
    expect(campo()).toHaveValue('0,123')
  })

  it('com 2 casas é reescrito normalmente (controle das 3 casas)', async () => {
    render(<Formulario formato="dinheiro" />)
    await digitarESair('0,12')
    expect(campo()).toHaveValue('0,12')
    await digitarESair('5,5')
    expect(campo()).toHaveValue('5,50')
  })

  it.each(['12.5', '0.85', 'abc', '1e3', '1,2,3', '--1', '95.00'])('inválido (%s) fica como digitado', async (digitado) => {
    render(<Formulario formato="dinheiro" />)
    await digitarESair(digitado)
    expect(campo()).toHaveValue(digitado)
  })

  it('vazio continua vazio', async () => {
    render(<Formulario formato="dinheiro" valorInicial="10,00" />)
    await digitarESair('')
    expect(campo()).toHaveValue('')
  })
})

describe('CampoNumerico: taxa (até 6 casas, sem zeros inúteis)', () => {
  it.each([
    ['12,50', '12,5'],
    ['0,850000', '0,85'],
    ['12', '12'],
    ['4,123456', '4,123456'],
    ['-20', '-20'],
    ['100,0', '100'],
  ])('%s -> %s ao sair', async (digitado, esperado) => {
    render(<Formulario formato="taxa" />)
    await digitarESair(digitado)
    expect(campo()).toHaveValue(esperado)
  })

  it('com 7 casas fica como digitado (não arredonda)', async () => {
    render(<Formulario formato="taxa" />)
    await digitarESair('4,1234567')
    expect(campo()).toHaveValue('4,1234567')
  })
})

describe('CampoNumerico: inteiro', () => {
  it.each([
    ['36', '36'],
    ['36,0', '36'],
    ['60', '60'],
  ])('%s -> %s ao sair', async (digitado, esperado) => {
    render(<Formulario formato="inteiro" />)
    await digitarESair(digitado)
    expect(campo()).toHaveValue(esperado)
  })

  it.each(['12,5', '36,0001', 'abc'])('%s não é inteiro: fica como digitado', async (digitado) => {
    render(<Formulario formato="inteiro" />)
    await digitarESair(digitado)
    expect(campo()).toHaveValue(digitado)
  })
})

describe('CampoNumerico: atributos, erro e integração com o formulário', () => {
  it.each([
    ['dinheiro', 'decimal'],
    ['taxa', 'decimal'],
    ['inteiro', 'numeric'],
  ])('%s usa inputMode "%s" (teclado numérico no celular) e não sugere autopreenchimento', (formato, modo) => {
    render(<Formulario formato={formato} />)
    expect(campo()).toHaveAttribute('inputmode', modo)
    expect(campo()).toHaveAttribute('autocomplete', 'off')
  })

  it('mostra a ajuda quando não há erro', () => {
    render(<Formulario formato="dinheiro" ajuda="de 0,01 a 9.999.999,00" />)
    expect(screen.getByText('de 0,01 a 9.999.999,00')).toBeInTheDocument()
    expect(campo()).toHaveAttribute('aria-invalid', 'false')
  })

  it('mostra o erro do esquema no lugar da ajuda (aria-invalid) ao sair do campo', async () => {
    render(<Formulario formato="dinheiro" erro="Valor fora da faixa." ajuda="de 0,01 a 9.999.999,00" />)
    await digitarESair('0')
    expect(await screen.findByText('Valor fora da faixa.')).toBeInTheDocument()
    expect(screen.queryByText('de 0,01 a 9.999.999,00')).not.toBeInTheDocument()
    expect(campo()).toHaveAttribute('aria-invalid', 'true')
  })

  it('o valor reformatado é o que fica no estado do formulário', async () => {
    render(<Formulario formato="dinheiro" />)
    await digitarESair('95000,5')
    expect(captura.formulario.getValues('campo')).toBe('95.000,50')
  })

  it('mostra o valor inicial e acompanha um reset do formulário', async () => {
    render(<Formulario formato="dinheiro" valorInicial="20.000,00" />)
    expect(campo()).toHaveValue('20.000,00')
    act(() => captura.formulario.reset({ campo: '1.500,00' }))
    expect(campo()).toHaveValue('1.500,00')
  })

  it('aceita o foco pela ref do formulário (setFocus é assíncrono)', async () => {
    render(<Formulario formato="dinheiro" />)
    await act(async () => captura.formulario.setFocus('campo'))
    await waitFor(() => expect(campo()).toHaveFocus())
  })

  it('repassa o rótulo e as demais props ao campo', () => {
    render(<Formulario formato="dinheiro" />)
    expect(screen.getByLabelText('Campo')).toBeInTheDocument()
  })
})
