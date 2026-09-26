import { useParams } from 'react-router-dom'
import EmConstrucao from '../components/EmConstrucao.jsx'

export default function Resultado() {
  const { id } = useParams()
  return <EmConstrucao titulo={`Resultado da simulação #${id}`} />
}
