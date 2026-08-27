import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ContactlessIcon } from '../components/ContactlessIcon'
import { accountEntries, formatMoneyFR } from '../lib/bank'
import { parseAmountToCents } from '../lib/format'
import { useBank } from '../store/BankProvider'
import './Entreprises.css'
import './Forms.css'

type Mode = 'receive' | 'withdraw' | 'charge'

export function EntrepriseDetail({ companyId }: { companyId: string }) {
  const { state, companyReceive, companyWithdraw, requestCharge } = useBank()
  const [mode, setMode] = useState<Mode | null>(null)
  const [payerId, setPayerId] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [reason, setReason] = useState('')
  const [step, setStep] = useState<'form' | 'recap' | 'waiting'>('form')
  const [error, setError] = useState('')
  const [pendingChargeId, setPendingChargeId] = useState<string | null>(null)

  const company = state.accounts.find((a) => a.id === companyId)
  const entries = useMemo(() => accountEntries(state, companyId), [state, companyId])
  const customers = state.accounts.filter(
    (a) => !a.archived && (a.role === 'admin' || a.role === 'parent' || a.role === 'child'),
  )
  const pendingCharges = state.charges.filter(
    (c) => c.companyId === companyId && c.status === 'pending',
  )

  const pendingCharge = pendingChargeId
    ? state.charges.find((c) => c.id === pendingChargeId)
    : undefined

  // Once the customer responds (accept or refuse), fall back to the action menu.
  useEffect(() => {
    if (pendingCharge && pendingCharge.status !== 'pending') {
      const timeout = setTimeout(() => {
        setMode(null)
        setPendingChargeId(null)
      }, 1800)
      return () => clearTimeout(timeout)
    }
  }, [pendingCharge])

  if (!company) return <p>Entreprise introuvable.</p>

  function openMode(next: Mode) {
    setMode(next)
    setPayerId('')
    setAmountInput('')
    setReason('')
    setError('')
    setStep('form')
  }

  const amount = parseAmountToCents(amountInput)

  function handleContinue(e: FormEvent) {
    e.preventDefault()
    if (mode === 'charge' && !payerId) {
      setError('Choisissez qui débiter.')
      return
    }
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
      setMode(null)
    } else if (mode === 'withdraw') {
      companyWithdraw(companyId, amount, reason.trim())
      setMode(null)
    } else {
      const charge = requestCharge(companyId, payerId, amount, reason.trim())
      setPendingChargeId(charge.id)
      setStep('waiting')
    }
  }

  const payerName = (id: string) => state.accounts.find((a) => a.id === id)?.holderName ?? '—'

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
        <>
          <div className="entreprises__actions">
            <button className="button button--primary" onClick={() => openMode('charge')}>
              Paiement sans contact
            </button>
            <button className="button button--secondary" onClick={() => openMode('receive')}>
              Encaisser
            </button>
            <button className="button button--secondary" onClick={() => openMode('withdraw')}>
              Retirer
            </button>
          </div>

          {pendingCharges.length > 0 && (
            <div className="panel compte__loans">
              <p className="eyebrow">Paiements en attente</p>
              {pendingCharges.map((c) => (
                <div key={c.id} className="compte__loan-row">
                  <span className="entreprises__waiting-row">
                    <ContactlessIcon size={20} />
                    {payerName(c.payerId)} · {c.reason}
                  </span>
                  <span className="amount">{formatMoneyFR(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {mode !== null && step === 'form' && (
        <form className="form-screen" onSubmit={handleContinue} noValidate>
          <h3 className="form-screen__title">
            {mode === 'receive' && 'Encaisser un paiement'}
            {mode === 'withdraw' && "Retirer de l'argent"}
            {mode === 'charge' && 'Débiter un client sans contact'}
          </h3>
          {mode === 'charge' && (
            <div className="field">
              <label htmlFor="payer">Débiter</label>
              <select id="payer" value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                <option value="">Sélectionner un client</option>
                {customers.map((a) => (
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
          <div className="field">
            <label htmlFor="reason">Motif</label>
            <input
              id="reason"
              placeholder={mode === 'receive' ? 'Vente du jour' : mode === 'withdraw' ? 'Achat de fournitures' : 'Bonbons'}
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
              <span>
                {mode === 'receive' && 'Encaissement'}
                {mode === 'withdraw' && 'Retrait'}
                {mode === 'charge' && `Débiter ${payerName(payerId)}`}
              </span>
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
              {mode === 'charge' ? 'Envoyer la demande' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}

      {mode === 'charge' && step === 'waiting' && (
        <div className="panel entreprises__waiting">
          {(!pendingCharge || pendingCharge.status === 'pending') && (
            <>
              <ContactlessIcon size={56} />
              <p className="entreprises__waiting-title">Approchez le téléphone de {payerName(payerId)}</p>
              <p className="entreprises__waiting-hint">
                En attente de confirmation · {formatMoneyFR(amount ?? 0)}
              </p>
            </>
          )}
          {pendingCharge?.status === 'accepted' && (
            <p className="entreprises__waiting-title">Paiement accepté</p>
          )}
          {pendingCharge?.status === 'refused' && (
            <p className="entreprises__waiting-title entreprises__waiting-title--refused">
              Paiement refusé
            </p>
          )}
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
