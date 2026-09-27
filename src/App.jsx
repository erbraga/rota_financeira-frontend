import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import RotaProtegida from './auth/RotaProtegida.jsx'
import SoVisitantes from './auth/SoVisitantes.jsx'
import CarregandoTela from './components/CarregandoTela.jsx'
import Layout from './components/Layout.jsx'
import LayoutPublico from './components/LayoutPublico.jsx'
import MudancaDeRota from './components/MudancaDeRota.jsx'
import Login from './pages/Login.jsx'
import NaoEncontrada from './pages/NaoEncontrada.jsx'
import Registro from './pages/Registro.jsx'
import SimulacaoForm from './pages/SimulacaoForm.jsx'
import Simulacoes from './pages/Simulacoes.jsx'

// Resultado e Amortização (as duas telas com o Recharts) carregam SOB DEMANDA: tiram a biblioteca de gráficos do
// pacote inicial. Se o pacote falhar em carregar (rede caiu, versão nova publicada), o erro vira uma exceção de
// renderização comum, capturada pela fronteira por tela do Layout (ErrorBoundary detecta a mensagem e faz o
// "Tentar de novo" recarregar a página, já que uma promessa rejeitada do React.lazy não se recupera sozinha).
const Resultado = lazy(() => import('./pages/Resultado.jsx'))
const Amortizacao = lazy(() => import('./pages/Amortizacao.jsx'))

// Rotas da SPA. Públicas (LayoutPublico): /login e /registrar (só para quem não tem sessão) e a 404, aberta a
// todos. Privadas (Layout com a barra): tudo o mais, atrás da RotaProtegida.
export default function App() {
  return (
    <>
      <MudancaDeRota />
      <Routes>
        <Route element={<LayoutPublico />}>
          <Route element={<SoVisitantes />}>
            <Route path="login" element={<Login />} />
            <Route path="registrar" element={<Registro />} />
          </Route>
          <Route path="*" element={<NaoEncontrada />} />
        </Route>

        <Route element={<RotaProtegida />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/simulacoes" replace />} />
            <Route path="simulacoes" element={<Simulacoes />} />
            <Route path="simulacoes/nova" element={<SimulacaoForm />} />
            <Route path="simulacoes/:id/editar" element={<SimulacaoForm />} />
            <Route
              path="simulacoes/:id/resultado"
              element={
                <Suspense fallback={<CarregandoTela />}>
                  <Resultado />
                </Suspense>
              }
            />
            <Route
              path="simulacoes/:id/financiamentos/:fid"
              element={
                <Suspense fallback={<CarregandoTela />}>
                  <Amortizacao />
                </Suspense>
              }
            />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
