import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/admin-mobile.css'
import './styles/preview.css'
import App from './App.jsx'
import { SignupPage } from './components/SignupPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {window.location.pathname === '/signup' ? <SignupPage /> : <App />}
  </StrictMode>,
)
