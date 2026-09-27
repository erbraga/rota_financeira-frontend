import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import TelaConfiguracao from './components/TelaConfiguracao.jsx'
import { queryClient } from './queryClient.js'
import { theme } from './theme.js'

// Providers da aplicação (o AuthProvider precisa ficar DENTRO do roteador e do React Query). Se a configuração for inválida (erroConfig), mostra a tela de configuração
// em vez do app: uma tela em branco esconderia o problema.
export default function Raiz({ erroConfig }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {erroConfig ? (
        <TelaConfiguracao erro={erroConfig} />
      ) : (
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      )}
    </ThemeProvider>
  )
}
