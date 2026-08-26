import { describe, expect, it } from 'vitest'
import {
  BANK_ID,
  FOUNDER_ID,
  FOUNDER_INTEREST_LABEL,
  adjustBalance,
  archiveAccount,
  computeInterest,
  computeTotalDue,
  createAccount,
  depositCash,
  formatMoneyFR,
  login,
  openLoan,
  postDoubleEntry,
  repayLoan,
  reverseEntry,
  transfer,
  withdrawCash,
} from '../bank'
import { createInitialState } from '../seed'
import type { BankState } from '../types'

function balanceOf(state: BankState, accountId: string): number {
  return state.accounts.find((a) => a.id === accountId)!.balance
}

describe('computeInterest / computeTotalDue', () => {
  it('is a flat 33.33% of principal, rounded up to the cent', () => {
    // 30 € -> owe 40 €, per the spec's worked example
    expect(computeInterest(3000)).toBe(1000)
    expect(computeTotalDue(3000)).toBe(4000)
  })

  it('rounds up rather than to nearest', () => {
    // 10 € * 33.33% = 333.3 cents -> ceil to 334
    expect(computeInterest(1000)).toBe(334)
  })

  it('never rounds down', () => {
    for (const principal of [1, 7, 99, 12345]) {
      const interest = computeInterest(principal)
      expect(interest).toBeGreaterThanOrEqual(Math.floor(principal * 0.3333))
      expect(Number.isInteger(interest)).toBe(true)
    }
  })
})

describe('formatMoneyFR', () => {
  it('formats with a comma decimal separator and a non-breaking space before €', () => {
    expect(formatMoneyFR(1250)).toBe('12,50 €')
    expect(formatMoneyFR(0)).toBe('0,00 €')
    expect(formatMoneyFR(100000)).toBe('1 000,00 €')
  })

  it('renders negative balances with a leading minus', () => {
    expect(formatMoneyFR(-500)).toBe('-5,00 €')
  })
})

describe('postDoubleEntry', () => {
  it('writes exactly two entries sharing a transactionId, debit + credit', () => {
    const state = createInitialState()
    const { state: next, debitEntry, creditEntry } = postDoubleEntry(state, {
      fromId: BANK_ID,
      toId: 'marin',
      amount: 500,
      label: 'Test',
      kind: 'deposit',
    })
    expect(next.entries).toHaveLength(2)
    expect(debitEntry.transactionId).toBe(creditEntry.transactionId)
    expect(debitEntry.debit).toBe(500)
    expect(debitEntry.credit).toBeNull()
    expect(creditEntry.credit).toBe(500)
    expect(creditEntry.debit).toBeNull()
    expect(balanceOf(next, BANK_ID)).toBe(-500)
    expect(balanceOf(next, 'marin')).toBe(500)
  })

  it('recomputes balanceAfter correctly on both legs', () => {
    const state = createInitialState()
    const step1 = postDoubleEntry(state, {
      fromId: BANK_ID,
      toId: 'marin',
      amount: 1000,
      label: 'a',
      kind: 'deposit',
    }).state
    const step2 = postDoubleEntry(step1, {
      fromId: 'marin',
      toId: 'joel',
      amount: 300,
      label: 'b',
      kind: 'transfer',
    })
    expect(step2.debitEntry.balanceAfter).toBe(700)
    expect(step2.creditEntry.balanceAfter).toBe(300)
  })

  it('rejects a non-positive amount', () => {
    const state = createInitialState()
    expect(() =>
      postDoubleEntry(state, { fromId: BANK_ID, toId: 'marin', amount: 0, label: 'x', kind: 'deposit' }),
    ).toThrow()
    expect(() =>
      postDoubleEntry(state, { fromId: BANK_ID, toId: 'marin', amount: -10, label: 'x', kind: 'deposit' }),
    ).toThrow()
  })
})

describe('depositCash', () => {
  it('credits the holder and debits the bank by the same amount', () => {
    const state = createInitialState()
    const next = depositCash(state, 'marin', 2000)
    expect(balanceOf(next, 'marin')).toBe(2000)
    expect(balanceOf(next, BANK_ID)).toBe(-2000)
  })
})

describe('withdrawCash', () => {
  it('debits the holder and credits the bank by the same amount', () => {
    const state = depositCash(createInitialState(), 'marin', 2000)
    const next = withdrawCash(state, 'marin', 800)
    expect(balanceOf(next, 'marin')).toBe(1200)
    expect(balanceOf(next, BANK_ID)).toBe(-1200)
  })
})

describe('transfer', () => {
  it('moves money between two accounts, balances conserved', () => {
    const state = depositCash(createInitialState(), 'renaud', 5000)
    const next = transfer(state, 'renaud', 'marin', 1200, 'Argent de poche')
    expect(balanceOf(next, 'renaud')).toBe(3800)
    expect(balanceOf(next, 'marin')).toBe(1200)
  })
})

describe('openLoan', () => {
  it('credits the borrower with the principal and the founder with the interest', () => {
    const state = createInitialState()
    const { state: next, loan } = openLoan(state, 'marin', 3000)
    expect(balanceOf(next, 'marin')).toBe(3000)
    expect(balanceOf(next, FOUNDER_ID)).toBe(1000)
    expect(loan.principal).toBe(3000)
    expect(loan.interest).toBe(1000)
    expect(loan.totalDue).toBe(4000)
    expect(loan.repaid).toBe(0)
  })

  it('never credits interest to the bank or a parent', () => {
    const state = createInitialState()
    const { state: next } = openLoan(state, 'marin', 3000)
    expect(balanceOf(next, BANK_ID)).toBe(-4000)
    expect(balanceOf(next, 'renaud')).toBe(0)
    expect(balanceOf(next, 'adeline')).toBe(0)
    const interestEntry = next.entries.find((e) => e.kind === 'interest' && e.credit != null)
    expect(interestEntry?.label).toBe(FOUNDER_INTEREST_LABEL)
    expect(interestEntry?.accountId).toBe(FOUNDER_ID)
  })

  it('rejects a non-positive principal', () => {
    expect(() => openLoan(createInitialState(), 'marin', 0)).toThrow()
  })
})

describe('repayLoan', () => {
  it('debits the borrower and credits the bank, tracking repaid', () => {
    const opened = openLoan(createInitialState(), 'marin', 3000)
    const { state: next, loan } = repayLoan(opened.state, opened.loan.id, 4000)
    expect(loan.repaid).toBe(4000)
    expect(balanceOf(next, 'marin')).toBe(3000 - 4000)
  })

  it('rejects repaying more than what remains due', () => {
    const opened = openLoan(createInitialState(), 'marin', 3000)
    expect(() => repayLoan(opened.state, opened.loan.id, 4001)).toThrow()
  })
})

describe('adjustBalance (admin)', () => {
  it('writes an adjustment entry rather than mutating the balance directly', () => {
    const state = createInitialState()
    const next = adjustBalance(state, 'marin', 1500, 'Correction')
    expect(balanceOf(next, 'marin')).toBe(1500)
    const entry = next.entries.find((e) => e.accountId === 'marin')
    expect(entry?.kind).toBe('adjustment')
    expect(entry?.byAdmin).toBe(true)
  })

  it('is a no-op when the new balance equals the current one', () => {
    const state = createInitialState()
    const next = adjustBalance(state, 'marin', 0)
    expect(next.entries).toHaveLength(0)
  })
})

describe('reverseEntry', () => {
  it('never deletes the original entries, writes an offsetting pair instead', () => {
    const state = depositCash(createInitialState(), 'marin', 2000)
    const original = state.entries.find((e) => e.accountId === 'marin')!
    const next = reverseEntry(state, original.id)
    // original two entries still present, untouched
    expect(next.entries.filter((e) => e.id === original.id)).toHaveLength(1)
    expect(next.entries).toHaveLength(4)
    expect(balanceOf(next, 'marin')).toBe(0)
    expect(balanceOf(next, BANK_ID)).toBe(0)
  })

  it('tags the reversing entry with reversalOf', () => {
    const state = depositCash(createInitialState(), 'marin', 2000)
    const original = state.entries.find((e) => e.accountId === 'marin')!
    const next = reverseEntry(state, original.id)
    const reversal = next.entries.find((e) => e.reversalOf === original.id)
    expect(reversal).toBeDefined()
    expect(reversal?.label).toContain('Annulation')
  })

  it('refuses to reverse the same entry twice', () => {
    const state = depositCash(createInitialState(), 'marin', 2000)
    const original = state.entries.find((e) => e.accountId === 'marin')!
    const next = reverseEntry(state, original.id)
    expect(() => reverseEntry(next, original.id)).toThrow()
  })
})

describe('createAccount / archiveAccount', () => {
  it('creates a new account with an uppercased holder name', () => {
    const state = createInitialState()
    const { state: next, account } = createAccount(state, {
      role: 'company',
      holderName: 'boulangerie du coin',
      cardNumber: '',
      cvc: '',
      expiry: '',
    })
    expect(account.holderName).toBe('BOULANGERIE DU COIN')
    expect(next.accounts).toContainEqual(account)
  })

  it('archives instead of deleting: the account and its history remain', () => {
    const state = depositCash(createInitialState(), 'marin', 500)
    const next = archiveAccount(state, 'marin')
    const marin = next.accounts.find((a) => a.id === 'marin')
    expect(marin?.archived).toBe(true)
    expect(next.entries.some((e) => e.accountId === 'marin')).toBe(true)
  })
})

describe('login', () => {
  it('authenticates with card number + holder name + CVC only', () => {
    const state = createInitialState()
    const account = login(state, '4972 0031 8846 5120', 'maël fondateur', '417')
    expect(account?.id).toBe(FOUNDER_ID)
  })

  it('rejects a wrong CVC', () => {
    const state = createInitialState()
    expect(login(state, '4972003188465120', 'MAËL FONDATEUR', '000')).toBeNull()
  })

  it('rejects an archived account', () => {
    const state = archiveAccount(createInitialState(), 'marin')
    expect(login(state, '4972003188465153', 'MARIN · FOYER', '639')).toBeNull()
  })

  it('never logs into a cardless technical account (bank, company) via blank fields', () => {
    const state = createInitialState()
    expect(login(state, '', 'CRÉDIT DOMESTIQUE', '')).toBeNull()
    expect(login(state, '', 'ÉPICERIE DU SALON', '')).toBeNull()
  })
})
