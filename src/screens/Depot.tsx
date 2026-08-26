import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatMoneyFR } from '../lib/bank'
import { parseAmountToCents } from '../lib/format'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Forms.css'

export function Depot() {
  const { state, currentAccount, depositCash, withdrawCash } = useBank()
  const { current, reset } = useNav()
  const isWithdrawal = current.params?.mode === 'retrait'

  const canPickHolder = currentAccount?.role === 'parent' || currentAccount?.role === 'admin'
  const [holderId, setHolderId] = useState(currentAccount?.id ?? '')
  const [amountInput, setAmountInput] = useState('')
  const [step, setStep] = useState<'form' | 'recap'>('form')
  const [error, setError] = useState('')

  if (!currentAccount) return null

  const holders = state.accounts.filter(
    (a) => !a.archived && (a.role === 'admin' || a.role === 'parent' || a.role === 'child'),
  )
  const holder = state.accounts.find((a) => a.id === holderId) ?? currentAccount
  const amount = parseAmountToCents(amountInput)

  function handleContinue(e: FormEvent) {
    e.preventDefault()
    if (amount == null || amount <= 0) {
      setError('Montant invalide.')
      return
    }
    setError('')
    setStep('recap')
  }

  function handleConfirm() {
    if (amount == null) return
    if (isWithdrawal) {
      withdrawCash(holder.id, amount)
    } else {
      depositCash(holder.id, amount)
    }
    reset('compte')
  }

  const title = isWithdrawal ? 'Retrait d’espèces' : 'Dépôt d’espèces'
  const hint = isWithdrawal
    ? 'La banque reprend des espèces au titulaire : son compte est débité, « Crédit Domestique » est crédité.'
    : 'Je donne des espèces à la banque : le titulaire est crédité, « Crédit Domestique » est débité du même montant.'

  if (step === 'recap' && amount != null) {
    return (
      <div className="form-screen">
        <p className="eyebrow">{isWithdrawal ? 'Retrait' : 'Dépôt'} · confirmation</p>
        <h2 className="form-screen__title">Vérifiez l'opération</h2>
        <div className="panel form-screen__recap">
          <div className="form-screen__recap-row">
            <span>Titulaire</span>
            <span>{holder.holderName}</span>
          </div>
          <div className="form-screen__recap-row">
            <span>Libellé</span>
            <span>{isWithdrawal ? 'Retrait espèces · tirelire' : 'Dépôt espèces · tirelire'}</span>
          </div>
          <div className="form-screen__recap-row form-screen__recap-row--amount">
            <span>Montant</span>
            <span className="amount">{formatMoneyFR(amount)}</span>
          </div>
        </div>
        <div className="form-screen__actions">
          <button className="button button--secondary" onClick={() => setStep('form')}>
            Modifier
          </button>
          <button className="button button--primary" onClick={handleConfirm}>
            Confirmer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="form-screen">
      <p className="eyebrow">{isWithdrawal ? 'Retrait' : 'Dépôt'} d'espèces</p>
      <h2 className="form-screen__title">{title}</h2>
      <p className="form-screen__hint">{hint}</p>

      <form onSubmit={handleContinue} noValidate>
        {canPickHolder && (
          <div className="field">
            <label htmlFor="holder">Titulaire</label>
            <select id="holder" value={holderId} onChange={(e) => setHolderId(e.target.value)}>
              {holders.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.holderName}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="amount">Montant</label>
          <input
            id="amount"
            className="mono"
            inputMode="decimal"
            placeholder="0,00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
        </div>
        {error && <p className="field-error field-error--top">{error}</p>}
        <button type="submit" className="button button--primary form-screen__submit">
          Continuer
        </button>
      </form>
    </div>
  )
}
