import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { reiniciarTokenStorage } from './auth/tokenStorage.js'
import { reiniciarBanco } from './mocks/banco.js'
import { servidor } from './mocks/servidor.js'

// Um console.error inesperado (ex.: aviso de act, chave repetida, prop inválida) falha o teste,
// em vez de passar despercebido. Testes que esperam o erro o silenciam com vi.spyOn.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    throw new Error(`console.error inesperado: ${args.map(String).join(' ')}`)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  // Sessão limpa a cada teste (o sessionStorage só existe nos testes em jsdom).
  globalThis.sessionStorage?.clear()
  reiniciarTokenStorage()
})

// Servidor MSW para todos os testes: chamada HTTP sem handler quebra o teste e nunca vai à rede real.
beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  servidor.resetHandlers()
  reiniciarBanco()
})
afterAll(() => servidor.close())
