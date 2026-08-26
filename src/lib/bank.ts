import type { Account, BankState, Entry, EntryKind, Loan, Role } from './types'

export const LOAN_RATE = 0.3333
export const FOUNDER_INTEREST_LABEL = 'Intérêts 33,33 % · rev. fondateur'
export const CASH_DEPOSIT_LABEL = 'Dépôt espèces · tirelire'
export const CASH_WITHDRAWAL_LABEL = 'Retrait espèces · tirelire'
export const BANK_HOLDER_NAME = 'CRÉDIT DOMESTIQUE'

export const BANK_ID = 'bank'
export const FOUNDER_ID = 'mael'

function id(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** ceil(principal * rate) to the cent, e.g. 3000 @ 33.33% -> 1000 (30€ -> 10€ interest) */
export function computeInterest(principalCents: number, rate: number = LOAN_RATE): number {
  return Math.ceil(principalCents * rate)
}

export function computeTotalDue(principalCents: number, rate: number = LOAN_RATE): number {
  return principalCents + computeInterest(principalCents, rate)
}

const NBSP = '\u00A0'

/** Groups an integer's digits by thousands with a non-breaking space, e.g. 1000 -> "1 000" */
function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

export function formatMoneyFR(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = Math.floor(abs / 100)
  const centsPart = String(abs % 100).padStart(2, '0')
  return `${sign}${groupThousands(euros)},${centsPart}${NBSP}€`
}

export function findAccount(state: BankState, accountId: string): Account | undefined {
  return state.accounts.find((a) => a.id === accountId)
}

export function accountEntries(state: BankState, accountId: string): Entry[] {
  return state.entries
    .filter((e) => e.accountId === accountId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

export class BankError extends Error {}

function requireAccount(state: BankState, accountId: string): Account {
  const account = findAccount(state, accountId)
  if (!account) throw new BankError(`Compte introuvable : ${accountId}`)
  return account
}

interface PostDoubleEntryArgs {
  fromId: string
  toId: string
  amount: number // cents, always positive
  label: string
  kind: EntryKind
  byAdmin?: boolean
  date?: string
}

/**
 * Writes one double-entry movement: a debit leg on `fromId` and a credit leg
 * on `toId`, for the same amount. Recomputes both balances. Never mutates
 * the input state — returns a new BankState plus the two entries created.
 */
export function postDoubleEntry(
  state: BankState,
  args: PostDoubleEntryArgs,
): { state: BankState; debitEntry: Entry; creditEntry: Entry } {
  const { fromId, toId, amount, label, kind, byAdmin = false, date = nowIso() } = args
  if (amount <= 0) throw new BankError('Le montant doit être positif.')
  const from = requireAccount(state, fromId)
  const to = requireAccount(state, toId)

  const transactionId = id()
  const fromBalanceAfter = from.balance - amount
  const toBalanceAfter = to.balance + amount

  const debitEntry: Entry = {
    id: id(),
    accountId: fromId,
    date,
    label,
    kind,
    debit: amount,
    credit: null,
    balanceAfter: fromBalanceAfter,
    counterpartyId: toId,
    byAdmin,
    transactionId,
  }
  const creditEntry: Entry = {
    id: id(),
    accountId: toId,
    date,
    label,
    kind,
    debit: null,
    credit: amount,
    balanceAfter: toBalanceAfter,
    counterpartyId: fromId,
    byAdmin,
    transactionId,
  }

  const accounts = state.accounts.map((a) => {
    if (a.id === fromId) return { ...a, balance: fromBalanceAfter }
    if (a.id === toId) return { ...a, balance: toBalanceAfter }
    return a
  })

  return {
    state: { ...state, accounts, entries: [...state.entries, debitEntry, creditEntry] },
    debitEntry,
    creditEntry,
  }
}

export function depositCash(state: BankState, holderId: string, amount: number): BankState {
  return postDoubleEntry(state, {
    fromId: BANK_ID,
    toId: holderId,
    amount,
    label: CASH_DEPOSIT_LABEL,
    kind: 'deposit',
  }).state
}

export function withdrawCash(state: BankState, holderId: string, amount: number): BankState {
  return postDoubleEntry(state, {
    fromId: holderId,
    toId: BANK_ID,
    amount,
    label: CASH_WITHDRAWAL_LABEL,
    kind: 'withdrawal',
  }).state
}

export function transfer(
  state: BankState,
  fromId: string,
  toId: string,
  amount: number,
  label: string,
): BankState {
  return postDoubleEntry(state, { fromId, toId, amount, label, kind: 'transfer' }).state
}

/** Company cash movements: receiving payment (credit) or withdrawing (debit), vs. the bank. */
export function companyReceive(
  state: BankState,
  companyId: string,
  amount: number,
  reason: string,
): BankState {
  return postDoubleEntry(state, {
    fromId: BANK_ID,
    toId: companyId,
    amount,
    label: reason,
    kind: 'deposit',
  }).state
}

export function companyWithdraw(
  state: BankState,
  companyId: string,
  amount: number,
  reason: string,
): BankState {
  return postDoubleEntry(state, {
    fromId: companyId,
    toId: BANK_ID,
    amount,
    label: reason,
    kind: 'withdrawal',
  }).state
}

/**
 * Signs a loan: credits the borrower with the principal and Maël (founder)
 * with the interest, both drawn from the bank account. The interest never
 * touches the bank's or a parent's balance.
 */
export function openLoan(
  state: BankState,
  borrowerId: string,
  principal: number,
): { state: BankState; loan: Loan } {
  if (principal <= 0) throw new BankError('Le capital emprunté doit être positif.')
  const rate = state.rate ?? LOAN_RATE
  const interest = computeInterest(principal, rate)
  const totalDue = principal + interest
  const date = nowIso()

  const afterPrincipal = postDoubleEntry(state, {
    fromId: BANK_ID,
    toId: borrowerId,
    amount: principal,
    label: 'Emprunt · capital',
    kind: 'loan',
    date,
  }).state

  const afterInterest = postDoubleEntry(afterPrincipal, {
    fromId: BANK_ID,
    toId: FOUNDER_ID,
    amount: interest,
    label: FOUNDER_INTEREST_LABEL,
    kind: 'interest',
    date,
  }).state

  const loan: Loan = {
    id: id(),
    borrowerId,
    principal,
    rate,
    interest,
    totalDue,
    repaid: 0,
    openedAt: date,
  }

  return { state: { ...afterInterest, loans: [...afterInterest.loans, loan] }, loan }
}

export function repayLoan(
  state: BankState,
  loanId: string,
  amount: number,
): { state: BankState; loan: Loan } {
  const loan = state.loans.find((l) => l.id === loanId)
  if (!loan) throw new BankError('Prêt introuvable.')
  const remaining = loan.totalDue - loan.repaid
  if (amount <= 0 || amount > remaining) {
    throw new BankError('Montant de remboursement invalide.')
  }
  const nextState = postDoubleEntry(state, {
    fromId: loan.borrowerId,
    toId: BANK_ID,
    amount,
    label: 'Remboursement · échéance',
    kind: 'transfer',
  }).state
  const updatedLoan: Loan = { ...loan, repaid: loan.repaid + amount }
  return {
    state: { ...nextState, loans: nextState.loans.map((l) => (l.id === loanId ? updatedLoan : l)) },
    loan: updatedLoan,
  }
}

/** Admin: sets an account's balance to an arbitrary value via an adjustment entry. */
export function adjustBalance(
  state: BankState,
  accountId: string,
  newBalance: number,
  label = 'Ajustement administrateur',
): BankState {
  const account = requireAccount(state, accountId)
  const delta = newBalance - account.balance
  if (delta === 0) return state
  if (delta > 0) {
    return postDoubleEntry(state, {
      fromId: BANK_ID,
      toId: accountId,
      amount: delta,
      label,
      kind: 'adjustment',
      byAdmin: true,
    }).state
  }
  return postDoubleEntry(state, {
    fromId: accountId,
    toId: BANK_ID,
    amount: -delta,
    label,
    kind: 'adjustment',
    byAdmin: true,
  }).state
}

/**
 * Reverses a movement: nothing is ever deleted. Writes a new double-entry
 * pair with debit/credit swapped relative to the original transaction.
 */
export function reverseEntry(state: BankState, entryId: string): BankState {
  const entry = state.entries.find((e) => e.id === entryId)
  if (!entry) throw new BankError('Écriture introuvable.')
  if (entry.reversalOf) throw new BankError('Une annulation ne peut pas être annulée.')
  const alreadyReversed = state.entries.some((e) => e.reversalOf === entry.id)
  if (alreadyReversed) throw new BankError('Cette écriture a déjà été annulée.')

  const amount = entry.debit ?? entry.credit
  if (amount == null || !entry.counterpartyId) {
    throw new BankError('Écriture non réversible.')
  }
  // The original debited `entry.accountId` and credited `entry.counterpartyId`
  // (or vice-versa). Reversing means running the same amount the other way.
  const wasDebit = entry.debit != null
  const fromId = wasDebit ? entry.counterpartyId : entry.accountId
  const toId = wasDebit ? entry.accountId : entry.counterpartyId

  const { state: nextState, debitEntry } = postDoubleEntry(state, {
    fromId,
    toId,
    amount,
    label: `Annulation · ${entry.label}`,
    kind: 'adjustment',
    byAdmin: true,
  })

  return {
    ...nextState,
    entries: nextState.entries.map((e) =>
      e.id === debitEntry.id ? { ...e, reversalOf: entry.id } : e,
    ),
  }
}

/** Admin: changes the loan interest rate applied to future loans. */
export function setLoanRate(state: BankState, rate: number): BankState {
  if (rate < 0) throw new BankError('Le taux ne peut pas être négatif.')
  return { ...state, rate }
}

export function createAccount(
  state: BankState,
  input: {
    role: Role
    holderName: string
    cardNumber: string
    cvc: string
    expiry: string
    balance?: number
  },
): { state: BankState; account: Account } {
  const account: Account = {
    id: id(),
    role: input.role,
    holderName: input.holderName.toUpperCase(),
    cardNumber: input.cardNumber.replace(/\s+/g, ''),
    cvc: input.cvc,
    expiry: input.expiry,
    balance: input.balance ?? 0,
    createdAt: nowIso(),
  }
  return { state: { ...state, accounts: [...state.accounts, account] }, account }
}

/** Nothing is ever deleted: "deleting" an account archives it instead. */
export function archiveAccount(state: BankState, accountId: string): BankState {
  requireAccount(state, accountId)
  return {
    ...state,
    accounts: state.accounts.map((a) => (a.id === accountId ? { ...a, archived: true } : a)),
  }
}

export function login(
  state: BankState,
  cardNumber: string,
  holderName: string,
  cvc: string,
): Account | null {
  const normalizedCard = cardNumber.replace(/\s+/g, '')
  const normalizedName = holderName.trim().toUpperCase()
  if (normalizedCard === '' || normalizedName === '' || cvc === '') return null
  const account = state.accounts.find(
    (a) =>
      !a.archived &&
      a.cardNumber === normalizedCard &&
      a.holderName === normalizedName &&
      a.cvc === cvc,
  )
  return account ?? null
}
