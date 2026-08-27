import type { Account, BankState, Charge, Entry, EntryKind, Loan, Role } from './types'

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
 * A company pays a specific person directly from its own funds (e.g. an
 * allowance source) — a straight credit, so unlike a charge it never needs
 * that person's confirmation.
 */
export function companyPay(
  state: BankState,
  companyId: string,
  recipientId: string,
  amount: number,
  reason: string,
): BankState {
  return postDoubleEntry(state, {
    fromId: companyId,
    toId: recipientId,
    amount,
    label: reason,
    kind: 'payment',
  }).state
}

function requireCharge(state: BankState, chargeId: string): Charge {
  const charge = state.charges.find((c) => c.id === chargeId)
  if (!charge) throw new BankError('Demande de paiement introuvable.')
  return charge
}

function replaceCharge(state: BankState, charge: Charge): BankState {
  return { ...state, charges: state.charges.map((c) => (c.id === charge.id ? charge : c)) }
}

/**
 * A company asks to debit a specific customer — the "contactless" gesture:
 * nothing moves until that person confirms the tap.
 */
export function requestCharge(
  state: BankState,
  companyId: string,
  payerId: string,
  amount: number,
  reason: string,
): { state: BankState; charge: Charge } {
  if (amount <= 0) throw new BankError('Le montant doit être positif.')
  if (payerId === companyId) throw new BankError('Une entreprise ne peut pas se débiter elle-même.')
  requireAccount(state, companyId)
  requireAccount(state, payerId)

  const charge: Charge = {
    id: id(),
    companyId,
    payerId,
    amount,
    reason,
    status: 'pending',
    requestedAt: nowIso(),
  }

  return { state: { ...state, charges: [...state.charges, charge] }, charge }
}

/** The customer confirms the tap: the amount moves straight from them to the company. */
export function acceptCharge(
  state: BankState,
  chargeId: string,
): { state: BankState; charge: Charge } {
  const charge = requireCharge(state, chargeId)
  if (charge.status !== 'pending') throw new BankError('Cette demande a déjà été traitée.')

  const nextState = postDoubleEntry(state, {
    fromId: charge.payerId,
    toId: charge.companyId,
    amount: charge.amount,
    label: charge.reason,
    kind: 'payment',
  }).state

  const updatedCharge: Charge = { ...charge, status: 'accepted', respondedAt: nowIso() }
  return { state: replaceCharge(nextState, updatedCharge), charge: updatedCharge }
}

/** The customer declines the tap: nothing ever moved, so there's nothing to reverse. */
export function refuseCharge(
  state: BankState,
  chargeId: string,
): { state: BankState; charge: Charge } {
  const charge = requireCharge(state, chargeId)
  if (charge.status !== 'pending') throw new BankError('Cette demande a déjà été traitée.')

  const updatedCharge: Charge = { ...charge, status: 'refused', respondedAt: nowIso() }
  return { state: replaceCharge(state, updatedCharge), charge: updatedCharge }
}

function requireLoan(state: BankState, loanId: string): Loan {
  const loan = state.loans.find((l) => l.id === loanId)
  if (!loan) throw new BankError('Prêt introuvable.')
  return loan
}

function replaceLoan(state: BankState, loan: Loan): BankState {
  return { ...state, loans: state.loans.map((l) => (l.id === loan.id ? loan : l)) }
}

/**
 * Requests a loan from a chosen lender. Nothing moves yet — the lender must
 * accept. Only a loan from the founder carries interest; any other lender is
 * an interest-free peer loan.
 */
export function requestLoan(
  state: BankState,
  borrowerId: string,
  lenderId: string,
  principal: number,
): { state: BankState; loan: Loan } {
  if (principal <= 0) throw new BankError('Le capital emprunté doit être positif.')
  if (lenderId === borrowerId) throw new BankError('Impossible de vous emprunter à vous-même.')
  requireAccount(state, borrowerId)
  requireAccount(state, lenderId)

  const isFounderLoan = lenderId === FOUNDER_ID
  const rate = isFounderLoan ? state.rate ?? LOAN_RATE : 0
  const interest = isFounderLoan ? computeInterest(principal, rate) : 0
  const totalDue = principal + interest

  const loan: Loan = {
    id: id(),
    borrowerId,
    lenderId,
    principal,
    rate,
    interest,
    totalDue,
    repaid: 0,
    status: 'pending',
    requestedAt: nowIso(),
  }

  return { state: { ...state, loans: [...state.loans, loan] }, loan }
}

/** The lender accepts a pending request: the principal moves from their own account to the borrower's. */
export function acceptLoan(state: BankState, loanId: string): { state: BankState; loan: Loan } {
  const loan = requireLoan(state, loanId)
  if (loan.status !== 'pending') throw new BankError('Cette demande a déjà été traitée.')

  const nextState = postDoubleEntry(state, {
    fromId: loan.lenderId,
    toId: loan.borrowerId,
    amount: loan.principal,
    label: 'Emprunt · capital',
    kind: 'loan',
  }).state

  const updatedLoan: Loan = { ...loan, status: 'accepted', respondedAt: nowIso() }
  return { state: replaceLoan(nextState, updatedLoan), loan: updatedLoan }
}

/** The lender refuses a pending request: nothing was ever moved, so there's nothing to reverse. */
export function refuseLoan(state: BankState, loanId: string): { state: BankState; loan: Loan } {
  const loan = requireLoan(state, loanId)
  if (loan.status !== 'pending') throw new BankError('Cette demande a déjà été traitée.')

  const updatedLoan: Loan = { ...loan, status: 'refused', respondedAt: nowIso() }
  return { state: replaceLoan(state, updatedLoan), loan: updatedLoan }
}

/**
 * Repays an accepted loan in full: the principal goes back to the lender.
 * When the lender is the founder, the interest is paid alongside it as its
 * own labeled entry — so it always lands on him, in full, whoever the
 * borrower is.
 */
export function repayLoan(state: BankState, loanId: string): { state: BankState; loan: Loan } {
  const loan = requireLoan(state, loanId)
  if (loan.status !== 'accepted') throw new BankError('Ce prêt ne peut pas être remboursé.')

  const date = nowIso()
  const afterPrincipal = postDoubleEntry(state, {
    fromId: loan.borrowerId,
    toId: loan.lenderId,
    amount: loan.principal,
    label: 'Remboursement · échéance',
    kind: 'transfer',
    date,
  }).state

  const afterInterest =
    loan.interest > 0
      ? postDoubleEntry(afterPrincipal, {
          fromId: loan.borrowerId,
          toId: loan.lenderId,
          amount: loan.interest,
          label: FOUNDER_INTEREST_LABEL,
          kind: 'interest',
          date,
        }).state
      : afterPrincipal

  const updatedLoan: Loan = { ...loan, status: 'repaid', repaid: loan.totalDue }
  return { state: replaceLoan(afterInterest, updatedLoan), loan: updatedLoan }
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
