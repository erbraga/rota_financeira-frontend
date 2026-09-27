import { describe, expect, it } from 'vitest'
import { esquemaLogin, esquemaRegistro, OBRIGATORIO } from './auth.js'

// Primeira mensagem de cada campo (como o React Hook Form as mostra).
function mensagens(resultado) {
  const porCampo = {}
  for (const problema of resultado.error?.issues ?? []) {
    const campo = problema.path[0]
    porCampo[campo] ??= problema.message
  }
  return porCampo
}

const REGISTRO = { nome: 'Caio Souza', email: 'caio@example.com', senha: 'uma senha longa', confirmacao: 'uma senha longa' }
const registro = (alteracao) => esquemaRegistro.safeParse({ ...REGISTRO, ...alteracao })

describe('esquemaRegistro', () => {
  it('aceita dados válidos (controle dos casos inválidos)', () => {
    const r = registro({})
    expect(r.success).toBe(true)
    expect(r.data).toEqual(REGISTRO)
  })

  it.each([
    [1, false],
    [2, true],
    [120, true],
    [121, false],
  ])('nome com %i caracteres -> válido: %s', (tamanho, valido) => {
    const r = registro({ nome: 'n'.repeat(tamanho) })
    expect(r.success).toBe(valido)
    if (!valido) expect(mensagens(r).nome).toBe('O nome deve ter entre 2 e 120 caracteres.')
  })

  it('o nome é aparado antes de contar: " A " é curto e " Ana " vira "Ana"', () => {
    expect(mensagens(registro({ nome: ' A ' })).nome).toBe('O nome deve ter entre 2 e 120 caracteres.')
    expect(registro({ nome: '  Ana  ' }).data.nome).toBe('Ana')
  })

  it.each([
    [7, false],
    [8, true],
    [128, true],
    [129, false],
  ])('senha com %i caracteres -> válida: %s', (tamanho, valida) => {
    const senha = 'x'.repeat(tamanho)
    const r = registro({ senha, confirmacao: senha })
    expect(r.success).toBe(valida)
    if (!valida) expect(mensagens(r).senha).toBe('A senha deve ter entre 8 e 128 caracteres.')
  })

  it('a senha NÃO é aparada: 8 espaços são válidos e preservados', () => {
    const r = registro({ senha: '        ', confirmacao: '        ' })
    expect(r.success).toBe(true)
    expect(r.data.senha).toBe('        ')
  })

  it('confirmação diferente da senha -> erro na confirmação', () => {
    const r = registro({ confirmacao: 'outra senha longa' })
    expect(r.success).toBe(false)
    expect(mensagens(r)).toEqual({ confirmacao: 'As senhas não conferem.' })
  })

  it('a confirmação diferenciada só por espaço também não confere', () => {
    expect(registro({ confirmacao: 'uma senha longa ' }).success).toBe(false)
  })

  it('campos vazios -> "Campo obrigatório." (e "Confirme a senha." na confirmação)', () => {
    const r = esquemaRegistro.safeParse({ nome: '', email: '', senha: '', confirmacao: '' })
    const m = mensagens(r)
    expect(m.nome).toBe(OBRIGATORIO)
    expect(m.email).toBe(OBRIGATORIO)
    expect(m.senha).toBe(OBRIGATORIO)
    expect(m.confirmacao).toBe('Confirme a senha.')
  })

  it('campos ausentes (undefined) também dão "Campo obrigatório."', () => {
    const m = mensagens(esquemaRegistro.safeParse({}))
    expect(m.nome).toBe(OBRIGATORIO)
    expect(m.email).toBe(OBRIGATORIO)
    expect(m.senha).toBe(OBRIGATORIO)
  })
})

describe('e-mail (registro e login)', () => {
  it.each(['ana@example.com', 'ana.souza+carros@empresa.com.br', 'a@b.co'])('aceita %s', (email) => {
    expect(registro({ email }).success).toBe(true)
  })

  it.each(['ana', 'ana@', '@example.com', 'ana@example', 'a b@example.com', 'ana@@example.com'])(
    'recusa "%s" com "E-mail inválido."',
    (email) => {
      const r = registro({ email })
      expect(r.success).toBe(false)
      expect(mensagens(r).email).toBe('E-mail inválido.')
    },
  )

  it('apara os espaços das pontas', () => {
    expect(registro({ email: '  ana@example.com  ' }).data.email).toBe('ana@example.com')
  })

  it('e-mail com mais de 254 caracteres tem mensagem própria', () => {
    const r = registro({ email: `${'a'.repeat(250)}@b.co` })
    expect(mensagens(r).email).toBe('O e-mail deve ter até 254 caracteres.')
  })
})

describe('esquemaLogin', () => {
  it('aceita e-mail válido e qualquer senha de 1 a 128 caracteres (sem o mínimo de 8)', () => {
    expect(esquemaLogin.safeParse({ email: 'ana@example.com', senha: 'x' }).success).toBe(true)
    expect(esquemaLogin.safeParse({ email: 'ana@example.com', senha: 'x'.repeat(128) }).success).toBe(true)
  })

  it('senha vazia -> obrigatório; com 129 caracteres -> mensagem do login', () => {
    expect(mensagens(esquemaLogin.safeParse({ email: 'ana@example.com', senha: '' })).senha).toBe(OBRIGATORIO)
    expect(mensagens(esquemaLogin.safeParse({ email: 'ana@example.com', senha: 'x'.repeat(129) })).senha).toBe(
      'A senha deve ter de 1 a 128 caracteres.',
    )
  })

  it('e-mail vazio ou malformado', () => {
    expect(mensagens(esquemaLogin.safeParse({ email: '', senha: 'x' })).email).toBe(OBRIGATORIO)
    expect(mensagens(esquemaLogin.safeParse({ email: 'nao-e-email', senha: 'x' })).email).toBe('E-mail inválido.')
  })

  it('a senha do login também preserva os espaços', () => {
    const r = esquemaLogin.safeParse({ email: 'ana@example.com', senha: ' com espaços ' })
    expect(r.data.senha).toBe(' com espaços ')
  })
})
