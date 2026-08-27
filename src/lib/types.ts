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

export type LoanStatus = 'pending' | 'accepted' | 'refused' | 'repaid'

export interface Loan {
  id: string
  borrowerId: string
  /** the account asked to fund the loan — only interest-bearing when this is the founder */
  lenderId: string
  principal: number // cents
  rate: number // 0.3333, or 0 when the lender isn't the founder
  interest: number // cents, ceil(principal * rate) — 0 unless lenderId is the founder
  totalDue: number // cents
  repaid: number // cents
  status: LoanStatus
  requestedAt: string // ISO
  respondedAt?: string // ISO — set when accepted or refused
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
