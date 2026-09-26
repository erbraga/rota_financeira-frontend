import { useParams } from 'react-router-dom'
import EmConstrucao from '../components/EmConstrucao.jsx'

export default function Amortizacao() {
  const { id, fid } = useParams()
  return (
    <EmConstrucao
      titulo={`Amortização da opção #${fid}`}
      detalhe={`Simulação #${id}`}
    />
  )
}
