import { BankCard } from '../components/BankCard'
import { formatMoneyFR } from '../lib/bank'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Compte.css'

export function Compte() {
  const { currentAccount, state } = useBank()
  const { navigate } = useNav()

  if (!currentAccount) return null

  const isOverdrawn = currentAccount.balance < 0
  const isCompanyOrBank = currentAccount.role === 'company' || currentAccount.role === 'bank'
  const loans = state.loans.filter(
    (l) => l.borrowerId === currentAccount.id && l.repaid < l.totalDue,
  )

  return (
    <div className="compte">
      <div className="compte__top">
        <div className="compte__balance-block">
          <p className="eyebrow">Solde disponible</p>
          <p className={`compte__balance amount ${isOverdrawn ? 'amount--debit' : ''}`}>
            {formatMoneyFR(currentAccount.balance)}
          </p>
          {isOverdrawn && <p className="compte__overdrawn">Découvert</p>}
        </div>
        {currentAccount.cardNumber && (
          <div className="compte__card">
            <BankCard account={currentAccount} />
          </div>
        )}
      </div>

      <div className="compte__actions">
        <button className="button button--primary" onClick={() => navigate('depot')}>
          Déposer
        </button>
        <button className="button button--secondary" onClick={() => navigate('virement')}>
          Virer
        </button>
        <button className="button button--secondary" onClick={() => navigate('depot', { mode: 'retrait' })}>
          Retirer
        </button>
        {!isCompanyOrBank && (
          <button className="button button--secondary" onClick={() => navigate('emprunt')}>
            Emprunter
          </button>
        )}
      </div>

      {loans.length > 0 && (
        <div className="panel compte__loans">
          <p className="eyebrow">Encours de prêt</p>
          {loans.map((loan) => (
            <div key={loan.id} className="compte__loan-row">
              <span>
                Capital {formatMoneyFR(loan.principal)} · échéance {formatMoneyFR(loan.totalDue)}
              </span>
              <span className="amount amount--debit">
                Reste dû {formatMoneyFR(loan.totalDue - loan.repaid)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button className="button button--ghost compte__history-link" onClick={() => navigate('historique')}>
        Voir l'historique →
      </button>

      {currentAccount.role === 'parent' && (
        <div className="panel compte__family">
          <p className="eyebrow">Comptes du foyer</p>
          {state.accounts
            .filter((a) => a.id !== currentAccount.id && !a.archived && a.role !== 'bank')
            .map((a) => (
              <button
                key={a.id}
                className="compte__family-row"
                onClick={() => navigate('historique', { accountId: a.id })}
              >
                <span>{a.holderName}</span>
                <span className={`amount ${a.balance < 0 ? 'amount--debit' : 'amount--credit'}`}>
                  {formatMoneyFR(a.balance)}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
