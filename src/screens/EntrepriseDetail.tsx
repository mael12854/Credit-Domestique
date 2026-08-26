import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { accountEntries, formatMoneyFR } from '../lib/bank'
import { parseAmountToCents } from '../lib/format'
import { useBank } from '../store/BankProvider'
import './Entreprises.css'
import './Forms.css'

type Mode = 'receive' | 'withdraw'

export function EntrepriseDetail({ companyId }: { companyId: string }) {
  const { state, companyReceive, companyWithdraw } = useBank()
  const [mode, setMode] = useState<Mode | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [reason, setReason] = useState('')
  const [step, setStep] = useState<'form' | 'recap'>('form')
  const [error, setError] = useState('')

  const company = state.accounts.find((a) => a.id === companyId)
  const entries = useMemo(() => accountEntries(state, companyId), [state, companyId])

  if (!company) return <p>Entreprise introuvable.</p>

  function openMode(next: Mode) {
    setMode(next)
    setAmountInput('')
    setReason('')
    setError('')
    setStep('form')
  }

  const amount = parseAmountToCents(amountInput)

  function handleContinue(e: FormEvent) {
    e.preventDefault()
    if (amount == null || amount <= 0) {
      setError('Montant invalide.')
      return
    }
    if (reason.trim() === '') {
      setError('Indiquez un motif.')
      return
    }
    setError('')
    setStep('recap')
  }

  function handleConfirm() {
    if (amount == null || !mode) return
    if (mode === 'receive') {
      companyReceive(companyId, amount, reason.trim())
    } else {
      companyWithdraw(companyId, amount, reason.trim())
    }
    setMode(null)
  }

  return (
    <div className="entreprises">
      <p className="eyebrow">Entreprise</p>
      <h2 className="entreprises__title">{company.holderName}</h2>

      <div className="panel">
        <p className="eyebrow">Solde</p>
        <p className={`amount entreprises__balance ${company.balance < 0 ? 'amount--debit' : ''}`}>
          {formatMoneyFR(company.balance)}
        </p>
      </div>

      {mode === null && (
        <div className="entreprises__actions">
          <button className="button button--primary" onClick={() => openMode('receive')}>
            Encaisser
          </button>
          <button className="button button--secondary" onClick={() => openMode('withdraw')}>
            Retirer
          </button>
        </div>
      )}

      {mode !== null && step === 'form' && (
        <form className="form-screen" onSubmit={handleContinue} noValidate>
          <h3 className="form-screen__title">
            {mode === 'receive' ? 'Encaisser un paiement' : 'Retirer de l\'argent'}
          </h3>
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
            <label htmlFor="reason">Motif</label>
            <input
              id="reason"
              placeholder={mode === 'receive' ? 'Vente du jour' : 'Achat de fournitures'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && <p className="field-error field-error--top">{error}</p>}
          <div className="form-screen__actions">
            <button type="button" className="button button--secondary" onClick={() => setMode(null)}>
              Annuler
            </button>
            <button type="submit" className="button button--primary">
              Continuer
            </button>
          </div>
        </form>
      )}

      {mode !== null && step === 'recap' && amount != null && (
        <div className="form-screen">
          <div className="panel form-screen__recap">
            <div className="form-screen__recap-row">
              <span>Opération</span>
              <span>{mode === 'receive' ? 'Encaissement' : 'Retrait'}</span>
            </div>
            <div className="form-screen__recap-row">
              <span>Motif</span>
              <span>{reason}</span>
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
      )}

      <div>
        <p className="eyebrow entreprises__section-title">Historique</p>
        <div className="entreprises__list">
          {entries.length === 0 && <p className="entreprises__empty">Aucune écriture.</p>}
          {entries.map((entry) => (
            <div key={entry.id} className="panel entreprises__entry">
              <span>{entry.label}</span>
              <span className={`amount ${entry.debit != null ? 'amount--debit' : 'amount--credit'}`}>
                {entry.debit != null ? '-' : '+'}
                {formatMoneyFR(entry.debit ?? entry.credit ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
