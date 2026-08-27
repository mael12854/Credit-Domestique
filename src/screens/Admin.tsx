import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatMoneyFR } from '../lib/bank'
import { parseAmountToCents, stripSpaces } from '../lib/format'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import type { Role } from '../lib/types'
import './Admin.css'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  parent: 'Parent',
  child: 'Enfant',
  company: 'Entreprise',
  bank: 'Banque',
}

export function Admin() {
  const { state, adjustBalance, archiveAccount, impersonate, createAccount, setLoanRate } = useBank()
  const { navigate } = useNav()
  const [rateInput, setRateInput] = useState(String(state.rate * 100).replace('.', ','))

  const [newRole, setNewRole] = useState<Role>('child')
  const [newHolder, setNewHolder] = useState('')
  const [newCard, setNewCard] = useState('')
  const [newCvc, setNewCvc] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [createError, setCreateError] = useState('')

  function handleAdjust(accountId: string, currentBalance: number) {
    const raw = prompt(
      'Nouveau solde (€) :',
      (currentBalance / 100).toString().replace('.', ','),
    )
    if (raw == null) return
    const cents = parseAmountToCents(raw)
    if (cents == null) {
      alert('Montant invalide.')
      return
    }
    adjustBalance(accountId, cents, 'Ajustement administrateur')
  }

  function handleArchive(accountId: string, holderName: string) {
    if (confirm(`Supprimer le compte « ${holderName} » ? Son historique est conservé.`)) {
      archiveAccount(accountId)
    }
  }

  function handleImpersonate(accountId: string) {
    impersonate(accountId)
    navigate('compte')
  }

  function handleRateSubmit(e: FormEvent) {
    e.preventDefault()
    const normalized = rateInput.trim().replace(',', '.').replace('%', '')
    const value = parseFloat(normalized)
    if (Number.isNaN(value) || value < 0) return
    setLoanRate(value / 100)
  }

  function handleCreateAccount(e: FormEvent) {
    e.preventDefault()
    if (newHolder.trim() === '') {
      setCreateError('Le nom du titulaire est obligatoire.')
      return
    }
    const needsCard = newRole === 'admin' || newRole === 'parent' || newRole === 'child'
    if (needsCard && (stripSpaces(newCard).length !== 16 || newCvc.length !== 3 || newExpiry === '')) {
      setCreateError('Carte, CVC (3 chiffres) et expiration requis pour ce rôle.')
      return
    }
    setCreateError('')
    createAccount({
      role: newRole,
      holderName: newHolder,
      cardNumber: stripSpaces(newCard),
      cvc: newCvc,
      expiry: newExpiry,
    })
    setNewHolder('')
    setNewCard('')
    setNewCvc('')
    setNewExpiry('')
  }

  return (
    <div className="admin">
      <p className="eyebrow">Administration</p>
      <h2 className="admin__title">
        Accès total <span aria-hidden="true">👑</span>
      </h2>

      <section className="admin__section">
        <p className="eyebrow">Taux du prêt</p>
        <form className="admin__rate-form" onSubmit={handleRateSubmit}>
          <input
            className="mono"
            inputMode="decimal"
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
          />
          <span>%</span>
          <button type="submit" className="button button--secondary">
            Appliquer
          </button>
        </form>
      </section>

      <section className="admin__section">
        <p className="eyebrow">Comptes</p>
        <div className="admin__grid">
          {state.accounts.map((a) => (
            <div key={a.id} className={`panel admin__account ${a.archived ? 'admin__account--archived' : ''}`}>
              <div className="admin__account-head">
                <span>{a.holderName}</span>
                <span className="admin__role">{ROLE_LABELS[a.role]}</span>
              </div>
              <p className={`amount admin__balance ${a.balance < 0 ? 'amount--debit' : ''}`}>
                {formatMoneyFR(a.balance)}
              </p>
              <div className="admin__account-actions">
                <button
                  className="button button--ghost"
                  onClick={() => navigate('historique', { accountId: a.id })}
                >
                  Historique
                </button>
                <button className="button button--ghost" onClick={() => handleAdjust(a.id, a.balance)}>
                  Ajuster
                </button>
                {a.role !== 'bank' && a.role !== 'admin' && (
                  <button className="button button--ghost" onClick={() => handleImpersonate(a.id)}>
                    Se connecter en tant que
                  </button>
                )}
                {a.role !== 'bank' && !a.archived && (
                  <button className="button button--ghost" onClick={() => handleArchive(a.id, a.holderName)}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin__section">
        <p className="eyebrow">Créer un compte</p>
        <form className="admin__create-form" onSubmit={handleCreateAccount}>
          <div className="field">
            <label htmlFor="role">Rôle</label>
            <select id="role" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
              <option value="child">Enfant</option>
              <option value="parent">Parent</option>
              <option value="company">Entreprise</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="newHolder">Titulaire</label>
            <input
              id="newHolder"
              value={newHolder}
              onChange={(e) => setNewHolder(e.target.value.toUpperCase())}
            />
          </div>
          {newRole !== 'company' && (
            <>
              <div className="field">
                <label htmlFor="newCard">Numéro de carte</label>
                <input
                  id="newCard"
                  className="mono"
                  inputMode="numeric"
                  value={newCard}
                  onChange={(e) => setNewCard(e.target.value.replace(/\D/g, '').slice(0, 16))}
                />
              </div>
              <div className="admin__create-row">
                <div className="field">
                  <label htmlFor="newCvc">CVC</label>
                  <input
                    id="newCvc"
                    className="mono"
                    inputMode="numeric"
                    value={newCvc}
                    onChange={(e) => setNewCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="newExpiry">Expiration</label>
                  <input
                    id="newExpiry"
                    className="mono"
                    placeholder="MM/AA"
                    value={newExpiry}
                    onChange={(e) => setNewExpiry(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
          {createError && <p className="field-error field-error--top">{createError}</p>}
          <button type="submit" className="button button--primary">
            Créer le compte
          </button>
        </form>
      </section>
    </div>
  )
}
