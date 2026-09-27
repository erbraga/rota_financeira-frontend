import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

// Confirmação antes de excluir uma simulação. Não conhece a API: recebe carregando/erro e chama aoCancelar/aoConfirmar.
// Durante a requisição os botões ficam desabilitados e Esc/clique fora não fecham (não dá para cancelar o que já foi).
export default function ConfirmarExclusao({ simulacao, aberto, carregando = false, erro, aoCancelar, aoConfirmar }) {
  function aoFechar() {
    if (!carregando) aoCancelar()
  }

  return (
    <Dialog open={aberto} onClose={aoFechar} aria-labelledby="titulo-exclusao" aria-describedby="texto-exclusao">
      <DialogTitle id="titulo-exclusao">Excluir a simulação "{simulacao?.nome}"?</DialogTitle>
      <DialogContent>
        <DialogContentText id="texto-exclusao">
          As opções de financiamento dela também serão excluídas. Esta ação não pode ser desfeita.
        </DialogContentText>
        {erro && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {erro}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={aoCancelar} disabled={carregando}>
          Cancelar
        </Button>
        <Button onClick={aoConfirmar} color="error" variant="contained" disabled={carregando}>
          {carregando ? 'Excluindo…' : 'Excluir'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
