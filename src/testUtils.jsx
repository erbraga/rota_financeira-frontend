// Utilitário dos testes de componentes: renderiza com os mesmos providers da aplicação
// (React Query, tema do MUI e roteador em memória).
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { render, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { configurarSessao } from './api/api.js'
import AuthProvider from './auth/AuthProvider.jsx'
import { gravarToken } from './auth/tokenStorage.js'
import AvisosProvider from './avisos/AvisosProvider.jsx'
import { criarQueryClient } from './queryClient.js'
import { theme } from './theme.js'

// Cada teste tem o seu QueryClient, sem repetição e sem cache compartilhado.
export function criarQueryClientDeTeste() {
  return criarQueryClient({ retry: false, retryDelay: 0, staleTime: 0, gcTime: Infinity })
}

export function renderizar(ui, { rota = '/', queryClient = criarQueryClientDeTeste() } = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AvisosProvider>
          <MemoryRouter initialEntries={[rota]}>{ui}</MemoryRouter>
        </AvisosProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

// Como renderizar(), mas com o AuthProvider (sessão). Se "token" for informado, ele já está guardado
// (como depois de um login e um recarregamento). Devolve também o queryClient, para conferir o cache.
export function renderizarComAuth(ui, { rota = '/', token, queryClient = criarQueryClientDeTeste() } = {}) {
  if (token) gravarToken(token)
  const resultado = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AvisosProvider>
          <MemoryRouter initialEntries={[rota]}>
            <AuthProvider>{ui}</AuthProvider>
          </MemoryRouter>
        </AvisosProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return { ...resultado, queryClient }
}

// Testa um hook de DADOS com React Query e roteador. Sem AuthProvider: o token é ligado direto no client HTTP
// (o AuthProvider faria a consulta do /perfil, que termina fora do teste e gera avisos de act). Sem "token", nenhuma
// sessão. Passe queryClient: criarQueryClient({ retryDelay: 0 }) para testar a política de repetição de PRODUÇÃO.
export function renderizarHookComAuth(hook, { rota = '/', token, queryClient = criarQueryClientDeTeste() } = {}) {
  configurarSessao({ obterToken: () => token ?? null })
  const Provedores = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[rota]}>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
  const resultado = renderHook(hook, { wrapper: Provedores })
  return { ...resultado, queryClient }
}
