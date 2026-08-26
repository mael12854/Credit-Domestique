import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatMoneyFR } from '../lib/bank'
import { parseAmountToCents } from '../lib/format'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Forms.css'

export function Virement() {
  const { state, currentAccount, transfer } = useBank()
  const { reset } = useNav()
  const [beneficiaryId, setBeneficiaryId] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [label, setLabel] = useState('')
  const [step, setStep] = useState<'form' | 'recap'>('form')
  const [error, setError] = useState('')

  if (!currentAccount) return null
  const fromId = currentAccount.id

  const beneficiaries = state.accounts.filter(
    (a) => a.id !== currentAccount.id && !a.archived && a.role !== 'bank',
  )
  const beneficiary = state.accounts.find((a) => a.id === beneficiaryId)
  const amount = parseAmountToCents(amountInput)
  const finalLabel = label.trim() || 'Virement interne'

  function handleContinue(e: FormEvent) {
    e.preventDefault()
    if (!beneficiaryId) {
      setError('Choisissez un bénéficiaire.')
      return
    }
    if (amount == null || amount <= 0) {
      setError('Montant invalide.')
      return
    }
    setError('')
    setStep('recap')
  }

  function handleConfirm() {
    if (!beneficiaryId || amount == null) return
    transfer(fromId, beneficiaryId, amount, finalLabel)
    reset('compte')
  }

  if (step === 'recap' && beneficiary && amount != null) {
    return (
      <div className="form-screen">
        <p className="eyebrow">Virement · confirmation</p>
        <h2 className="form-screen__title">Vérifiez l'opération</h2>

        <div className="panel form-screen__recap">
          <div className="form-screen__recap-row">
            <span>Bénéficiaire</span>
            <span>{beneficiary.holderName}</span>
          </div>
          <div className="form-screen__recap-row">
            <span>Libellé</span>
            <span>{finalLabel}</span>
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
            Confirmer le virement
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="form-screen">
      <p className="eyebrow">Virement</p>
      <h2 className="form-screen__title">Virer de l'argent</h2>

      <form onSubmit={handleContinue} noValidate>
        <div className="field">
          <label htmlFor="beneficiary">Bénéficiaire</label>
          <select
            id="beneficiary"
            value={beneficiaryId}
            onChange={(e) => setBeneficiaryId(e.target.value)}
          >
            <option value="">Sélectionner un compte</option>
            {beneficiaries.map((a) => (
              <option key={a.id} value={a.id}>
                {a.holderName}
              </option>
            ))}
          </select>
        </div>
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
        <div className="field">
          <label htmlFor="label">Libellé</label>
          <input
            id="label"
            placeholder="Virement interne"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
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
