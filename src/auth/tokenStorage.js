// Guarda o token JWT no sessionStorage (sobrevive ao recarregamento, some ao fechar a aba; sem localStorage).
// A MEMÓRIA é a fonte da verdade depois da primeira leitura: se o storage estiver indisponível (modo privado
// restrito, política do navegador) ou falhar ao gravar/remover, a sessão continua funcionando só em memória e
// um token apagado nunca "ressuscita" a partir do storage. Nunca loga nem repassa o valor.

export const CHAVE_TOKEN = 'rota-financeira.token'

let emMemoria = null
let carregado = false

// Toda leitura, escrita e remoção do storage passa por aqui, em try/catch.
function comStorage(operacao) {
  try {
    return operacao(globalThis.sessionStorage)
  } catch {
    return undefined
  }
}

export function lerToken() {
  if (!carregado) {
    const guardado = comStorage((storage) => storage.getItem(CHAVE_TOKEN))
    emMemoria = typeof guardado === 'string' && guardado !== '' ? guardado : null
    carregado = true
  }
  return emMemoria
}

export function gravarToken(token) {
  emMemoria = token
  carregado = true
  comStorage((storage) => storage.setItem(CHAVE_TOKEN, token))
}

export function apagarToken() {
  emMemoria = null
  carregado = true
  comStorage((storage) => storage.removeItem(CHAVE_TOKEN))
}

// Só para os testes: esquece a memória, como numa página recém-carregada.
export function reiniciarTokenStorage() {
  emMemoria = null
  carregado = false
}
