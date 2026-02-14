import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import { BrowserRouter } from 'react-router-dom'
import AuthProvider from '@/shared/context/AuthProvider'
import ThemeProvider from '@/shared/context/ThemeProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <ToastProvider>{children}</ToastProvider>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
