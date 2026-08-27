import { useState } from 'react'
import type { FormEvent } from 'react'
import { FOUNDER_ID, FOUNDER_INTEREST_LABEL, computeInterest, computeTotalDue, formatMoneyFR } from '../lib/bank'
import { parseAmountToCents } from '../lib/format'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Forms.css'

export function Emprunt() {
  const { state, currentAccount, requestLoan } = useBank()
  const { reset } = useNav()

  const [lenderId, setLenderId] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [error, setError] = useState('')

  if (!currentAccount) return null
  const borrowerId = currentAccount.id

  const lenders = state.accounts.filter(
    (a) => a.id !== currentAccount.id && !a.archived && (a.role === 'admin' || a.role === 'parent' || a.role === 'child'),
  )
  const isFounderLoan = lenderId === FOUNDER_ID
  const principal = parseAmountToCents(amountInput)
  const interest = principal != null && isFounderLoan ? computeInterest(principal, state.rate) : 0
  const totalDue = principal != null ? (isFounderLoan ? computeTotalDue(principal, state.rate) : principal) : null
  const ratePercent = (state.rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!lenderId) {
      setError('Choisissez à qui demander ce prêt.')
      return
    }
    if (principal == null || principal <= 0) {
      setError('Montant invalide.')
      return
    }
    setError('')
    requestLoan(borrowerId, lenderId, principal)
    reset('compte')
  }

  return (
    <div className="form-screen">
      <p className="eyebrow">Emprunt</p>
      <h2 className="form-screen__title">Demander un prêt</h2>
      <p className="form-screen__hint">
        Choisissez à qui demander. Un prêt du fondateur porte des intérêts fixes de {ratePercent}&nbsp;%
        du capital, arrondis au centime supérieur ; un prêt de toute autre personne est sans intérêts.
        La personne sollicitée peut accepter ou refuser votre demande.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="lender">Demander à</label>
          <select id="lender" value={lenderId} onChange={(e) => setLenderId(e.target.value)}>
            <option value="">Sélectionner une personne</option>
            {lenders.map((a) => (
              <option key={a.id} value={a.id}>
                {a.holderName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="principal">Capital emprunté</label>
          <input
            id="principal"
            className="mono"
            inputMode="decimal"
            placeholder="0,00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
        </div>

        <div className="form-screen__live">
          <div className="form-screen__live-row">
            <span>Capital</span>
            <span className="amount">{principal != null ? formatMoneyFR(principal) : '—'}</span>
          </div>
          <div className="form-screen__live-row">
            <span>Intérêts{isFounderLoan ? ` (${ratePercent} %)` : ''}</span>
            <span className="amount">
              {principal == null ? '—' : isFounderLoan ? formatMoneyFR(interest) : 'Sans intérêts'}
            </span>
          </div>
          <div className="form-screen__live-row form-screen__live-row--total">
            <span>Total dû</span>
            <span className="amount">{totalDue != null ? formatMoneyFR(totalDue) : '—'}</span>
          </div>
        </div>

        {error && <p className="field-error field-error--top">{error}</p>}
        <button type="submit" className="button button--primary form-screen__submit">
          Envoyer la demande
        </button>
        {isFounderLoan && (
          <p className="form-screen__hint">
            Libellé imposé pour les intérêts : « {FOUNDER_INTEREST_LABEL} »
          </p>
        )}
      </form>
    </div>
  )
}
