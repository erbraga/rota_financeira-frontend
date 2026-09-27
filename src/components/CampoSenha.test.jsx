import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import CampoSenha from './CampoSenha.jsx'

// Quem usa controla o estado "mostrar".
function Exemplo(props) {
  const [mostrar, setMostrar] = useState(false)
  return <CampoSenha label="Senha" mostrar={mostrar} aoAlternar={() => setMostrar((v) => !v)} {...props} />
}

describe('CampoSenha', () => {
  it('começa com a senha oculta e o botão "Mostrar senha"', () => {
    render(<Exemplo />)
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
    const botao = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(botao).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicar alterna o tipo do campo, o nome acessível e o aria-pressed (e volta)', async () => {
    render(<Exemplo />)
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text')
    const ocultar = screen.getByRole('button', { name: 'Ocultar senha' })
    expect(ocultar).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(ocultar)
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument()
  })

  it('o clique no botão NÃO tira o foco do campo', async () => {
    render(<Exemplo />)
    const campo = screen.getByLabelText('Senha')
    await userEvent.click(campo)
    expect(campo).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(campo).toHaveFocus()
  })

  it('o que foi digitado é preservado ao alternar', async () => {
    render(<Exemplo />)
    await userEvent.type(screen.getByLabelText('Senha'), 'minha senha')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveValue('minha senha')
  })

  it('nome acessível do botão usa a descrição (campo de confirmação)', () => {
    render(<Exemplo label="Confirmar senha" descricao="confirmação da senha" />)
    expect(screen.getByRole('button', { name: 'Mostrar confirmação da senha' })).toBeInTheDocument()
  })

  it('mostra a ajuda e o erro do campo', () => {
    const { rerender } = render(<Exemplo helperText="8 a 128 caracteres" />)
    expect(screen.getByText('8 a 128 caracteres')).toBeInTheDocument()

    rerender(<Exemplo error helperText="A senha deve ter entre 8 e 128 caracteres." />)
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('A senha deve ter entre 8 e 128 caracteres.')).toBeInTheDocument()
  })

  it('dois campos com o mesmo estado alternam juntos (uso no cadastro)', async () => {
    function Cadastro() {
      const [mostrar, setMostrar] = useState(false)
      const alternar = () => setMostrar((v) => !v)
      return (
        <>
          <CampoSenha label="Senha" mostrar={mostrar} aoAlternar={alternar} />
          <CampoSenha label="Confirmar senha" mostrar={mostrar} aoAlternar={alternar} descricao="confirmação da senha" />
        </>
      )
    }
    render(<Cadastro />)
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Confirmar senha')).toHaveAttribute('type', 'text')
  })

  it('funciona com o React Hook Form: registra o valor e aceita o foco pela ref', async () => {
    const captura = { formulario: null }
    function Formulario() {
      const { register, setFocus, getValues } = useForm({ defaultValues: { senha: '' } })
      useEffect(() => {
        captura.formulario = { setFocus, getValues }
      })
      const [mostrar, setMostrar] = useState(false)
      return <CampoSenha label="Senha" mostrar={mostrar} aoAlternar={() => setMostrar((v) => !v)} {...register('senha')} />
    }
    render(<Formulario />)
    await userEvent.type(screen.getByLabelText('Senha'), 'abc12345')
    expect(captura.formulario.getValues('senha')).toBe('abc12345')

    // Tira o foco e o devolve pela ref do React Hook Form (é assim que ele foca o primeiro campo inválido).
    act(() => document.activeElement.blur())
    expect(screen.getByLabelText('Senha')).not.toHaveFocus()
    // O setFocus do React Hook Form é assíncrono.
    await act(async () => captura.formulario.setFocus('senha'))
    await waitFor(() => expect(screen.getByLabelText('Senha')).toHaveFocus())
  })
})
