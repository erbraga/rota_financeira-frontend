import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'

// Erro ao carregar dados (rede, timeout ou 5xx), com a saída "Tentar de novo" quando há o que repetir.
// A mensagem vem do chamador (por exemplo, a do ErroRede), nunca com detalhes técnicos.
export default function EstadoErro({ titulo = 'Não foi possível carregar', mensagem, aoTentarNovamente }) {
  return (
    <Box sx={{ py: 3 }}>
      <Alert severity="error" sx={{ mb: aoTentarNovamente ? 2 : 0 }}>
        <AlertTitle>{titulo}</AlertTitle>
        {mensagem}
      </Alert>
      {aoTentarNovamente && (
        <Button variant="contained" onClick={aoTentarNovamente}>
          Tentar de novo
        </Button>
      )}
    </Box>
  )
}
