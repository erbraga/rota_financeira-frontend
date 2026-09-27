import { screen, waitFor } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SoVisitantes from '../auth/SoVisitantes.jsx'
import { useAuth } from '../auth/useAuth.js'
import { criarUsuario } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { renderizarComAuth } from '../testUtils.jsx'
import Registro from './Registro.jsx'

const REGISTRAR = 'http://localhost:5000/api/auth/registrar'

// Login de mentira: mostra o que o Registro entregou pelo estado da rota e o aviso da sessão.
function LoginFalso() {
  const { state } = useLocation()
  const { aviso } = useAuth()
  return (
    <div>
      <p>tela de login</p>
      <p data-testid="motivo">{state?.motivo ?? 'sem-motivo'}</p>
      <p data-testid="email">{state?.email ?? 'sem-email'}</p>
      <p data-testid="aviso">{aviso ?? 'sem-aviso'}</p>
    </div>
  )
}

function Rotas() {
  return (
    <Routes>
      <Route element={<SoVisitantes />}>
        <Route path="/registrar" element={<Registro />} />
        <Route path="/login" element={<LoginFalso />} />
      </Route>
    </Routes>
  )
}

let pedidos

beforeEach(() => {
  servidor.use(...handlers)
  criarUsuario({ nome: 'Ana Souza', email: 'ana@example.com', senha: 'senha da ana' })
  pedidos = []
  servidor.events.on('request:start', ({ request }) => pedidos.push(`${request.method} ${new URL(request.url).pathname}`))
})

afterEach(() => servidor.events.removeAllListeners())

const campo = (rotulo) => screen.getByLabelText(rotulo)
const botao = () => screen.getByRole('button', { name: /^Criar conta$|^Criando conta/ })
const chamadasDeRegistro = () => pedidos.filter((p) => p === 'POST /api/auth/registrar').length

async function preencher({ nome = 'Caio Souza', email = 'caio@example.com', senha = 'uma senha longa', confirmacao = senha } = {}) {
  if (nome) await userEvent.type(campo('Nome'), nome)
  if (email) await userEvent.type(campo('E-mail'), email)
  if (senha) await userEvent.type(campo('Senha'), senha)
  if (confirmacao) await userEvent.type(campo('Confirmar senha'), confirmacao)
}

describe('Registro: formulário', () => {
  it('mostra o título, os quatro campos, a dica da senha e o link para entrar', () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    expect(screen.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeInTheDocument()
    for (const rotulo of ['Nome', 'E-mail', 'Senha', 'Confirmar senha']) expect(campo(rotulo)).toBeInTheDocument()
    expect(campo('Nome')).toHaveAttribute('autocomplete', 'name')
    expect(campo('Senha')).toHaveAttribute('autocomplete', 'new-password')
    expect(campo('Confirmar senha')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByText('8 a 128 caracteres')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    expect(campo('Nome')).toHaveFocus()
    expect(document.title).toBe('Criar conta · Rota Financeira')
  })
})

describe('Registro: criar conta', () => {
  it('sucesso: vai ao login com o aviso "conta criada" e o e-mail já preenchido', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ email: 'caio@example.com' })
    await userEvent.click(botao())

    expect(await screen.findByText('tela de login')).toBeInTheDocument()
    expect(screen.getByTestId('motivo')).toHaveTextContent('conta-criada')
    expect(screen.getByTestId('email')).toHaveTextContent('caio@example.com')
    expect(chamadasDeRegistro()).toBe(1)
  })

  it('o corpo enviado tem só nome, e-mail e senha (a confirmação NÃO vai)', async () => {
    let corpo
    servidor.use(
      http.post(REGISTRAR, async ({ request }) => {
        corpo = await request.json()
        return HttpResponse.json({ id: 9, nome: corpo.nome, email: corpo.email, criado_em: 'x' }, { status: 201 })
      }),
    )
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ nome: '  Caio Souza  ', email: '  caio@example.com  ' })
    await userEvent.click(botao())
    await screen.findByText('tela de login')

    expect(corpo).toEqual({ nome: 'Caio Souza', email: 'caio@example.com', senha: 'uma senha longa' })
    expect(Object.keys(corpo)).not.toContain('confirmacao')
  })

  it('a senha é enviada exatamente como digitada, com espaços (sem trim)', async () => {
    let corpo
    servidor.use(
      http.post(REGISTRAR, async ({ request }) => {
        corpo = await request.json()
        return HttpResponse.json({ id: 9, nome: 'x', email: 'x@example.com', criado_em: 'x' }, { status: 201 })
      }),
    )
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ senha: '  espaços  ' })
    await userEvent.click(botao())
    await screen.findByText('tela de login')
    expect(corpo.senha).toBe('  espaços  ')
  })

  it('limpa um aviso antigo da sessão ao criar a conta', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar', token: 'lixo' })
    await screen.findByLabelText('Nome')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument())
    await preencher()
    await userEvent.click(botao())
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
    expect(screen.getByTestId('aviso')).toHaveTextContent('sem-aviso')
  })
})

describe('Registro: validação no cliente', () => {
  it('campos vazios: mensagens em cada campo, foco no primeiro inválido e nenhuma chamada', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await userEvent.click(botao())
    expect(await screen.findAllByText('Campo obrigatório.')).toHaveLength(3)
    expect(screen.getByText('Confirme a senha.')).toBeInTheDocument()
    await waitFor(() => expect(campo('Nome')).toHaveFocus())
    expect(chamadasDeRegistro()).toBe(0)
  })

  it('confirmação diferente: erro no campo de confirmação e nenhuma chamada', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ senha: 'uma senha longa', confirmacao: 'outra senha longa' })
    await userEvent.click(botao())
    expect(await screen.findByText('As senhas não conferem.')).toBeInTheDocument()
    expect(campo('Confirmar senha')).toHaveAttribute('aria-invalid', 'true')
    expect(chamadasDeRegistro()).toBe(0)
  })

  it('nome curto, e-mail malformado e senha curta: as mensagens do backend, junto de cada campo', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ nome: 'A', email: 'nao-e-email', senha: 'curta' })
    await userEvent.click(botao())
    expect(await screen.findByText('O nome deve ter entre 2 e 120 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('E-mail inválido.')).toBeInTheDocument()
    expect(screen.getByText('A senha deve ter entre 8 e 128 caracteres.')).toBeInTheDocument()
    expect(chamadasDeRegistro()).toBe(0)
  })

  it('a dica "8 a 128 caracteres" dá lugar ao erro da senha', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ senha: 'curta' })
    await userEvent.click(botao())
    await screen.findByText('A senha deve ter entre 8 e 128 caracteres.')
    expect(screen.queryByText('8 a 128 caracteres')).not.toBeInTheDocument()
  })
})

describe('Registro: erros do servidor', () => {
  it('409: e-mail já cadastrado aparece NO CAMPO e-mail, o foco vai para ele e a pessoa continua no formulário', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ email: 'ana@example.com' })
    await userEvent.click(botao())

    expect(await screen.findByText('E-mail já cadastrado')).toBeInTheDocument()
    expect(campo('E-mail')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(campo('E-mail')).toHaveFocus())
    expect(screen.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeInTheDocument()
    expect(botao()).toBeEnabled()
  })

  it('o 409 só acontece com e-mail existente: com um e-mail novo, a conta é criada (controle)', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ email: 'novo@example.com' })
    await userEvent.click(botao())
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
  })

  it('e-mail existente com outra caixa também dá 409 (o backend normaliza)', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ email: 'ANA@Example.com' })
    await userEvent.click(botao())
    expect(await screen.findByText('E-mail já cadastrado')).toBeInTheDocument()
  })

  it('422 do servidor é mapeado para o campo certo', async () => {
    servidor.use(
      http.post(REGISTRAR, () =>
        HttpResponse.json({ erro: 'Dados inválidos', detalhes: { nome: ['Nome recusado pelo servidor.'] } }, { status: 422 }),
      ),
    )
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher()
    await userEvent.click(botao())
    expect(await screen.findByText('Nome recusado pelo servidor.')).toBeInTheDocument()
    expect(campo('Nome')).toHaveAttribute('aria-invalid', 'true')
  })

  it('servidor fora do ar: mensagem de rede e o botão volta a funcionar', async () => {
    servidor.use(http.post(REGISTRAR, () => HttpResponse.error()))
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher()
    await userEvent.click(botao())
    expect(await screen.findByText('Não foi possível falar com o servidor.')).toBeInTheDocument()
    expect(botao()).toBeEnabled()
  })

  it('a mensagem geral some no envio seguinte', async () => {
    servidor.use(http.post(REGISTRAR, () => HttpResponse.error()))
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher()
    await userEvent.click(botao())
    await screen.findByText('Não foi possível falar com o servidor.')

    servidor.resetHandlers(...handlers)
    await userEvent.click(botao())
    await waitFor(() => expect(screen.queryByText('Não foi possível falar com o servidor.')).not.toBeInTheDocument())
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
  })
})

describe('Registro: envio e senhas', () => {
  it('desabilita o botão durante a requisição e não envia duas vezes (clique forçado e Enter)', async () => {
    servidor.use(
      http.post(REGISTRAR, async () => {
        await delay(150)
        return HttpResponse.json({ erro: 'E-mail já cadastrado' }, { status: 409 })
      }),
    )
    const forcado = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never })
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher()
    await userEvent.click(botao())

    expect(screen.getByRole('button', { name: 'Criando conta…' })).toBeDisabled()
    await forcado.click(screen.getByRole('button', { name: 'Criando conta…' }))
    await forcado.type(campo('Nome'), '{Enter}')

    await screen.findByText('E-mail já cadastrado')
    expect(chamadasDeRegistro()).toBe(1)
  })

  it('o olho de um campo alterna os DOIS campos de senha juntos', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    expect(campo('Senha')).toHaveAttribute('type', 'password')
    expect(campo('Confirmar senha')).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar confirmação da senha' }))
    expect(campo('Senha')).toHaveAttribute('type', 'text')
    expect(campo('Confirmar senha')).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(campo('Senha')).toHaveAttribute('type', 'password')
    expect(campo('Confirmar senha')).toHaveAttribute('type', 'password')
  })

  it('as senhas voltam a ficar ocultas ao enviar', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    await preencher({ email: 'ana@example.com' })
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(campo('Senha')).toHaveAttribute('type', 'text')

    await userEvent.click(botao())
    await screen.findByText('E-mail já cadastrado')
    expect(campo('Senha')).toHaveAttribute('type', 'password')
    expect(campo('Confirmar senha')).toHaveAttribute('type', 'password')
  })
})
