import { useMutation } from '@tanstack/react-query'
import { registrar } from '../api/auth.js'

// Criar conta (POST /auth/registrar). Sem repetição: erros (409, 422) são da pessoa, não passageiros.
export function useRegistrar() {
  return useMutation({ mutationFn: registrar })
}
