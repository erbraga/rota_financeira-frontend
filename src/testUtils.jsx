// Utilitário dos testes de componentes: renderiza com os mesmos providers da aplicação
// (React Query, tema do MUI e roteador em memória).
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthProvider from './auth/AuthProvider.jsx'
import { gravarToken } from './auth/tokenStorage.js'
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
        <MemoryRouter initialEntries={[rota]}>{ui}</MemoryRouter>
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
        <MemoryRouter initialEntries={[rota]}>
          <AuthProvider>{ui}</AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return { ...resultado, queryClient }
}
