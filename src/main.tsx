import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Providers } from './app/providers'
import { AppErrorBoundary } from './app/AppErrorBoundary'
import AppRouter from './app/router'
import { initMonitoring } from './shared/lib/monitoring'

initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <Providers>
        <AppRouter />
      </Providers>
    </AppErrorBoundary>
  </StrictMode>,
)
