import Chip from '@mui/material/Chip'
import { useQuery } from '@tanstack/react-query'
import { get } from '../api/api.js'
import { ehErroApi, ehErroRede } from '../api/erros.js'

// Indicador TEMPORÁRIO da Etapa 1 (removido na Etapa 2): chama GET /saude para provar, no navegador,
// que a VITE_API_URL, o client HTTP e o CORS do backend funcionam. O curl não prova o CORS.
export default function EstadoApi() {
  const { isPending, isError, error } = useQuery({
    queryKey: ['saude'],
    // /saude é pública: sem token, para um 401 nunca ser tratado como sessão expirada.
    queryFn: ({ signal }) => get('/saude', { semAutenticacao: true, signal }),
  })

  let rotulo = 'API conectada'
  let cor = 'success'
  if (isPending) {
    rotulo = 'Verificando a API…'
    cor = 'default'
  } else if (isError) {
    cor = 'error'
    if (ehErroRede(error)) {
      rotulo = error.porTimeout ? 'Servidor demorou a responder' : 'Sem conexão com o servidor'
    } else if (ehErroApi(error)) {
      rotulo = `Erro da API: ${error.erro}`
    } else {
      rotulo = 'Erro inesperado'
    }
  }

  return (
    <span role="status">
      <Chip size="small" color={cor} label={rotulo} />
    </span>
  )
}
