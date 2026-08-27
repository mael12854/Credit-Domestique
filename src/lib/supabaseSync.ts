import { supabase } from './supabaseClient'
import type { Account, BankState, Entry, Loan } from './types'

type SharedState = Pick<BankState, 'accounts' | 'entries' | 'loans' | 'rate'>

function rowToAccount(row: any): Account {
  return {
    id: row.id,
    role: row.role,
    holderName: row.holder_name,
    cardNumber: row.card_number,
    cvc: row.cvc,
    expiry: row.expiry,
    balance: row.balance,
    createdAt: row.created_at,
    archived: row.archived,
  }
}

function accountToRow(a: Account) {
  return {
    id: a.id,
    role: a.role,
    holder_name: a.holderName,
    card_number: a.cardNumber,
    cvc: a.cvc,
    expiry: a.expiry,
    balance: a.balance,
    created_at: a.createdAt,
    archived: a.archived ?? false,
  }
}

function rowToEntry(row: any): Entry {
  return {
    id: row.id,
    accountId: row.account_id,
    date: row.date,
    label: row.label,
    kind: row.kind,
    debit: row.debit,
    credit: row.credit,
    balanceAfter: row.balance_after,
    counterpartyId: row.counterparty_id,
    byAdmin: row.by_admin,
    transactionId: row.transaction_id,
    reversalOf: row.reversal_of ?? undefined,
  }
}

function entryToRow(e: Entry) {
  return {
    id: e.id,
    account_id: e.accountId,
    date: e.date,
    label: e.label,
    kind: e.kind,
    debit: e.debit,
    credit: e.credit,
    balance_after: e.balanceAfter,
    counterparty_id: e.counterpartyId,
    by_admin: e.byAdmin,
    transaction_id: e.transactionId,
    reversal_of: e.reversalOf ?? null,
  }
}

function rowToLoan(row: any): Loan {
  return {
    id: row.id,
    borrowerId: row.borrower_id,
    lenderId: row.lender_id,
    principal: row.principal,
    rate: Number(row.rate),
    interest: row.interest,
    totalDue: row.total_due,
    repaid: row.repaid,
    status: row.status,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at ?? undefined,
  }
}

function loanToRow(l: Loan) {
  return {
    id: l.id,
    borrower_id: l.borrowerId,
    lender_id: l.lenderId,
    principal: l.principal,
    rate: l.rate,
    interest: l.interest,
    total_due: l.totalDue,
    repaid: l.repaid,
    status: l.status,
    requested_at: l.requestedAt,
    responded_at: l.respondedAt ?? null,
  }
}

export async function fetchSharedState(): Promise<SharedState> {
  const [accountsRes, entriesRes, loansRes, settingsRes] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('entries').select('*').order('date').order('id'),
    supabase.from('loans').select('*').order('requested_at'),
    supabase.from('settings').select('*').eq('id', 1).single(),
  ])
  if (accountsRes.error) throw accountsRes.error
  if (entriesRes.error) throw entriesRes.error
  if (loansRes.error) throw loansRes.error
  if (settingsRes.error) throw settingsRes.error

  return {
    accounts: accountsRes.data.map(rowToAccount),
    entries: entriesRes.data.map(rowToEntry),
    loans: loansRes.data.map(rowToLoan),
    rate: Number(settingsRes.data.rate),
  }
}

/**
 * Persists whatever changed between two BankState snapshots. bank.ts never
 * mutates in place, so referential inequality reliably marks what's new —
 * this diff is what makes the local optimistic update durable and shared
 * across every device.
 */
export async function pushDiff(prev: BankState, next: BankState): Promise<void> {
  const prevEntryIds = new Set(prev.entries.map((e) => e.id))
  const newEntries = next.entries.filter((e) => !prevEntryIds.has(e.id))
  if (newEntries.length > 0) {
    const { error } = await supabase.from('entries').insert(newEntries.map(entryToRow))
    if (error) throw error
  }

  const prevAccountsById = new Map(prev.accounts.map((a) => [a.id, a]))
  const newAccounts: Account[] = []
  const changedAccounts: Account[] = []
  for (const a of next.accounts) {
    const p = prevAccountsById.get(a.id)
    if (!p) newAccounts.push(a)
    else if (p !== a) changedAccounts.push(a)
  }
  if (newAccounts.length > 0) {
    const { error } = await supabase.from('accounts').insert(newAccounts.map(accountToRow))
    if (error) throw error
  }
  for (const a of changedAccounts) {
    const { error } = await supabase.from('accounts').update(accountToRow(a)).eq('id', a.id)
    if (error) throw error
  }

  const prevLoansById = new Map(prev.loans.map((l) => [l.id, l]))
  const newLoans: Loan[] = []
  const changedLoans: Loan[] = []
  for (const l of next.loans) {
    const p = prevLoansById.get(l.id)
    if (!p) newLoans.push(l)
    else if (p !== l) changedLoans.push(l)
  }
  if (newLoans.length > 0) {
    const { error } = await supabase.from('loans').insert(newLoans.map(loanToRow))
    if (error) throw error
  }
  for (const l of changedLoans) {
    const { error } = await supabase.from('loans').update(loanToRow(l)).eq('id', l.id)
    if (error) throw error
  }

  if (prev.rate !== next.rate) {
    const { error } = await supabase.from('settings').update({ rate: next.rate }).eq('id', 1)
    if (error) throw error
  }
}
