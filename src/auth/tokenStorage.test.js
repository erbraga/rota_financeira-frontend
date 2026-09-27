import { afterEach, describe, expect, it, vi } from 'vitest'
import { apagarToken, CHAVE_TOKEN, gravarToken, lerToken, reiniciarTokenStorage } from './tokenStorage.js'

// Simula um storage que lança (bloqueado pelo navegador) numa operação.
function storageQueLanca(operacao) {
  return vi.spyOn(Storage.prototype, operacao).mockImplementation(() => {
    throw new Error('storage bloqueado')
  })
}

describe('tokenStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sem token guardado, devolve null', () => {
    expect(lerToken()).toBeNull()
  })

  it('grava e lê o token, e o espelha no sessionStorage (controle do modo sem storage)', () => {
    gravarToken('abc.def.ghi')
    expect(lerToken()).toBe('abc.def.ghi')
    expect(sessionStorage.getItem(CHAVE_TOKEN)).toBe('abc.def.ghi')
  })

  it('depois de um recarregamento (memória zerada), lê o token do sessionStorage', () => {
    sessionStorage.setItem(CHAVE_TOKEN, 'guardado-antes')
    reiniciarTokenStorage()
    expect(lerToken()).toBe('guardado-antes')
  })

  it('apagar remove da memória e do sessionStorage', () => {
    gravarToken('abc')
    apagarToken()
    expect(lerToken()).toBeNull()
    expect(sessionStorage.getItem(CHAVE_TOKEN)).toBeNull()
  })

  it('um valor vazio no storage conta como sem token', () => {
    sessionStorage.setItem(CHAVE_TOKEN, '')
    reiniciarTokenStorage()
    expect(lerToken()).toBeNull()
  })

  describe('storage indisponível (lança)', () => {
    it('na leitura: devolve null e não quebra', () => {
      storageQueLanca('getItem')
      reiniciarTokenStorage()
      expect(() => lerToken()).not.toThrow()
      expect(lerToken()).toBeNull()
    })

    it('na escrita: o token fica só em memória e não quebra', () => {
      storageQueLanca('setItem')
      expect(() => gravarToken('so-em-memoria')).not.toThrow()
      expect(lerToken()).toBe('so-em-memoria')
      expect(sessionStorage.getItem(CHAVE_TOKEN)).toBeNull()
    })

    it('na remoção: não quebra e o token apagado NÃO ressuscita a partir do storage', () => {
      gravarToken('vai-ser-apagado')
      const remover = storageQueLanca('removeItem')
      expect(() => apagarToken()).not.toThrow()
      expect(remover).toHaveBeenCalled()
      // O storage ainda tem o valor (a remoção falhou), mas a memória manda.
      expect(sessionStorage.getItem(CHAVE_TOKEN)).toBe('vai-ser-apagado')
      expect(lerToken()).toBeNull()
    })
  })
})
