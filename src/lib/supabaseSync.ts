import { supabase } from './supabaseClient'
import type { Account, BankState, Charge, Entry, Loan } from './types'

type SharedState = Pick<BankState, 'accounts' | 'entries' | 'loans' | 'charges' | 'rate'>

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

function rowToCharge(row: any): Charge {
  return {
    id: row.id,
    companyId: row.company_id,
    payerId: row.payer_id,
    amount: row.amount,
    reason: row.reason,
    status: row.status,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at ?? undefined,
  }
}

function chargeToRow(c: Charge) {
  return {
    id: c.id,
    company_id: c.companyId,
    payer_id: c.payerId,
    amount: c.amount,
    reason: c.reason,
    status: c.status,
    requested_at: c.requestedAt,
    responded_at: c.respondedAt ?? null,
  }
}

export async function fetchSharedState(): Promise<SharedState> {
  const [accountsRes, entriesRes, loansRes, chargesRes, settingsRes] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('entries').select('*').order('date').order('id'),
    supabase.from('loans').select('*').order('requested_at'),
    supabase.from('charges').select('*').order('requested_at'),
    supabase.from('settings').select('*').eq('id', 1).single(),
  ])
  if (accountsRes.error) throw accountsRes.error
  if (entriesRes.error) throw entriesRes.error
  if (loansRes.error) throw loansRes.error
  if (chargesRes.error) throw chargesRes.error
  if (settingsRes.error) throw settingsRes.error

  return {
    accounts: accountsRes.data.map(rowToAccount),
    entries: entriesRes.data.map(rowToEntry),
    loans: loansRes.data.map(rowToLoan),
    charges: chargesRes.data.map(rowToCharge),
    rate: Number(settingsRes.data.rate),
  }
}

/**
 * Inserts rows new since `prev` and, when the table allows it, updates rows
 * whose reference changed. bank.ts never mutates in place, so referential
 * inequality reliably marks what's new — no deep diffing needed.
 */
async function syncTable<T extends { id: string }>(
  table: string,
  prevItems: T[],
  nextItems: T[],
  toRow: (item: T) => Record<string, unknown>,
  { updatable = true }: { updatable?: boolean } = {},
): Promise<void> {
  const prevById = new Map(prevItems.map((item) => [item.id, item]))
  const created: T[] = []
  const updated: T[] = []
  for (const item of nextItems) {
    const prevItem = prevById.get(item.id)
    if (!prevItem) created.push(item)
    else if (prevItem !== item) updated.push(item)
  }

  if (created.length > 0) {
    const { error } = await supabase.from(table).insert(created.map(toRow))
    if (error) throw error
  }
  if (updatable) {
    for (const item of updated) {
      const { error } = await supabase.from(table).update(toRow(item)).eq('id', item.id)
      if (error) throw error
    }
  }
}

/**
 * Persists whatever changed between two BankState snapshots — what makes the
 * local optimistic update durable and shared across every device.
 */
export async function pushDiff(prev: BankState, next: BankState): Promise<void> {
  // entries are append-only: no update policy exists for them, matching "nothing is ever deleted"
  await syncTable('entries', prev.entries, next.entries, entryToRow, { updatable: false })
  await syncTable('accounts', prev.accounts, next.accounts, accountToRow)
  await syncTable('loans', prev.loans, next.loans, loanToRow)
  await syncTable('charges', prev.charges, next.charges, chargeToRow)

  if (prev.rate !== next.rate) {
    const { error } = await supabase.from('settings').update({ rate: next.rate }).eq('id', 1)
    if (error) throw error
  }
}
