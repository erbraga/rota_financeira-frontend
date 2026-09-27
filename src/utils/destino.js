// Para onde ir depois do login: a rota que a pessoa tentou abrir (state.de, guardado pela RotaProtegida) ou as
// simulações. Só aceita caminho INTERNO: recusa URL externa e "//host" (redirecionamento aberto) e não volta
// para /login nem /registrar.
export const DESTINO_PADRAO = '/simulacoes'

export function destinoAposLogin(de) {
  if (typeof de !== 'string') return DESTINO_PADRAO
  if (!de.startsWith('/') || de.startsWith('//') || de.includes('\\')) return DESTINO_PADRAO
  const caminho = de.split(/[?#]/)[0]
  if (caminho === '/login' || caminho === '/registrar') return DESTINO_PADRAO
  return de
}
