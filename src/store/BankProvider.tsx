import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as bank from '../lib/bank'
import { LOAN_RATE } from '../lib/bank'
import { supabase } from '../lib/supabaseClient'
import { fetchSharedState, pushDiff } from '../lib/supabaseSync'
import type { Account, BankState, Charge, Role } from '../lib/types'

const SESSION_KEY = 'credit-domestique:session'

interface Session {
  currentAccountId: string | null
  impersonatedBy: string | null
}

function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return { currentAccountId: null, impersonatedBy: null }
    const parsed = JSON.parse(raw)
    return {
      currentAccountId: parsed.currentAccountId ?? null,
      impersonatedBy: parsed.impersonatedBy ?? null,
    }
  } catch {
    return { currentAccountId: null, impersonatedBy: null }
  }
}

const emptyState: BankState = {
  accounts: [],
  entries: [],
  loans: [],
  charges: [],
  rate: LOAN_RATE,
  currentAccountId: null,
  impersonatedBy: null,
}

interface BankContextValue {
  state: BankState
  /** true until the initial fetch from Supabase completes */
  loading: boolean
  /** the account currently at the wheel: the logged-in account, or the impersonation target */
  currentAccount: Account | null
  /** the real admin account when impersonating someone else, else null */
  adminAccount: Account | null
  isAdmin: boolean
  login: (cardNumber: string, holderName: string, cvc: string) => Account | null
  logout: () => void
  depositCash: (holderId: string, amount: number) => void
  withdrawCash: (holderId: string, amount: number) => void
  transfer: (fromId: string, toId: string, amount: number, label: string) => void
  requestLoan: (borrowerId: string, lenderId: string, principal: number) => void
  acceptLoan: (loanId: string) => void
  refuseLoan: (loanId: string) => void
  repayLoan: (loanId: string) => void
  companyReceive: (companyId: string, amount: number, reason: string) => void
  companyWithdraw: (companyId: string, amount: number, reason: string) => void
  companyPay: (companyId: string, recipientId: string, amount: number, reason: string) => void
  requestCharge: (companyId: string, payerId: string, amount: number, reason: string) => Charge
  acceptCharge: (chargeId: string) => void
  refuseCharge: (chargeId: string) => void
  adjustBalance: (accountId: string, newBalance: number, label?: string) => void
  reverseEntry: (entryId: string) => void
  setLoanRate: (rate: number) => void
  createAccount: (input: {
    role: Role
    holderName: string
    cardNumber: string
    cvc: string
    expiry: string
    balance?: number
  }) => void
  archiveAccount: (accountId: string) => void
  impersonate: (accountId: string) => void
  stopImpersonating: () => void
}

const BankContext = createContext<BankContextValue | null>(null)

export function BankProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BankState>(emptyState)
  const [loading, setLoading] = useState(true)

  // Every mutation below runs through this: bank.ts never mutates in place,
  // so `next` is a fresh object we can both apply locally (optimistic) and
  // diff against `prev` to persist to Supabase — which every other device
  // then picks up via the realtime subscription.
  const applyMutation = useCallback((mutate: (prev: BankState) => BankState) => {
    setState((prev) => {
      const next = mutate(prev)
      if (next !== prev) {
        pushDiff(prev, next).catch((err) => console.error('Échec de synchronisation Supabase', err))
      }
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchSharedState()
      .then((shared) => {
        if (cancelled) return
        const session = loadSession()
        setState((prev) => ({ ...prev, ...shared, ...session }))
      })
      .catch((err) => console.error('Échec du chargement initial Supabase', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    let refetchTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer)
      refetchTimer = setTimeout(() => {
        fetchSharedState()
          .then((shared) => {
            if (!cancelled) setState((prev) => ({ ...prev, ...shared }))
          })
          .catch((err) => console.error('Échec de resynchronisation Supabase', err))
      }, 200)
    }

    const channel = supabase
      .channel('bank-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'charges' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, scheduleRefetch)
      .subscribe()

    return () => {
      cancelled = true
      if (refetchTimer) clearTimeout(refetchTimer)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const session: Session = {
      currentAccountId: state.currentAccountId,
      impersonatedBy: state.impersonatedBy,
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }, [state.currentAccountId, state.impersonatedBy])

  const login = useCallback((cardNumber: string, holderName: string, cvc: string) => {
    let result: Account | null = null
    setState((prev) => {
      const account = bank.login(prev, cardNumber, holderName, cvc)
      result = account
      if (!account) return prev
      return { ...prev, currentAccountId: account.id, impersonatedBy: null }
    })
    return result
  }, [])

  const logout = useCallback(() => {
    setState((prev) => ({ ...prev, currentAccountId: null, impersonatedBy: null }))
  }, [])

  const depositCash = useCallback(
    (holderId: string, amount: number) => {
      applyMutation((prev) => bank.depositCash(prev, holderId, amount))
    },
    [applyMutation],
  )

  const withdrawCash = useCallback(
    (holderId: string, amount: number) => {
      applyMutation((prev) => bank.withdrawCash(prev, holderId, amount))
    },
    [applyMutation],
  )

  const transfer = useCallback(
    (fromId: string, toId: string, amount: number, label: string) => {
      applyMutation((prev) => bank.transfer(prev, fromId, toId, amount, label))
    },
    [applyMutation],
  )

  const requestLoan = useCallback(
    (borrowerId: string, lenderId: string, principal: number) => {
      applyMutation((prev) => bank.requestLoan(prev, borrowerId, lenderId, principal).state)
    },
    [applyMutation],
  )

  const acceptLoan = useCallback(
    (loanId: string) => {
      applyMutation((prev) => bank.acceptLoan(prev, loanId).state)
    },
    [applyMutation],
  )

  const refuseLoan = useCallback(
    (loanId: string) => {
      applyMutation((prev) => bank.refuseLoan(prev, loanId).state)
    },
    [applyMutation],
  )

  const repayLoan = useCallback(
    (loanId: string) => {
      applyMutation((prev) => bank.repayLoan(prev, loanId).state)
    },
    [applyMutation],
  )

  const companyReceive = useCallback(
    (companyId: string, amount: number, reason: string) => {
      applyMutation((prev) => bank.companyReceive(prev, companyId, amount, reason))
    },
    [applyMutation],
  )

  const companyWithdraw = useCallback(
    (companyId: string, amount: number, reason: string) => {
      applyMutation((prev) => bank.companyWithdraw(prev, companyId, amount, reason))
    },
    [applyMutation],
  )

  const companyPay = useCallback(
    (companyId: string, recipientId: string, amount: number, reason: string) => {
      applyMutation((prev) => bank.companyPay(prev, companyId, recipientId, amount, reason))
    },
    [applyMutation],
  )

  const requestCharge = useCallback(
    (companyId: string, payerId: string, amount: number, reason: string) => {
      let created!: Charge
      setState((prev) => {
        const { state: next, charge } = bank.requestCharge(prev, companyId, payerId, amount, reason)
        created = charge
        if (next !== prev) {
          pushDiff(prev, next).catch((err) => console.error('Échec de synchronisation Supabase', err))
        }
        return next
      })
      return created
    },
    [],
  )

  const acceptCharge = useCallback(
    (chargeId: string) => {
      applyMutation((prev) => bank.acceptCharge(prev, chargeId).state)
    },
    [applyMutation],
  )

  const refuseCharge = useCallback(
    (chargeId: string) => {
      applyMutation((prev) => bank.refuseCharge(prev, chargeId).state)
    },
    [applyMutation],
  )

  const adjustBalance = useCallback(
    (accountId: string, newBalance: number, label?: string) => {
      applyMutation((prev) => bank.adjustBalance(prev, accountId, newBalance, label))
    },
    [applyMutation],
  )

  const reverseEntry = useCallback(
    (entryId: string) => {
      applyMutation((prev) => bank.reverseEntry(prev, entryId))
    },
    [applyMutation],
  )

  const setLoanRate = useCallback(
    (rate: number) => {
      applyMutation((prev) => bank.setLoanRate(prev, rate))
    },
    [applyMutation],
  )

  const createAccount = useCallback(
    (input: {
      role: Role
      holderName: string
      cardNumber: string
      cvc: string
      expiry: string
      balance?: number
    }) => {
      applyMutation((prev) => bank.createAccount(prev, input).state)
    },
    [applyMutation],
  )

  const archiveAccount = useCallback(
    (accountId: string) => {
      applyMutation((prev) => bank.archiveAccount(prev, accountId))
    },
    [applyMutation],
  )

  const impersonate = useCallback((accountId: string) => {
    setState((prev) => {
      if (!prev.currentAccountId) return prev
      const admin = prev.impersonatedBy ?? prev.currentAccountId
      return { ...prev, currentAccountId: accountId, impersonatedBy: admin }
    })
  }, [])

  const stopImpersonating = useCallback(() => {
    setState((prev) => {
      if (!prev.impersonatedBy) return prev
      return { ...prev, currentAccountId: prev.impersonatedBy, impersonatedBy: null }
    })
  }, [])

  const currentAccount = useMemo(
    () => state.accounts.find((a) => a.id === state.currentAccountId) ?? null,
    [state.accounts, state.currentAccountId],
  )
  const adminAccount = useMemo(
    () => state.accounts.find((a) => a.id === state.impersonatedBy) ?? null,
    [state.accounts, state.impersonatedBy],
  )
  const isAdmin = adminAccount?.role === 'admin' || currentAccount?.role === 'admin'

  const value: BankContextValue = {
    state,
    loading,
    currentAccount,
    adminAccount,
    isAdmin,
    login,
    logout,
    depositCash,
    withdrawCash,
    transfer,
    requestLoan,
    acceptLoan,
    refuseLoan,
    repayLoan,
    companyReceive,
    companyWithdraw,
    companyPay,
    requestCharge,
    acceptCharge,
    refuseCharge,
    adjustBalance,
    reverseEntry,
    setLoanRate,
    createAccount,
    archiveAccount,
    impersonate,
    stopImpersonating,
  }

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>
}

export function useBank(): BankContextValue {
  const ctx = useContext(BankContext)
  if (!ctx) throw new Error('useBank must be used within a BankProvider')
  return ctx
}
