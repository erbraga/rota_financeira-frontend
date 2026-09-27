import { describe, expect, it, vi } from 'vitest'
import { ErroApi, ErroRede } from '../api/erros.js'
import { aplicarErrosDoServidor, MENSAGEM_ERRO_INESPERADO } from './errosDeFormulario.js'

const CAMPOS = ['nome', 'email', 'senha']
const erro422 = (detalhes) => new ErroApi({ status: 422, erro: 'Dados inválidos', detalhes })

describe('aplicarErrosDoServidor', () => {
  it('422 de um campo: marca o campo e não há mensagem geral', () => {
    const setError = vi.fn()
    const geral = aplicarErrosDoServidor(erro422({ email: ['E-mail inválido.'] }), setError, CAMPOS)
    expect(setError).toHaveBeenCalledTimes(1)
    expect(setError).toHaveBeenCalledWith('email', { type: 'servidor', message: 'E-mail inválido.' })
    expect(geral).toBeNull()
  })

  it('422 de vários campos: usa a primeira mensagem de cada um', () => {
    const setError = vi.fn()
    const geral = aplicarErrosDoServidor(
      erro422({ nome: ['Curto demais.', 'Outra.'], senha: ['Senha inválida.'] }),
      setError,
      CAMPOS,
    )
    expect(setError).toHaveBeenCalledWith('nome', { type: 'servidor', message: 'Curto demais.' })
    expect(setError).toHaveBeenCalledWith('senha', { type: 'servidor', message: 'Senha inválida.' })
    expect(setError).toHaveBeenCalledTimes(2)
    expect(geral).toBeNull()
  })

  it('chave que não é campo: os campos conhecidos são marcados e sobra a mensagem geral', () => {
    const setError = vi.fn()
    const geral = aplicarErrosDoServidor(
      erro422({ email: ['E-mail inválido.'], perfil: ['Campo desconhecido.'] }),
      setError,
      CAMPOS,
    )
    expect(setError).toHaveBeenCalledTimes(1)
    expect(setError).toHaveBeenCalledWith('email', expect.anything())
    expect(geral).toBe('Dados inválidos')
  })

  it('só chaves desconhecidas: nenhum campo marcado e mensagem geral', () => {
    const setError = vi.fn()
    expect(aplicarErrosDoServidor(erro422({ perfil: ['Campo desconhecido.'] }), setError, CAMPOS)).toBe(
      'Dados inválidos',
    )
    expect(setError).not.toHaveBeenCalled()
  })

  it('aceita mensagem em texto (não só em lista)', () => {
    const setError = vi.fn()
    aplicarErrosDoServidor(erro422({ email: 'Texto solto.' }), setError, CAMPOS)
    expect(setError).toHaveBeenCalledWith('email', { type: 'servidor', message: 'Texto solto.' })
  })

  it('erro da API sem detalhes (409, 401): devolve o "erro" do backend e não marca campo', () => {
    const setError = vi.fn()
    const conflito = new ErroApi({ status: 409, erro: 'E-mail já cadastrado' })
    expect(aplicarErrosDoServidor(conflito, setError, CAMPOS)).toBe('E-mail já cadastrado')
    expect(setError).not.toHaveBeenCalled()
  })

  it('detalhes vazios contam como sem detalhes', () => {
    const setError = vi.fn()
    expect(aplicarErrosDoServidor(erro422({}), setError, CAMPOS)).toBe('Dados inválidos')
    expect(setError).not.toHaveBeenCalled()
  })

  it('falha de rede e timeout: a mensagem própria do ErroRede', () => {
    const setError = vi.fn()
    expect(aplicarErrosDoServidor(new ErroRede(), setError, CAMPOS)).toBe('Não foi possível falar com o servidor.')
    expect(aplicarErrosDoServidor(new ErroRede({ porTimeout: true }), setError, CAMPOS)).toBe(
      'O servidor demorou demais para responder.',
    )
    expect(setError).not.toHaveBeenCalled()
  })

  it('erro que não é do client (bug, cancelamento): mensagem genérica, sem detalhes técnicos e sem lançar', () => {
    const setError = vi.fn()
    for (const erro of [new Error('stack secreto'), new TypeError('x'), null, undefined, 'texto']) {
      expect(aplicarErrosDoServidor(erro, setError, CAMPOS)).toBe(MENSAGEM_ERRO_INESPERADO)
    }
    expect(setError).not.toHaveBeenCalled()
    expect(MENSAGEM_ERRO_INESPERADO).not.toContain('stack')
  })
})

describe('aplicarErrosDoServidor com um mapa de campos (nomes da API diferentes dos do formulário)', () => {
  const MAPA = { valor_veiculo: 'valorVeiculo', valor_entrada: 'valorEntrada', prazo_meses_fundo: 'prazoMesesFundo' }

  it('marca o campo do FORMULÁRIO correspondente à chave da API', () => {
    const setError = vi.fn()
    const geral = aplicarErrosDoServidor(erro422({ valor_veiculo: ['Veículo inválido.'] }), setError, MAPA)
    expect(setError).toHaveBeenCalledTimes(1)
    expect(setError).toHaveBeenCalledWith('valorVeiculo', { type: 'servidor', message: 'Veículo inválido.' })
    expect(geral).toBeNull()
  })

  it('vários campos de uma vez, cada um no seu nome do formulário', () => {
    const setError = vi.fn()
    aplicarErrosDoServidor(
      erro422({ valor_entrada: ['Entrada.'], prazo_meses_fundo: ['Prazo.'] }),
      setError,
      MAPA,
    )
    expect(setError).toHaveBeenCalledWith('valorEntrada', { type: 'servidor', message: 'Entrada.' })
    expect(setError).toHaveBeenCalledWith('prazoMesesFundo', { type: 'servidor', message: 'Prazo.' })
  })

  it('a chave já no formato do formulário NÃO conta (só a chave da API é reconhecida): vira mensagem geral', () => {
    const setError = vi.fn()
    const geral = aplicarErrosDoServidor(erro422({ valorVeiculo: ['x'] }), setError, MAPA)
    expect(setError).not.toHaveBeenCalled()
    expect(geral).toBe('Dados inválidos')
  })

  it('chave fora do mapa: os campos conhecidos são marcados e sobra a mensagem geral', () => {
    const setError = vi.fn()
    const geral = aplicarErrosDoServidor(erro422({ valor_veiculo: ['x'], usuario_id: ['Campo desconhecido.'] }), setError, MAPA)
    expect(setError).toHaveBeenCalledTimes(1)
    expect(geral).toBe('Dados inválidos')
  })

  it('chaves herdadas do Object (constructor, toString) nunca contam como campo', () => {
    const setError = vi.fn()
    const geral = aplicarErrosDoServidor(erro422({ constructor: ['x'], toString: ['y'] }), setError, MAPA)
    expect(setError).not.toHaveBeenCalled()
    expect(geral).toBe('Dados inválidos')
  })

  it('a lista continua funcionando como antes (controle de compatibilidade)', () => {
    const setError = vi.fn()
    aplicarErrosDoServidor(erro422({ email: ['E-mail inválido.'] }), setError, ['nome', 'email'])
    expect(setError).toHaveBeenCalledWith('email', { type: 'servidor', message: 'E-mail inválido.' })
  })
})

