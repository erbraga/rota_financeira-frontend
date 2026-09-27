import { Navigate, Outlet, useLocation } from 'react-router-dom'
import CarregandoSessao from '../components/CarregandoSessao.jsx'
import { destinoAposLogin } from '../utils/destino.js'
import { useAuth } from './useAuth.js'

// Para /login e /registrar: quem já tem sessão válida sai daqui (para a rota que tentou abrir antes de entrar, se
// houver e for segura, senão para as simulações). É o ÚNICO redirecionamento depois do login: a tela de login só
// chama entrar(); se ela também navegasse, as duas navegações competiriam. Com a sessão em validação mostra
// o carregamento (sem piscar o formulário); com token vencido o perfil dá 401, a sessão é descartada e a pessoa
// continua no formulário, com o aviso de sessão expirada.
export default function SoVisitantes() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'validando') return <CarregandoSessao />
  if (status === 'autenticado') return <Navigate to={destinoAposLogin(location.state?.de)} replace />
  return <Outlet />
}
