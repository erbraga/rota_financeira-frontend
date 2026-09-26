import { http, HttpResponse } from 'msw'
import { lerConfig } from '../../config.js'

const { urlApi } = lerConfig()

export const handlersSaude = [
  http.get(`${urlApi}/saude`, () => HttpResponse.json({ banco: 'ok', status: 'ok' })),
]
