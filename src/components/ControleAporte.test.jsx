import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ControleAporte from './ControleAporte.jsx'

const campo = () => screen.getByLabelText('E se eu guardar (R$ por mês)?')
const simular = () => screen.getByRole('button', { name: /^Simular$|^Simulando/ })

function mostrar(props = {}) {
  const aoSimular = vi.fn()
  const aoVoltar = vi.fn()
  const resultado = render(<ControleAporte aoSimular={aoSimular} aoVoltar={aoVoltar} {...props} />)
  return { aoSimular, aoVoltar, ...resultado }
}

async function digitar(texto) {
  await userEvent.clear(campo())
  if (texto !== '') await userEvent.type(campo(), texto)
}

describe('ControleAporte: simular', () => {
  it.each([
    ['1500', 1500],
    ['1.500,50', 1500.5],
    ['1500,5', 1500.5],
    ['0', 0],
    ['9999999', 9999999],
  ])('%s chama aoSimular com o NÚMERO %s', async (texto, numero) => {
    const { aoSimular } = mostrar()
    await digitar(texto)
    await userEvent.click(simular())
    expect(aoSimular).toHaveBeenCalledExactlyOnceWith(numero)
  })

  it('envia com Enter', async () => {
    const { aoSimular } = mostrar()
    await userEvent.type(campo(), '1500{Enter}')
    expect(aoSimular).toHaveBeenCalledExactlyOnceWith(1500)
  })

  it.each([
    ['', 'Informe quanto você guardaria por mês.'],
    ['   ', 'Informe quanto você guardaria por mês.'],
    ['abc', 'Use vírgula para decimais (ex.: 12,5) e ponto só para milhares (ex.: 1.234,56).'],
    ['1500.5', 'Use vírgula para decimais (ex.: 12,5) e ponto só para milhares (ex.: 1.234,56).'],
    ['-1', 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.'],
    ['9.999.999,01', 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.'],
    ['10.000.000', 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.'],
    ['1500,505', 'Use no máximo 2 casas decimais.'],
  ])('"%s": mensagem no campo e NENHUMA chamada (o inválido nunca vai ao servidor)', async (texto, mensagem) => {
    const { aoSimular } = mostrar()
    await digitar(texto)
    await userEvent.click(simular())
    expect(screen.getByText(mensagem)).toBeInTheDocument()
    expect(campo()).toHaveAttribute('aria-invalid', 'true')
    expect(aoSimular).not.toHaveBeenCalled()
  })

  it('a mensagem some ao voltar a digitar, e o valor certo passa (controle)', async () => {
    const { aoSimular } = mostrar()
    await digitar('abc')
    await userEvent.click(simular())
    expect(campo()).toHaveAttribute('aria-invalid', 'true')
    await digitar('1500')
    expect(campo()).not.toHaveAttribute('aria-invalid', 'true')
    await userEvent.click(simular())
    expect(aoSimular).toHaveBeenCalledExactlyOnceWith(1500)
  })

  it('o campo tem rótulo e a ajuda da faixa', () => {
    mostrar()
    expect(campo()).toBeInTheDocument()
    expect(screen.getByText('De 0,00 a 9.999.999,00; use vírgula nos centavos')).toBeInTheDocument()
  })
})

describe('ControleAporte: com um aporte em uso', () => {
  it('mostra o valor atual no formato de campo e o botão Voltar ao valor calculado', async () => {
    const { aoVoltar } = mostrar({ valorAtual: 1500.5 })
    expect(campo()).toHaveValue('1500,5')
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao valor calculado' }))
    expect(aoVoltar).toHaveBeenCalledTimes(1)
  })

  it('controle: SEM aporte o botão Voltar não existe e o campo vem vazio', () => {
    mostrar()
    expect(campo()).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Voltar ao valor calculado' })).not.toBeInTheDocument()
  })

  it('o aporte zero é um aporte (mostra "0" e o botão Voltar)', () => {
    mostrar({ valorAtual: 0 })
    expect(campo()).toHaveValue('0')
    expect(screen.getByRole('button', { name: 'Voltar ao valor calculado' })).toBeInTheDocument()
  })

  it('o campo acompanha o valor de fora (Voltar do navegador troca o aporte do endereço)', async () => {
    function Pai() {
      const [valor, setValor] = useState(1500)
      return (
        <>
          <button onClick={() => setValor(undefined)}>sem aporte</button>
          <button onClick={() => setValor(250.75)}>outro aporte</button>
          <ControleAporte valorAtual={valor} aoSimular={vi.fn()} aoVoltar={vi.fn()} />
        </>
      )
    }
    render(<Pai />)
    expect(campo()).toHaveValue('1500')
    await userEvent.click(screen.getByRole('button', { name: 'outro aporte' }))
    expect(campo()).toHaveValue('250,75')
    await userEvent.click(screen.getByRole('button', { name: 'sem aporte' }))
    expect(campo()).toHaveValue('')
  })

  it('o que foi digitado e ainda não simulado NÃO é apagado quando outra coisa da tela muda (mesmo valor de fora)', async () => {
    const { rerender } = mostrar({ valorAtual: 1500 })
    await digitar('999')
    rerender(<ControleAporte valorAtual={1500} aoSimular={vi.fn()} aoVoltar={vi.fn()} ocupado={false} />)
    expect(campo()).toHaveValue('999')
  })
})

describe('ControleAporte: endereço com valor inválido e erro do servidor', () => {
  it('mostra o texto do endereço no campo e o aviso, e oferece voltar ao valor calculado', () => {
    mostrar({ textoInvalido: '1500.5', erroDoEndereco: 'Use vírgula para decimais (ex.: 12,5) e ponto só para milhares (ex.: 1.234,56).' })
    expect(campo()).toHaveValue('1500.5')
    expect(screen.getByText(/Use vírgula para decimais/)).toBeInTheDocument()
    expect(campo()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Voltar ao valor calculado' })).toBeInTheDocument()
  })

  it('o erro do servidor (422) aparece no campo', () => {
    mostrar({ valorAtual: 1500, erroDoServidor: 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.' })
    expect(screen.getByText('O aporte mensal deve estar entre 0,00 e 9.999.999,00.')).toBeInTheDocument()
    expect(campo()).toHaveAttribute('aria-invalid', 'true')
  })

  it('o erro local vem antes do de fora (o que a pessoa acabou de digitar é o que importa)', async () => {
    mostrar({ textoInvalido: 'abc', erroDoEndereco: 'erro do endereço' })
    await digitar('-1')
    await userEvent.click(simular())
    expect(screen.getByText('O aporte mensal deve estar entre 0,00 e 9.999.999,00.')).toBeInTheDocument()
    expect(screen.queryByText('erro do endereço')).not.toBeInTheDocument()
  })
})

describe('ControleAporte: ocupado', () => {
  it('durante a busca desabilita Simular ("Simulando…") e Voltar, e não envia de novo', async () => {
    const { aoSimular } = mostrar({ valorAtual: 1500, ocupado: true })
    expect(screen.getByRole('button', { name: 'Simulando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Voltar ao valor calculado' })).toBeDisabled()
    await userEvent.type(campo(), '{Enter}')
    expect(aoSimular).not.toHaveBeenCalled() // o botão de envio está desabilitado
  })
})
