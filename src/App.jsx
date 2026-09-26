import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Amortizacao from './pages/Amortizacao.jsx'
import Login from './pages/Login.jsx'
import NaoEncontrada from './pages/NaoEncontrada.jsx'
import Registro from './pages/Registro.jsx'
import Resultado from './pages/Resultado.jsx'
import SimulacaoForm from './pages/SimulacaoForm.jsx'
import Simulacoes from './pages/Simulacoes.jsx'

// Rotas da SPA. Ainda sem proteção por login (a RotaProtegida entra na Etapa 2).
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/simulacoes" replace />} />
        <Route path="login" element={<Login />} />
        <Route path="registrar" element={<Registro />} />
        <Route path="simulacoes" element={<Simulacoes />} />
        <Route path="simulacoes/nova" element={<SimulacaoForm />} />
        <Route path="simulacoes/:id/editar" element={<SimulacaoForm />} />
        <Route path="simulacoes/:id/resultado" element={<Resultado />} />
        <Route path="simulacoes/:id/financiamentos/:fid" element={<Amortizacao />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  )
}
