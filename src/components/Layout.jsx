import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import ErrorBoundary from './ErrorBoundary.jsx'

// Layout das telas privadas: barra com o nome do app (link para as simulações), o nome de quem está logado
// (oculto em telas estreitas) e Sair; a rota filha entra no <Outlet />, envolvida pela fronteira de erro POR
// TELA (a barra e o Sair continuam de fora, funcionando, mesmo se a tela quebrar). A chave de reinício é o
// caminho da rota: ao navegar para outra tela a fronteira se reinicia sozinha (uma tela quebrada não contamina
// a seguinte); só o caminho importa (não a busca), como no MudancaDeRota.
export default function Layout() {
  const { usuario, sair } = useAuth()
  const { pathname } = useLocation()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/simulacoes"
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}
          >
            Rota Financeira
          </Typography>
          {usuario && (
            <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{usuario.nome}</Typography>
          )}
          <Button color="inherit" onClick={sair}>
            Sair
          </Button>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ flex: 1, py: 3 }}>
        <ErrorBoundary variante="tela" chave={pathname}>
          <Outlet />
        </ErrorBoundary>
      </Container>
    </Box>
  )
}
