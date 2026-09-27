// Todo texto de erro mostrado à pessoa nasce AQUI: rede fora do ar, timeout, o inesperado e as mensagens
// genéricas por código HTTP (usadas só quando o servidor não devolve o JSON { erro } esperado, como a página
// de erro de um proxy). Módulo FOLHA: sem importações (evita ciclo com api/erros.js, que importa este arquivo).
// NUNCA mostrar aqui corpo cru do servidor, URL, stack nem nome de classe de erro.

export const MENSAGEM_REDE = 'Não foi possível falar com o servidor.'
export const MENSAGEM_TIMEOUT = 'O servidor demorou demais para responder.'
export const MENSAGEM_ERRO_INESPERADO = 'Ocorreu um erro inesperado. Tente novamente.'

// Usadas só quando o servidor não devolve o JSON { erro } esperado (ex.: página de erro de um proxy).
const MENSAGENS_GENERICAS_POR_STATUS = {
  400: 'Requisição inválida.',
  401: 'Sessão inválida ou expirada.',
  403: 'Acesso negado.',
  404: 'Recurso não encontrado.',
  409: 'A operação conflita com o estado atual.',
  415: 'Formato de requisição não aceito.',
  422: 'Dados inválidos.',
  500: 'Erro interno do servidor.',
  502: 'Servidor indisponível no momento.',
  503: 'Servidor indisponível no momento.',
  504: 'Servidor indisponível no momento.',
}

// status: código HTTP da resposta sem { erro }. Devolve o texto do status conhecido, ou um genérico por faixa.
export function mensagemGenericaPorStatus(status) {
  return (
    MENSAGENS_GENERICAS_POR_STATUS[status] ??
    (status >= 500 ? 'Erro no servidor. Tente novamente mais tarde.' : 'Não foi possível concluir a requisição.')
  )
}
