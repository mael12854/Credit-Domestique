import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as bank from '../lib/bank'
import { createInitialState } from '../lib/seed'
import type { Account, BankState, Role } from '../lib/types'

const STORAGE_KEY = 'credit-domestique:v1'

function loadState(): BankState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as BankState
    if (!parsed.accounts || !parsed.entries) return createInitialState()
    return parsed
  } catch {
    return createInitialState()
  }
}

interface BankContextValue {
  state: BankState
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
  }) => Account
  archiveAccount: (accountId: string) => void
  impersonate: (accountId: string) => void
  stopImpersonating: () => void
  resetDemo: () => void
}

const BankContext = createContext<BankContextValue | null>(null)

export function BankProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BankState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

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

  const depositCash = useCallback((holderId: string, amount: number) => {
    setState((prev) => bank.depositCash(prev, holderId, amount))
  }, [])

  const withdrawCash = useCallback((holderId: string, amount: number) => {
    setState((prev) => bank.withdrawCash(prev, holderId, amount))
  }, [])

  const transfer = useCallback((fromId: string, toId: string, amount: number, label: string) => {
    setState((prev) => bank.transfer(prev, fromId, toId, amount, label))
  }, [])

  const requestLoan = useCallback((borrowerId: string, lenderId: string, principal: number) => {
    setState((prev) => bank.requestLoan(prev, borrowerId, lenderId, principal).state)
  }, [])

  const acceptLoan = useCallback((loanId: string) => {
    setState((prev) => bank.acceptLoan(prev, loanId).state)
  }, [])

  const refuseLoan = useCallback((loanId: string) => {
    setState((prev) => bank.refuseLoan(prev, loanId).state)
  }, [])

  const repayLoan = useCallback((loanId: string) => {
    setState((prev) => bank.repayLoan(prev, loanId).state)
  }, [])

  const companyReceive = useCallback((companyId: string, amount: number, reason: string) => {
    setState((prev) => bank.companyReceive(prev, companyId, amount, reason))
  }, [])

  const companyWithdraw = useCallback((companyId: string, amount: number, reason: string) => {
    setState((prev) => bank.companyWithdraw(prev, companyId, amount, reason))
  }, [])

  const adjustBalance = useCallback((accountId: string, newBalance: number, label?: string) => {
    setState((prev) => bank.adjustBalance(prev, accountId, newBalance, label))
  }, [])

  const reverseEntry = useCallback((entryId: string) => {
    setState((prev) => bank.reverseEntry(prev, entryId))
  }, [])

  const setLoanRate = useCallback((rate: number) => {
    setState((prev) => bank.setLoanRate(prev, rate))
  }, [])

  const createAccount = useCallback(
    (input: {
      role: Role
      holderName: string
      cardNumber: string
      cvc: string
      expiry: string
      balance?: number
    }) => {
      let created!: Account
      setState((prev) => {
        const { state: next, account } = bank.createAccount(prev, input)
        created = account
        return next
      })
      return created
    },
    [],
  )

  const archiveAccount = useCallback((accountId: string) => {
    setState((prev) => bank.archiveAccount(prev, accountId))
  }, [])

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

  const resetDemo = useCallback(() => {
    setState(createInitialState())
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
    adjustBalance,
    reverseEntry,
    setLoanRate,
    createAccount,
    archiveAccount,
    impersonate,
    stopImpersonating,
    resetDemo,
  }

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>
}

export function useBank(): BankContextValue {
  const ctx = useContext(BankContext)
  if (!ctx) throw new Error('useBank must be used within a BankProvider')
  return ctx
}
