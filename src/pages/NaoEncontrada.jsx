import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

// 404 da própria SPA (rota que não existe). Não confundir com o 404 "recurso não encontrado" da API.
export default function NaoEncontrada() {
  return (
    <Box component="section" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Página não encontrada
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        O endereço que você abriu não existe.
      </Typography>
      <Button component={RouterLink} to="/simulacoes" variant="contained">
        Ir para minhas simulações
      </Button>
    </Box>
  )
}
