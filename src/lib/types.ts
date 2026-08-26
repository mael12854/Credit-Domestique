export type Role = 'admin' | 'parent' | 'child' | 'company' | 'bank'

export interface Account {
  id: string
  role: Role
  holderName: string // uppercase, as embossed on the card
  cardNumber: string // 16 digits, fictional, no spaces
  cvc: string // 3 digits
  expiry: string // MM/YY
  balance: number // cents
  createdAt: string // ISO
  archived?: boolean
}

export type EntryKind =
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'loan'
  | 'interest'
  | 'adjustment'

export interface Entry {
  id: string
  accountId: string
  date: string // ISO
  label: string
  kind: EntryKind
  debit: number | null // cents
  credit: number | null // cents
  balanceAfter: number // cents
  counterpartyId: string | null
  byAdmin: boolean
  /** groups the two legs (debit + credit) of one double-entry movement */
  transactionId: string
  /** id of the entry this reverses, if any */
  reversalOf?: string
}

export interface Loan {
  id: string
  borrowerId: string
  principal: number // cents
  rate: number // 0.3333
  interest: number // cents, ceil(principal * rate)
  totalDue: number // cents
  repaid: number // cents
  openedAt: string // ISO
}

export interface BankState {
  accounts: Account[]
  entries: Entry[]
  loans: Loan[]
  currentAccountId: string | null
  /** admin id when impersonating another account, else null */
  impersonatedBy: string | null
  /** loan interest rate, e.g. 0.3333 — only the admin can change it */
  rate: number
}
