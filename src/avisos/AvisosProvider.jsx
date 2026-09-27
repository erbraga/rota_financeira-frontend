import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ContextoAvisos } from './contextoAvisos.js'

export const DURACAO_DO_AVISO_MS = 5000

// Um aviso na tela. Fecha sozinho, pelo botão de fechar, e NÃO ao clicar fora (o clique em outro lugar da página não
// deve apagar uma confirmação que a pessoa ainda não leu). Quando a saída termina, avisa o provedor (aoTerminar).
function Aviso({ aviso, duracao, aoTerminar }) {
  const [aberto, setAberto] = useState(true)

  return (
    <Snackbar
      open={aberto}
      autoHideDuration={duracao}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={(_evento, motivo) => {
        if (motivo !== 'clickaway') setAberto(false)
      }}
      slotProps={{ transition: { onExited: aoTerminar } }}
    >
      <Alert
        severity={aviso.severidade}
        variant="filled"
        // Informativo, não interrompe: o leitor de tela anuncia sem tomar o foco.
        role="status"
        closeText="Fechar"
        onClose={() => setAberto(false)}
        sx={{ width: '100%' }}
      >
        {aviso.texto}
      </Alert>
    </Snackbar>
  )
}

// Avisos de sucesso (e outros) que sobrevivem à navegação: o provedor fica na raiz, acima do roteador, então uma
// confirmação dada antes de navegar (criar -> edição) continua visível na tela seguinte. Mostra UM por vez;
// os seguintes entram em fila. duracao (ms) existe para os testes usarem um valor curto.
export default function AvisosProvider({ children, duracao = DURACAO_DO_AVISO_MS }) {
  const [fila, setFila] = useState([])
  const proximoId = useRef(0)

  const mostrarAviso = useCallback((texto, { severidade = 'success' } = {}) => {
    proximoId.current += 1
    const aviso = { id: proximoId.current, texto, severidade }
    setFila((atual) => [...atual, aviso])
  }, [])

  const valor = useMemo(() => ({ mostrarAviso }), [mostrarAviso])
  const atual = fila[0]

  return (
    <ContextoAvisos.Provider value={valor}>
      {children}
      {atual && (
        <Aviso
          key={atual.id}
          aviso={atual}
          duracao={duracao}
          aoTerminar={() => setFila((restantes) => restantes.filter((aviso) => aviso.id !== atual.id))}
        />
      )}
    </ContextoAvisos.Provider>
  )
}
