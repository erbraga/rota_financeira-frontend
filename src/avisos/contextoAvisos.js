import { createContext } from 'react'

// Contexto dos avisos (separado do AvisosProvider para o react-refresh do ESLint: um arquivo de componente só exporta componentes).
export const ContextoAvisos = createContext(null)
