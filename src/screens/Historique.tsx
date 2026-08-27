import { useMemo, useState } from 'react'
import { accountEntries, formatMoneyFR } from '../lib/bank'
import type { EntryKind } from '../lib/types'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Historique.css'

const KIND_LABELS: Record<EntryKind, string> = {
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
  transfer: 'Virement',
  loan: 'Emprunt',
  interest: 'Intérêts',
  adjustment: 'Ajustement',
  payment: 'Paiement',
}

const FILTERS: Array<{ value: EntryKind | 'all'; label: string }> = [
  { value: 'all', label: 'Tout' },
  { value: 'deposit', label: 'Dépôts' },
  { value: 'withdrawal', label: 'Retraits' },
  { value: 'transfer', label: 'Virements' },
  { value: 'loan', label: 'Emprunts' },
  { value: 'interest', label: 'Intérêts' },
  { value: 'adjustment', label: 'Ajustements' },
  { value: 'payment', label: 'Paiements' },
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function Historique() {
  const { state, currentAccount, isAdmin, reverseEntry } = useBank()
  const { current } = useNav()
  const [filter, setFilter] = useState<EntryKind | 'all'>('all')

  const requestedAccountId = current.params?.accountId
  const canViewOthers = isAdmin
  const accountId =
    requestedAccountId && canViewOthers ? requestedAccountId : currentAccount?.id ?? ''
  const account = state.accounts.find((a) => a.id === accountId)

  const entries = useMemo(() => accountEntries(state, accountId), [state, accountId])
  const filtered = filter === 'all' ? entries : entries.filter((e) => e.kind === filter)

  if (!account) return null

  const counterpartyName = (counterpartyId: string | null) =>
    state.accounts.find((a) => a.id === counterpartyId)?.holderName ?? '—'

  return (
    <div className="historique">
      <div className="historique__header">
        <p className="eyebrow">Relevé</p>
        <h2 className="historique__title">{account.holderName}</h2>
      </div>

      <div className="historique__filters">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`historique__filter ${filter === f.value ? 'historique__filter--active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="historique__table-wrap">
        <table className="historique__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Libellé</th>
              <th className="historique__num">Débit</th>
              <th className="historique__num">Crédit</th>
              <th className="historique__num">Solde</th>
              {isAdmin && <th className="historique__num"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="historique__empty">
                  Aucune écriture.
                </td>
              </tr>
            )}
            {filtered.map((entry) => {
              const isReversed = state.entries.some((e) => e.reversalOf === entry.id)
              return (
                <tr key={entry.id}>
                  <td className="mono">{formatDate(entry.date)}</td>
                  <td>
                    {entry.label}
                    <span className="historique__kind"> · {KIND_LABELS[entry.kind]}</span>
                    {entry.reversalOf && <span className="historique__tag">annulation</span>}
                    {isReversed && <span className="historique__tag">annulée</span>}
                    {entry.counterpartyId && (
                      <div className="historique__counterparty">
                        {entry.debit != null ? 'Vers ' : 'De '}
                        {counterpartyName(entry.counterpartyId)}
                      </div>
                    )}
                  </td>
                  <td className="historique__num amount amount--debit">
                    {entry.debit != null ? formatMoneyFR(entry.debit) : <span className="historique__dash">—</span>}
                  </td>
                  <td className="historique__num amount amount--credit">
                    {entry.credit != null ? formatMoneyFR(entry.credit) : <span className="historique__dash">—</span>}
                  </td>
                  <td className="historique__num amount">{formatMoneyFR(entry.balanceAfter)}</td>
                  {isAdmin && (
                    <td className="historique__num">
                      {!entry.reversalOf && !isReversed && (
                        <button
                          className="button button--ghost historique__reverse"
                          onClick={() => {
                            if (confirm(`Annuler l'écriture « ${entry.label} » ?`)) {
                              reverseEntry(entry.id)
                            }
                          }}
                        >
                          Annuler
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={isAdmin ? 4 : 3}>Solde arrêté</td>
              <td className={`historique__num amount ${account.balance < 0 ? 'amount--debit' : ''}`}>
                {formatMoneyFR(account.balance)}
              </td>
              {isAdmin && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
