// Configuração da SPA, lida do ambiente do Vite (VITE_*). O Vite embute o valor NO BUILD.

// Devolve { urlApi } (sem barra final) ou { erro } com o motivo, para a TelaConfiguracao mostrar.
export function lerConfig(env = import.meta.env) {
  const bruto = env.VITE_API_URL

  if (typeof bruto !== 'string' || bruto === '') {
    return { erro: 'A variável VITE_API_URL não está definida.' }
  }
  if (/\s/.test(bruto)) {
    return { erro: 'A variável VITE_API_URL não pode conter espaços.' }
  }

  let url
  try {
    url = new URL(bruto)
  } catch {
    return { erro: 'A variável VITE_API_URL não é uma URL válida (ex.: http://localhost:5000/api).' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { erro: 'A variável VITE_API_URL deve começar com http:// ou https://.' }
  }

  return { urlApi: bruto.replace(/\/+$/, '') }
}
