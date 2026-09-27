import { screen, waitFor } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SoVisitantes from '../auth/SoVisitantes.jsx'
import RotaProtegida from '../auth/RotaProtegida.jsx'
import { lerToken } from '../auth/tokenStorage.js'
import { useAuth } from '../auth/useAuth.js'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { renderizarComAuth } from '../testUtils.jsx'
import Login from './Login.jsx'

const LOGIN = 'http://localhost:5000/api/auth/login'

function RegistroFalso() {
  const { aviso } = useAuth()
  return (
    <div>
      <p>tela de registro</p>
      <p data-testid="aviso-registro">{aviso ?? 'sem-aviso'}</p>
    </div>
  )
}

function PrivadaComSair() {
  const { sair } = useAuth()
  const { pathname } = useLocation()
  return (
    <div>
      <p>área privada em {pathname}</p>
      <button onClick={sair}>sair-de-teste</button>
    </div>
  )
}

function Rotas() {
  return (
    <Routes>
      <Route element={<SoVisitantes />}>
        <Route path="/login" element={<Login />} />
        <Route path="/registrar" element={<RegistroFalso />} />
      </Route>
      <Route element={<RotaProtegida />}>
        <Route path="/simulacoes" element={<PrivadaComSair />} />
        <Route path="/simulacoes/:id/resultado" element={<PrivadaComSair />} />
      </Route>
    </Routes>
  )
}

let ana
let pedidos

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana Souza', email: 'ana@example.com', senha: 'senha da ana' })
  pedidos = []
  servidor.events.on('request:start', ({ request }) => pedidos.push(`${request.method} ${new URL(request.url).pathname}`))
})

afterEach(() => servidor.events.removeAllListeners())

const campoEmail = () => screen.getByLabelText('E-mail')
const campoSenha = () => screen.getByLabelText('Senha')
const botaoEntrar = () => screen.getByRole('button', { name: /^Entrar|^Entrando/ })
const chamadasDeLogin = () => pedidos.filter((p) => p === 'POST /api/auth/login').length

async function preencher(email, senha) {
  if (email !== undefined) await userEvent.type(campoEmail(), email)
  if (senha !== undefined) await userEvent.type(campoSenha(), senha)
}

describe('Login: formulário', () => {
  it('mostra o título, os campos, o botão e o link para criar conta', () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(campoEmail()).toHaveAttribute('autocomplete', 'email')
    expect(campoSenha()).toHaveAttribute('autocomplete', 'current-password')
    expect(campoSenha()).toHaveAttribute('type', 'password')
    expect(botaoEntrar()).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/registrar')
    expect(document.title).toBe('Entrar · Rota Financeira')
  })

  it('o foco começa no e-mail', () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    expect(campoEmail()).toHaveFocus()
  })
})

describe('Login: entrar com sucesso', () => {
  it('credenciais corretas: guarda o token e vai para as simulações', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'senha da ana')
    await userEvent.click(botaoEntrar())

    expect(await screen.findByText('área privada em /simulacoes')).toBeInTheDocument()
    expect(lerToken()).toBe(tokenDe(ana))
    expect(chamadasDeLogin()).toBe(1)
  })

  it('volta para a rota pedida antes do login (state.de)', async () => {
    renderizarComAuth(<Rotas />, { rota: { pathname: '/login', state: { de: '/simulacoes/7/resultado' } } })
    await preencher('ana@example.com', 'senha da ana')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('área privada em /simulacoes/7/resultado')).toBeInTheDocument()
  })

  it('um state.de externo é ignorado: vai para as simulações', async () => {
    renderizarComAuth(<Rotas />, { rota: { pathname: '/login', state: { de: 'https://evil.com' } } })
    await preencher('ana@example.com', 'senha da ana')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('área privada em /simulacoes')).toBeInTheDocument()
  })

  it('o e-mail com espaços e maiúsculas nas pontas é aceito (o cliente apara)', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('  ana@example.com  ', 'senha da ana')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('área privada em /simulacoes')).toBeInTheDocument()
  })
})

describe('Login: 401 (credenciais incorretas)', () => {
  it('mostra "E-mail ou senha incorretos." no formulário, sem sair da tela, mantendo o e-mail e limpando a senha', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'senha errada')
    await userEvent.click(botaoEntrar())

    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(campoEmail()).toHaveValue('ana@example.com')
    expect(campoSenha()).toHaveValue('')
    await waitFor(() => expect(campoSenha()).toHaveFocus())
    expect(lerToken()).toBeNull()
  })

  it('o 401 do login NÃO vira aviso de sessão expirada', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'senha errada')
    await userEvent.click(botaoEntrar())
    await screen.findByText('E-mail ou senha incorretos.')
    expect(screen.queryByText('Sua sessão expirou. Entre novamente.')).not.toBeInTheDocument()
  })

  it('e-mail que não existe dá exatamente a mesma mensagem (não revela qual falhou)', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ninguem@example.com', 'qualquer coisa')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument()
  })

  it('depois de errar, dá para tentar de novo e entrar', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'errada')
    await userEvent.click(botaoEntrar())
    await screen.findByText('E-mail ou senha incorretos.')

    await userEvent.type(campoSenha(), 'senha da ana')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('área privada em /simulacoes')).toBeInTheDocument()
  })
})

describe('Login: validação e erros do servidor', () => {
  it('campos vazios: "Campo obrigatório." nos dois, foco no primeiro inválido e nenhuma chamada ao servidor', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await userEvent.click(botaoEntrar())
    expect(await screen.findAllByText('Campo obrigatório.')).toHaveLength(2)
    await waitFor(() => expect(campoEmail()).toHaveFocus())
    expect(chamadasDeLogin()).toBe(0)
  })

  it('e-mail malformado: "E-mail inválido." junto ao campo, sem chamar o servidor', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('nao-e-email', 'x')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('E-mail inválido.')).toBeInTheDocument()
    expect(campoEmail()).toHaveAttribute('aria-invalid', 'true')
    expect(chamadasDeLogin()).toBe(0)
  })

  it('422 do servidor é mostrado junto ao campo certo', async () => {
    servidor.use(
      http.post(LOGIN, () =>
        HttpResponse.json({ erro: 'Dados inválidos', detalhes: { email: ['E-mail inválido (servidor).'] } }, { status: 422 }),
      ),
    )
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'x')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('E-mail inválido (servidor).')).toBeInTheDocument()
    expect(campoEmail()).toHaveAttribute('aria-invalid', 'true')
  })

  it('servidor fora do ar: mostra a mensagem de rede e permite tentar de novo', async () => {
    servidor.use(http.post(LOGIN, () => HttpResponse.error()))
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'senha da ana')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('Não foi possível falar com o servidor.')).toBeInTheDocument()
    expect(botaoEntrar()).toBeEnabled()
  })

  it('erro 500 do servidor: mostra a mensagem do erro, sem detalhes técnicos', async () => {
    servidor.use(http.post(LOGIN, () => HttpResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })))
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'x')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('Erro interno do servidor')).toBeInTheDocument()
  })

  it('a mensagem de erro some no envio seguinte', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'errada')
    await userEvent.click(botaoEntrar())
    await screen.findByText('E-mail ou senha incorretos.')
    servidor.use(
      http.post(LOGIN, async () => {
        await delay(100)
        return HttpResponse.error()
      }),
    )
    await userEvent.type(campoSenha(), 'outra')
    await userEvent.click(botaoEntrar())
    await waitFor(() => expect(screen.queryByText('E-mail ou senha incorretos.')).not.toBeInTheDocument())
  })
})

describe('Login: envio e senha', () => {
  it('desabilita o botão durante a requisição e não envia duas vezes (clique forçado e Enter)', async () => {
    servidor.use(
      http.post(LOGIN, async () => {
        await delay(150)
        return HttpResponse.json({ erro: 'Credenciais inválidas' }, { status: 401 })
      }),
    )
    // O botão desabilitado tem pointer-events: none; o "Never" força a tentativa de clique mesmo assim.
    const forcado = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never })
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'errada')
    await userEvent.click(botaoEntrar())

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    await forcado.click(screen.getByRole('button', { name: 'Entrando…' }))
    await forcado.type(campoSenha(), '{Enter}')

    await screen.findByText('E-mail ou senha incorretos.')
    expect(chamadasDeLogin()).toBe(1)
    expect(botaoEntrar()).toBeEnabled()
  })

  it('o olho mostra a senha e ela volta a ficar oculta ao enviar', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    await preencher('ana@example.com', 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(campoSenha()).toHaveAttribute('type', 'text')

    await userEvent.click(botaoEntrar())
    await screen.findByText('E-mail ou senha incorretos.')
    expect(campoSenha()).toHaveAttribute('type', 'password')
  })
})

describe('Login: avisos', () => {
  it('conta criada: mostra o aviso, já vem com o e-mail preenchido e o foco na senha', async () => {
    renderizarComAuth(<Rotas />, {
      rota: { pathname: '/login', state: { motivo: 'conta-criada', email: 'novo@example.com' } },
    })
    expect(screen.getByText('Conta criada! Entre com seu e-mail e senha.')).toBeInTheDocument()
    expect(campoEmail()).toHaveValue('novo@example.com')
    expect(campoSenha()).toHaveFocus()
  })

  it('sem aviso nenhum, nada é mostrado (controle)', () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('sessão expirada (token inválido guardado): mostra o aviso e continua no login', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login', token: 'lixo' })
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('Conta criada! Entre com seu e-mail e senha.')).not.toBeInTheDocument()
  })

  it('depois de Sair, mostra "Você saiu da sua conta." e o próximo login NÃO volta à tela anterior', async () => {
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/7/resultado', token: tokenDe(ana) })
    await screen.findByText('área privada em /simulacoes/7/resultado')
    await userEvent.click(screen.getByRole('button', { name: 'sair-de-teste' }))

    expect(await screen.findByText('Você saiu da sua conta.')).toBeInTheDocument()
    await preencher('ana@example.com', 'senha da ana')
    await userEvent.click(botaoEntrar())
    expect(await screen.findByText('área privada em /simulacoes')).toBeInTheDocument()
  })

  it('o aviso de sessão expirada é limpo ao entrar', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login', token: 'lixo' })
    await screen.findByText('Sua sessão expirou. Entre novamente.')
    await preencher('ana@example.com', 'senha da ana')
    await userEvent.click(botaoEntrar())
    await screen.findByText('área privada em /simulacoes')
    expect(screen.queryByText('Sua sessão expirou. Entre novamente.')).not.toBeInTheDocument()
  })

  it('o link "Criar conta" limpa o aviso da sessão e leva ao registro', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login', token: 'lixo' })
    await screen.findByText('Sua sessão expirou. Entre novamente.')
    await userEvent.click(screen.getByRole('link', { name: 'Criar conta' }))
    expect(await screen.findByText('tela de registro')).toBeInTheDocument()
    expect(screen.getByTestId('aviso-registro')).toHaveTextContent('sem-aviso')
  })
})
