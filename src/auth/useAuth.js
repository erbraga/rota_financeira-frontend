import { useContext } from 'react'
import { ContextoAuth } from './contextoAuth.js'

// { status, usuario, aviso, entrar, sair, limparAviso, tentarNovamente }
//  status: 'sem-sessao' | 'validando' | 'autenticado' | 'erro'
//  aviso:  null | 'sessao-expirada' | 'saiu' (o porquê de a sessão ter acabado, mostrado na tela de login)
export function useAuth() {
  const contexto = useContext(ContextoAuth)
  if (!contexto) throw new Error('useAuth deve ser usado dentro do AuthProvider.')
  return contexto
}
