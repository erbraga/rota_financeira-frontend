import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'

// Mostrada quando não foi possível validar a sessão por falha de rede ou erro do servidor (não por 401):
// o token é mantido, e a pessoa pode tentar de novo ou sair.
export default function ErroSessao({ aoTentarNovamente, aoSair }) {
  return (
    <Box sx={{ py: 4 }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        <AlertTitle>Não foi possível verificar sua sessão</AlertTitle>
        Não conseguimos falar com o servidor. Sua sessão foi mantida: tente novamente em instantes.
      </Alert>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" onClick={aoTentarNovamente}>
          Tentar de novo
        </Button>
        <Button variant="outlined" onClick={aoSair}>
          Sair
        </Button>
      </Box>
    </Box>
  )
}
