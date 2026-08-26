import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export type Screen =
  | 'connexion'
  | 'compte'
  | 'historique'
  | 'virement'
  | 'depot'
  | 'emprunt'
  | 'entreprises'
  | 'entreprise-detail'
  | 'admin'

export interface NavEntry {
  screen: Screen
  params?: Record<string, string>
}

interface NavContextValue {
  current: NavEntry
  canGoBack: boolean
  navigate: (screen: Screen, params?: Record<string, string>) => void
  back: () => void
  reset: (screen: Screen) => void
}

const NavContext = createContext<NavContextValue | null>(null)

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<NavEntry[]>([{ screen: 'connexion' }])

  const navigate = useCallback((screen: Screen, params?: Record<string, string>) => {
    setStack((prev) => [...prev, { screen, params }])
  }, [])

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const reset = useCallback((screen: Screen) => {
    setStack([{ screen }])
  }, [])

  const value: NavContextValue = {
    current: stack[stack.length - 1],
    canGoBack: stack.length > 1,
    navigate,
    back,
    reset,
  }

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used within a NavProvider')
  return ctx
}
