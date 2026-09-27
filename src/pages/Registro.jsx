import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { ehErroApi } from '../api/erros.js'
import { useAuth } from '../auth/useAuth.js'
import CampoSenha from '../components/CampoSenha.jsx'
import { useRegistrar } from '../hooks/useRegistrar.js'
import { esquemaRegistro } from '../schemas/auth.js'
import { aplicarErrosDoServidor } from '../utils/errosDeFormulario.js'

// Campos que o backend conhece (a confirmação da senha só existe aqui e nunca é enviada).
const CAMPOS_DO_SERVIDOR = ['nome', 'email', 'senha']

export default function Registro() {
  const navigate = useNavigate()
  const { limparAviso } = useAuth()
  const registrar = useRegistrar()
  // Um único estado para os dois campos de senha: o olho de qualquer um alterna os dois.
  const [mostrar, setMostrar] = useState(false)
  const [erroGeral, setErroGeral] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(esquemaRegistro),
    defaultValues: { nome: '', email: '', senha: '', confirmacao: '' },
  })

  async function aoEnviar({ nome, email, senha }) {
    setErroGeral(null)
    setMostrar(false)
    try {
      await registrar.mutateAsync({ nome, email, senha })
    } catch (erro) {
      // 409 não traz "detalhes": o e-mail já existe, e o erro pertence ao campo e-mail.
      if (ehErroApi(erro) && erro.status === 409) {
        setError('email', { type: 'servidor', message: erro.erro })
        setFocus('email')
        return
      }
      setErroGeral(aplicarErrosDoServidor(erro, setError, CAMPOS_DO_SERVIDOR))
      return
    }
    // Conta criada (201, sem token): volta ao login com o aviso e o e-mail já preenchido.
    limparAviso()
    navigate('/login', { replace: true, state: { motivo: 'conta-criada', email } })
  }

  const alternar = () => setMostrar((atual) => !atual)

  return (
    <Box component="form" noValidate onSubmit={handleSubmit(aoEnviar)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" component="h1">
        Criar conta
      </Typography>

      {erroGeral && <Alert severity="error">{erroGeral}</Alert>}

      <TextField
        label="Nome"
        autoComplete="name"
        autoFocus
        error={Boolean(errors.nome)}
        helperText={errors.nome?.message}
        {...register('nome')}
      />
      <TextField
        label="E-mail"
        type="email"
        autoComplete="email"
        error={Boolean(errors.email)}
        helperText={errors.email?.message}
        {...register('email')}
      />
      <CampoSenha
        label="Senha"
        autoComplete="new-password"
        mostrar={mostrar}
        aoAlternar={alternar}
        error={Boolean(errors.senha)}
        helperText={errors.senha?.message ?? '8 a 128 caracteres'}
        {...register('senha')}
      />
      <CampoSenha
        label="Confirmar senha"
        descricao="confirmação da senha"
        autoComplete="new-password"
        mostrar={mostrar}
        aoAlternar={alternar}
        error={Boolean(errors.confirmacao)}
        helperText={errors.confirmacao?.message}
        {...register('confirmacao')}
      />

      <Button type="submit" variant="contained" size="large" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? 'Criando conta…' : 'Criar conta'}
      </Button>

      <Typography variant="body2" align="center">
        Já tem conta?{' '}
        <Link component={RouterLink} to="/login">
          Entrar
        </Link>
      </Typography>
    </Box>
  )
}
