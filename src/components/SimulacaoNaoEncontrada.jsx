import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

// Estado de uma simulação que não existe, foi excluída ou é de outra pessoa (o backend responde o MESMO 404 nos três casos,
// para não vazar existência). Serve à edição e ao resultado.
export default function SimulacaoNaoEncontrada() {
  return (
    <Box component="section" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Simulação não encontrada
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>Ela pode ter sido excluída ou não existe.</AlertTitle>
        Volte ao histórico para ver as suas simulações.
      </Alert>
      <Button component={RouterLink} to="/simulacoes" variant="contained">
        Voltar ao histórico
      </Button>
    </Box>
  )
}
