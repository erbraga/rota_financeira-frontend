import { useContext } from 'react'
import { ContextoAvisos } from './contextoAvisos.js'

// const { mostrarAviso } = useAviso(); mostrarAviso('Simulação criada.')  (severidade opcional: 'success' | 'info' | 'warning' | 'error')
export function useAviso() {
  const contexto = useContext(ContextoAvisos)
  if (!contexto) throw new Error('useAviso deve ser usado dentro do AvisosProvider.')
  return contexto
}
