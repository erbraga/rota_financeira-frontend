import { Navigate, Route, Routes } from 'react-router-dom'
import RotaProtegida from './auth/RotaProtegida.jsx'
import SoVisitantes from './auth/SoVisitantes.jsx'
import Layout from './components/Layout.jsx'
import LayoutPublico from './components/LayoutPublico.jsx'
import Amortizacao from './pages/Amortizacao.jsx'
import Login from './pages/Login.jsx'
import NaoEncontrada from './pages/NaoEncontrada.jsx'
import Registro from './pages/Registro.jsx'
import Resultado from './pages/Resultado.jsx'
import SimulacaoForm from './pages/SimulacaoForm.jsx'
import Simulacoes from './pages/Simulacoes.jsx'

// Rotas da SPA. Públicas (LayoutPublico): /login e /registrar (só para quem não tem sessão) e a 404, aberta a
// todos. Privadas (Layout com a barra): tudo o mais, atrás da RotaProtegida.
export default function App() {
  return (
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
          <Route path="simulacoes/:id/resultado" element={<Resultado />} />
          <Route path="simulacoes/:id/financiamentos/:fid" element={<Amortizacao />} />
        </Route>
      </Route>
    </Routes>
  )
}
