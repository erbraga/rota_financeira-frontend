import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Raiz from './Raiz.jsx'
import { lerConfig } from './config.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Raiz erroConfig={lerConfig().erro} />
  </StrictMode>,
)
