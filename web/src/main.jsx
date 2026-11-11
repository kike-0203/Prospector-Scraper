import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ContratarDemo from './ContratarDemo.jsx'

const isSalesPage = window.location.pathname.replace(/\/$/, '') === '/contratar'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isSalesPage ? <ContratarDemo /> : <App />}
  </StrictMode>,
)
