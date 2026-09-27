import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import AvisosProvider from './avisos/AvisosProvider.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import TelaConfiguracao from './components/TelaConfiguracao.jsx'
import { queryClient } from './queryClient.js'
import { theme } from './theme.js'

// Providers da aplicação (o AuthProvider precisa ficar DENTRO do roteador e do React Query). Se a configuração for inválida (erroConfig), mostra a tela de configuração
// em vez do app: uma tela em branco esconderia o problema. A fronteira de erro GLOBAL fica em volta de tudo o
// que pode quebrar fora do Layout (providers, o roteador, o layout público, login): a por tela (Layout.jsx) cuida
// do resto. Fora da fronteira só o ThemeProvider/CssBaseline (a tela de erro também usa o tema) e a TelaConfiguracao
// (que não é um erro de renderização, e sim de configuração de ambiente).
export default function Raiz({ erroConfig }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {erroConfig ? (
        <TelaConfiguracao erro={erroConfig} />
      ) : (
        <ErrorBoundary variante="global">
          <QueryClientProvider client={queryClient}>
            <AvisosProvider>
              <BrowserRouter>
                <AuthProvider>
                  <App />
                </AuthProvider>
              </BrowserRouter>
            </AvisosProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      )}
    </ThemeProvider>
  )
}
