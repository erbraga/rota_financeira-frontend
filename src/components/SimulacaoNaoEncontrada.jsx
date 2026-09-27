import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

// O texto do h1 e o do título da aba (Etapa 8): uma referência só, para as telas que mostram este estado (edição,
// resultado e amortização) não digitarem o texto de novo. Elas mesmas chamam useTituloDaPagina (o componente não
// chama por si: cada uma já tem um hook de título na raiz da função, e dois hooks de título no mesmo componente
// disputariam a ordem de execução do efeito).
export const TITULO_SIMULACAO_NAO_ENCONTRADA = 'Simulação não encontrada'

// Estado de uma simulação que não existe, foi excluída ou é de outra pessoa (o backend responde o MESMO 404 nos três casos,
// para não vazar existência). Serve à edição, ao resultado e à amortização.
export default function SimulacaoNaoEncontrada() {
  return (
    <Box component="section" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {TITULO_SIMULACAO_NAO_ENCONTRADA}
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
