import { Navigate, Outlet, useLocation } from 'react-router-dom'
import CarregandoSessao from '../components/CarregandoSessao.jsx'
import ErroSessao from '../components/ErroSessao.jsx'
import { useAuth } from './useAuth.js'

// Só mostra as rotas filhas com sessão válida. É o ÚNICO lugar que redireciona ao login quando a sessão
// acaba (sair, 401 ou nunca houve login), lembrando a rota pedida em state.de para voltar depois do login.
export default function RotaProtegida() {
  const { status, aviso, tentarNovamente, sair } = useAuth()
  const location = useLocation()

  if (status === 'validando') return <CarregandoSessao />
  if (status === 'erro') return <ErroSessao aoTentarNovamente={tentarNovamente} aoSair={sair} />
  if (status === 'sem-sessao') {
    // Depois de "Sair" o próximo login começa em /simulacoes, não na tela que a pessoa estava (pode ser outra pessoa).
    const de = aviso === 'saiu' ? undefined : `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={de ? { de } : undefined} />
  }
  return <Outlet />
}
