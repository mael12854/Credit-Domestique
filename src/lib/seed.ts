import { BANK_ID, FOUNDER_ID, LOAN_RATE, adjustBalance } from './bank'
import type { Account, BankState } from './types'

const seedAccounts: Account[] = [
  {
    id: FOUNDER_ID,
    role: 'admin',
    holderName: 'MAËL FONDATEUR',
    cardNumber: '4972003188465120',
    cvc: '417',
    expiry: '08/30',
    balance: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'renaud',
    role: 'parent',
    holderName: 'RENAUD · PARENT',
    cardNumber: '4972003188465138',
    cvc: '204',
    expiry: '11/29',
    balance: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'adeline',
    role: 'parent',
    holderName: 'ADELINE · PARENT',
    cardNumber: '4972003188465146',
    cvc: '851',
    expiry: '11/29',
    balance: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'marin',
    role: 'child',
    holderName: 'MARIN · FOYER',
    cardNumber: '4972003188465153',
    cvc: '639',
    expiry: '06/31',
    balance: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'joel',
    role: 'child',
    holderName: 'JOËL · FOYER',
    cardNumber: '4972003188465161',
    cvc: '728',
    expiry: '06/31',
    balance: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'epicerie-du-salon',
    role: 'company',
    holderName: 'ÉPICERIE DU SALON',
    cardNumber: '',
    cvc: '',
    expiry: '',
    balance: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: BANK_ID,
    role: 'bank',
    holderName: 'CRÉDIT DOMESTIQUE',
    cardNumber: '',
    cvc: '',
    expiry: '',
    balance: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

export function createInitialState(): BankState {
  return {
    accounts: seedAccounts,
    entries: [],
    loans: [],
    currentAccountId: null,
    impersonatedBy: null,
    rate: LOAN_RATE,
  }
}

const STARTING_BALANCES: Record<string, number> = {
  [FOUNDER_ID]: 25000,
  renaud: 5000,
  adeline: 5000,
  marin: 5000,
  joel: 5000,
}

/** The state a fresh visit or a demo reset actually starts from: seed accounts, funded via the bank. */
export function createDemoState(): BankState {
  let state = createInitialState()
  for (const [accountId, balance] of Object.entries(STARTING_BALANCES)) {
    state = adjustBalance(state, accountId, balance, 'Solde initial')
  }
  return state
}
