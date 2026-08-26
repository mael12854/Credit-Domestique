import { formatMoneyFR } from '../lib/bank'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Entreprises.css'

export function Entreprises() {
  const { state } = useBank()
  const { navigate } = useNav()

  const companies = state.accounts.filter((a) => a.role === 'company' && !a.archived)

  return (
    <div className="entreprises">
      <p className="eyebrow">Entreprises du foyer</p>
      <h2 className="entreprises__title">Comptes entreprises</h2>

      <div className="entreprises__list">
        {companies.length === 0 && (
          <p className="entreprises__empty">Aucune entreprise pour l'instant.</p>
        )}
        {companies.map((c) => (
          <button
            key={c.id}
            className="panel entreprises__row"
            onClick={() => navigate('entreprise-detail', { companyId: c.id })}
          >
            <span>{c.holderName}</span>
            <span className={`amount ${c.balance < 0 ? 'amount--debit' : 'amount--credit'}`}>
              {formatMoneyFR(c.balance)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
