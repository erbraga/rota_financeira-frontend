// Erros do client HTTP. A SPA distingue dois casos:
//  - ErroApi: o servidor respondeu com erro (4xx/5xx), no formato { erro, detalhes } do backend;
//  - ErroRede: não houve resposta (servidor fora do ar, CORS bloqueado, DNS) ou estourou o timeout.

export class ErroApi extends Error {
  // status: código HTTP; erro: mensagem do backend; detalhes: { campo: [mensagens] } ou undefined.
  constructor({ status, erro, detalhes }) {
    super(erro)
    this.name = 'ErroApi'
    this.status = status
    this.erro = erro
    this.detalhes = detalhes
  }
}

export class ErroRede extends Error {
  constructor({ porTimeout = false, causa } = {}) {
    super(
      porTimeout
        ? 'O servidor demorou demais para responder.'
        : 'Não foi possível falar com o servidor.',
    )
    this.name = 'ErroRede'
    this.porTimeout = porTimeout
    this.causa = causa
  }
}

// Reconhecem pelo nome (e não por instanceof), para funcionar mesmo entre ambientes de teste diferentes.
export function ehErroApi(erro) {
  return erro?.name === 'ErroApi'
}

export function ehErroRede(erro) {
  return erro?.name === 'ErroRede'
}
