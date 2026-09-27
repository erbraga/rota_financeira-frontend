import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { ehErroApi } from '../api/erros.js'
import { useAuth } from '../auth/useAuth.js'
import CampoSenha from '../components/CampoSenha.jsx'
import { esquemaLogin } from '../schemas/auth.js'
import { aplicarErrosDoServidor } from '../utils/errosDeFormulario.js'

const CAMPOS = ['email', 'senha']
const MENSAGEM_CREDENCIAIS = 'E-mail ou senha incorretos.'

// Um aviso por vez. O aviso da sessão (saiu, sessão expirada) vem do contexto; o de conta criada vem do
// estado da rota (Registro). O mais recente, de conta criada, tem precedência sobre um aviso antigo da sessão.
function textoDoAviso(motivoDaRota, avisoDaSessao) {
  if (motivoDaRota === 'conta-criada') {
    return { severidade: 'success', texto: 'Conta criada! Entre com seu e-mail e senha.' }
  }
  if (avisoDaSessao === 'sessao-expirada') {
    return { severidade: 'warning', texto: 'Sua sessão expirou. Entre novamente.' }
  }
  if (avisoDaSessao === 'saiu') return { severidade: 'info', texto: 'Você saiu da sua conta.' }
  return null
}

// Só chama entrar(): depois do login, quem redireciona é o SoVisitantes (uma única navegação).
export default function Login() {
  const { entrar, aviso, limparAviso } = useAuth()
  const { state } = useLocation()
  const emailInicial = typeof state?.email === 'string' ? state.email : ''
  const [mostrar, setMostrar] = useState(false)
  const [erroGeral, setErroGeral] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { email: emailInicial, senha: '' },
  })

  async function aoEnviar({ email, senha }) {
    setErroGeral(null)
    setMostrar(false)
    try {
      await entrar(email, senha)
    } catch (erro) {
      // 401 no login é "credenciais incorretas" (nunca sessão expirada): mostra aqui, sem redirecionar.
      if (ehErroApi(erro) && erro.status === 401) {
        setErroGeral(MENSAGEM_CREDENCIAIS)
        resetField('senha')
        setFocus('senha')
        return
      }
      setErroGeral(aplicarErrosDoServidor(erro, setError, CAMPOS))
    }
  }

  const notificacao = textoDoAviso(state?.motivo, aviso)

  return (
    <Box component="form" noValidate onSubmit={handleSubmit(aoEnviar)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" component="h1">
        Entrar
      </Typography>

      {notificacao && (
        <Alert severity={notificacao.severidade} role="status">
          {notificacao.texto}
        </Alert>
      )}
      {erroGeral && <Alert severity="error">{erroGeral}</Alert>}

      <TextField
        label="E-mail"
        type="email"
        autoComplete="email"
        autoFocus={!emailInicial}
        error={Boolean(errors.email)}
        helperText={errors.email?.message}
        {...register('email')}
      />
      <CampoSenha
        label="Senha"
        autoComplete="current-password"
        autoFocus={Boolean(emailInicial)}
        mostrar={mostrar}
        aoAlternar={() => setMostrar((atual) => !atual)}
        error={Boolean(errors.senha)}
        helperText={errors.senha?.message}
        {...register('senha')}
      />

      <Button type="submit" variant="contained" size="large" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>

      <Typography variant="body2" align="center">
        Ainda não tem conta?{' '}
        <Link component={RouterLink} to="/registrar" onClick={limparAviso}>
          Criar conta
        </Link>
      </Typography>
    </Box>
  )
}
