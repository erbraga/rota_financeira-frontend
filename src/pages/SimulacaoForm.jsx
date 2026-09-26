import { useParams } from 'react-router-dom'
import EmConstrucao from '../components/EmConstrucao.jsx'

// Serve às rotas /simulacoes/nova e /simulacoes/:id/editar.
export default function SimulacaoForm() {
  const { id } = useParams()
  return <EmConstrucao titulo={id ? `Editar simulação #${id}` : 'Nova simulação'} />
}
