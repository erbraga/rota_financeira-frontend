// Validação dos formulários de autenticação (Zod). As regras espelham as do backend e as mensagens são as
// dele, em português. A senha NÃO sofre trim (espaços valem); nome e e-mail são aparados.
import { z } from 'zod'

export const OBRIGATORIO = 'Campo obrigatório.'
const MSG_NOME = 'O nome deve ter entre 2 e 120 caracteres.'
const MSG_SENHA = 'A senha deve ter entre 8 e 128 caracteres.'
const MSG_SENHA_LOGIN = 'A senha deve ter de 1 a 128 caracteres.'

const texto = () => z.string({ error: OBRIGATORIO })

const email = texto()
  .trim()
  .min(1, OBRIGATORIO)
  .max(254, 'O e-mail deve ter até 254 caracteres.')
  .pipe(z.email({ error: 'E-mail inválido.' }))

export const esquemaLogin = z.object({
  email,
  // Só o que o backend exige no login: de 1 a 128 caracteres (sem regra mínima de 8).
  senha: texto().min(1, OBRIGATORIO).max(128, MSG_SENHA_LOGIN),
})

export const esquemaRegistro = z
  .object({
    nome: texto().trim().min(1, OBRIGATORIO).min(2, MSG_NOME).max(120, MSG_NOME),
    email,
    senha: texto().min(1, OBRIGATORIO).min(8, MSG_SENHA).max(128, MSG_SENHA),
    // Só existe no cliente: a página a remove antes de enviar.
    confirmacao: texto().min(1, 'Confirme a senha.'),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    path: ['confirmacao'],
    error: 'As senhas não conferem.',
  })
