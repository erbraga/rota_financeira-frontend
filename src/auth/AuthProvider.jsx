import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { configurarSessao } from '../api/api.js'
import { login, obterPerfil } from '../api/auth.js'
import { ContextoAuth } from './contextoAuth.js'
import { apagarToken, gravarToken, lerToken } from './tokenStorage.js'

const CHAVE_PERFIL = ['perfil']

// Estado da sessão. O token vem do sessionStorage e o usuário do GET /auth/perfil (React Query, sem repetição).
// Liga o client HTTP à sessão (token atual e o que fazer num 401). NÃO navega: quem redireciona ao login é
// sempre a RotaProtegida, para não haver duas navegações competindo (a última apagaria o estado da primeira).
export default function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => lerToken())
  const [aviso, setAviso] = useState(null)
  // A ref é atualizada de forma síncrona: a requisição logo depois do login já precisa levar o token novo.
  const tokenRef = useRef(token)

  const perfil = useQuery({
    queryKey: CHAVE_PERFIL,
    queryFn: ({ signal }) => obterPerfil({ signal }),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  })

  const definirToken = useCallback((novo) => {
    tokenRef.current = novo
    setToken(novo)
  }, [])

  // Apaga o token, cancela as consultas em andamento e limpa o cache (nada volta a preenchê-lo depois).
  const encerrarSessao = useCallback(() => {
    apagarToken()
    definirToken(null)
    queryClient.cancelQueries()
    queryClient.clear()
  }, [definirToken, queryClient])

  // Chamado pelo client em todo 401 fora do login. Idempotente: várias respostas 401 em paralelo geram uma só saída.
  const aoExpirar = useCallback(() => {
    if (tokenRef.current === null) return
    encerrarSessao()
    setAviso('sessao-expirada')
  }, [encerrarSessao])

  // useLayoutEffect (e não useEffect): a ligação com o client TEM de existir antes de a consulta do perfil
  // disparar (o React Query dispara em efeito passivo, que roda depois dos efeitos de layout). Com useEffect,
  // o primeiro GET /auth/perfil saía sem token, dava 401 e derrubava a sessão a cada recarregamento.
  useLayoutEffect(() => {
    configurarSessao({ obterToken: () => tokenRef.current, aoExpirar })
    return () => configurarSessao({})
  }, [aoExpirar])

  // Erros (401, 422, rede) sobem para o formulário tratar.
  const entrar = useCallback(
    async (email, senha) => {
      const resposta = await login({ email, senha })
      gravarToken(resposta.access_token)
      // Semeia o perfil com o usuário do login: sem uma chamada extra ao backend.
      queryClient.setQueryData(CHAVE_PERFIL, resposta.usuario)
      setAviso(null)
      definirToken(resposta.access_token)
    },
    [definirToken, queryClient],
  )

  const sair = useCallback(() => {
    encerrarSessao()
    setAviso('saiu')
  }, [encerrarSessao])

  const limparAviso = useCallback(() => setAviso(null), [])
  const tentarNovamente = useCallback(() => perfil.refetch(), [perfil])

  let status = 'validando'
  if (token === null) status = 'sem-sessao'
  else if (perfil.data) status = 'autenticado'
  else if (perfil.isError) status = 'erro'

  const usuario = token !== null ? (perfil.data ?? null) : null

  const valor = useMemo(
    () => ({ status, usuario, aviso, entrar, sair, limparAviso, tentarNovamente }),
    [status, usuario, aviso, entrar, sair, limparAviso, tentarNovamente],
  )

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>
}
