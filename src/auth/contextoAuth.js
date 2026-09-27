import { createContext } from 'react'

// Contexto da sessão (separado do AuthProvider para o react-refresh do ESLint: um arquivo de componente só exporta componentes).
export const ContextoAuth = createContext(null)
