import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatMoneyFR } from '../lib/bank'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Entreprises.css'

export function Entreprises() {
  const { state, isAdmin, createAccount, archiveAccount } = useBank()
  const { navigate } = useNav()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  const companies = state.accounts.filter((a) => a.role === 'company' && !a.archived)

  if (!isAdmin) {
    return <p className="entreprises__empty">Accès réservé à l'administrateur.</p>
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (newName.trim() === '') {
      setError('Le nom est obligatoire.')
      return
    }
    setError('')
    createAccount({ role: 'company', holderName: newName, cardNumber: '', cvc: '', expiry: '' })
    setNewName('')
  }

  function handleArchive(id: string, holderName: string) {
    if (confirm(`Supprimer l'entreprise « ${holderName} » ? Son historique est conservé.`)) {
      archiveAccount(id)
    }
  }

  return (
    <div className="entreprises">
      <p className="eyebrow">Entreprises du foyer</p>
      <h2 className="entreprises__title">Comptes entreprises</h2>

      <div className="entreprises__list">
        {companies.length === 0 && (
          <p className="entreprises__empty">Aucune entreprise pour l'instant.</p>
        )}
        {companies.map((c) => (
          <div key={c.id} className="panel entreprises__row">
            <button
              className="entreprises__row-link"
              onClick={() => navigate('entreprise-detail', { companyId: c.id })}
            >
              <span>{c.holderName}</span>
              <span className={`amount ${c.balance < 0 ? 'amount--debit' : 'amount--credit'}`}>
                {formatMoneyFR(c.balance)}
              </span>
            </button>
            <button className="button button--ghost" onClick={() => handleArchive(c.id, c.holderName)}>
              Supprimer
            </button>
          </div>
        ))}
      </div>

      <form className="entreprises__create-form" onSubmit={handleCreate}>
        <div className="field">
          <label htmlFor="newCompany">Ajouter une entreprise</label>
          <input
            id="newCompany"
            placeholder="Nom de l'entreprise"
            value={newName}
            onChange={(e) => setNewName(e.target.value.toUpperCase())}
          />
        </div>
        {error && <p className="field-error field-error--top">{error}</p>}
        <button type="submit" className="button button--primary">
          Créer
        </button>
      </form>
    </div>
  )
}
