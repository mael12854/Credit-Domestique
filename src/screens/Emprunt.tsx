import { useState } from 'react'
import type { FormEvent } from 'react'
import { FOUNDER_INTEREST_LABEL, computeInterest, computeTotalDue, formatMoneyFR } from '../lib/bank'
import { parseAmountToCents } from '../lib/format'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Forms.css'

export function Emprunt() {
  const { state, currentAccount, openLoan } = useBank()
  const { reset } = useNav()

  const canPickBorrower = currentAccount?.role === 'parent' || currentAccount?.role === 'admin'
  const [borrowerId, setBorrowerId] = useState(currentAccount?.id ?? '')
  const [amountInput, setAmountInput] = useState('')
  const [error, setError] = useState('')

  if (!currentAccount) return null

  const borrowers = state.accounts.filter((a) => a.role === 'child' && !a.archived)
  const borrower = state.accounts.find((a) => a.id === borrowerId) ?? currentAccount
  const principal = parseAmountToCents(amountInput)
  const interest = principal != null ? computeInterest(principal, state.rate) : null
  const totalDue = principal != null ? computeTotalDue(principal, state.rate) : null
  const ratePercent = (state.rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (principal == null || principal <= 0) {
      setError('Montant invalide.')
      return
    }
    setError('')
    openLoan(borrower.id, principal)
    reset('compte')
  }

  return (
    <div className="form-screen">
      <p className="eyebrow">Emprunt</p>
      <h2 className="form-screen__title">Demander un prêt</h2>
      <p className="form-screen__hint">
        Intérêts fixes de {ratePercent}&nbsp;% du capital, arrondis au centime supérieur, versés en
        totalité au fondateur.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {canPickBorrower && (
          <div className="field">
            <label htmlFor="borrower">Emprunteur</label>
            <select id="borrower" value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)}>
              <option value="">Sélectionner un enfant</option>
              {borrowers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.holderName}
                </option>
              ))}
            </select>
          </div>
        )}
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
            <span>Intérêts ({ratePercent}&nbsp;%)</span>
            <span className="amount">{interest != null ? formatMoneyFR(interest) : '—'}</span>
          </div>
          <div className="form-screen__live-row form-screen__live-row--total">
            <span>Total dû</span>
            <span className="amount">{totalDue != null ? formatMoneyFR(totalDue) : '—'}</span>
          </div>
        </div>

        {error && <p className="field-error field-error--top">{error}</p>}
        <button
          type="submit"
          className="button button--primary form-screen__submit"
          disabled={!borrower.id}
        >
          Signer l'emprunt
        </button>
        <p className="form-screen__hint">
          Libellé imposé pour les intérêts : « {FOUNDER_INTEREST_LABEL} »
        </p>
      </form>
    </div>
  )
}
