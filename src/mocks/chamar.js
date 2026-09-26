// Auxiliar dos testes de handlers: chama a API (mockada) com fetch puro e devolve status, corpo e cabeçalhos.
import { lerConfig } from '../config.js'

export async function chamar(metodo, caminho, { corpo, token, cabecalhos, bruto } = {}) {
  const cab = { Accept: 'application/json', ...cabecalhos }
  if (corpo !== undefined) cab['Content-Type'] = 'application/json'
  if (token) cab.Authorization = `Bearer ${token}`
  const resposta = await fetch(`${lerConfig().urlApi}${caminho}`, {
    method: metodo,
    headers: cab,
    body: bruto ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
  })
  const texto = await resposta.text()
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, cabecalhos: resposta.headers }
}
