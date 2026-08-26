import { formatCardNumber } from '../lib/format'
import type { Account } from '../lib/types'
import './BankCard.css'

const PRESTIGE_ROLES = new Set(['admin', 'parent'])

interface BankCardProps {
  account: Account
}

export function BankCard({ account }: BankCardProps) {
  const isPrestige = PRESTIGE_ROLES.has(account.role)
  const number = account.cardNumber ? formatCardNumber(account.cardNumber) : '···· ···· ···· ····'

  return (
    <div className={`bank-card ${isPrestige ? 'bank-card--prestige' : 'bank-card--foyer'}`}>
      <div className="bank-card__top">
        <span className="bank-card__brand">CD</span>
        <span className="bank-card__eyebrow">{isPrestige ? 'PRESTIGE' : 'FOYER'}</span>
      </div>
      <div className="bank-card__chip" aria-hidden="true" />
      <div className="bank-card__number mono">{number}</div>
      <div className="bank-card__bottom">
        <span className="bank-card__holder mono">{account.holderName}</span>
        <span className="bank-card__expiry mono">{account.expiry || '··/··'}</span>
      </div>
    </div>
  )
}
