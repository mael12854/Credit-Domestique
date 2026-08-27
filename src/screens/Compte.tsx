import { BankCard } from '../components/BankCard'
import { ContactlessIcon } from '../components/ContactlessIcon'
import { formatMoneyFR } from '../lib/bank'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Compte.css'

export function Compte() {
  const { currentAccount, state, acceptLoan, refuseLoan, repayLoan, acceptCharge, refuseCharge } =
    useBank()
  const { navigate } = useNav()

  if (!currentAccount) return null

  const isOverdrawn = currentAccount.balance < 0
  const isCompanyOrBank = currentAccount.role === 'company' || currentAccount.role === 'bank'

  const holderName = (accountId: string) =>
    state.accounts.find((a) => a.id === accountId)?.holderName ?? '—'

  const incomingCharges = state.charges.filter(
    (c) => c.payerId === currentAccount.id && c.status === 'pending',
  )

  const requestsReceived = state.loans.filter(
    (l) => l.lenderId === currentAccount.id && l.status === 'pending',
  )
  const requestsSent = state.loans.filter(
    (l) => l.borrowerId === currentAccount.id && l.status === 'pending',
  )
  const myOutstandingLoans = state.loans.filter(
    (l) => l.borrowerId === currentAccount.id && l.status === 'accepted',
  )
  const loansGranted = state.loans.filter(
    (l) => l.lenderId === currentAccount.id && l.status === 'accepted',
  )

  function handleRepay(loanId: string, totalDue: number, lenderId: string) {
    if (confirm(`Rembourser ${formatMoneyFR(totalDue)} à ${holderName(lenderId)} ?`)) {
      repayLoan(loanId)
    }
  }

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

      {incomingCharges.map((charge) => (
        <div key={charge.id} className="panel compte__charge-prompt">
          <ContactlessIcon size={48} />
          <p className="compte__charge-title">
            {holderName(charge.companyId)} demande {formatMoneyFR(charge.amount)}
          </p>
          <p className="compte__charge-reason">{charge.reason}</p>
          <div className="compte__charge-actions">
            <button className="button button--secondary" onClick={() => refuseCharge(charge.id)}>
              Refuser
            </button>
            <button className="button button--primary" onClick={() => acceptCharge(charge.id)}>
              Payer sans contact
            </button>
          </div>
        </div>
      ))}

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

      {requestsReceived.length > 0 && (
        <div className="panel compte__loans">
          <p className="eyebrow">Demandes de prêt reçues</p>
          {requestsReceived.map((loan) => (
            <div key={loan.id} className="compte__loan-row">
              <span>
                {holderName(loan.borrowerId)} · {formatMoneyFR(loan.principal)}
                {loan.interest > 0 && ` (+ ${formatMoneyFR(loan.interest)} d'intérêts)`}
              </span>
              <span className="compte__loan-actions">
                <button className="button button--ghost" onClick={() => acceptLoan(loan.id)}>
                  Accepter
                </button>
                <button className="button button--ghost" onClick={() => refuseLoan(loan.id)}>
                  Refuser
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {requestsSent.length > 0 && (
        <div className="panel compte__loans">
          <p className="eyebrow">Mes demandes en attente</p>
          {requestsSent.map((loan) => (
            <div key={loan.id} className="compte__loan-row">
              <span>
                À {holderName(loan.lenderId)} · {formatMoneyFR(loan.principal)}
              </span>
              <span className="compte__loan-pending">En attente</span>
            </div>
          ))}
        </div>
      )}

      {myOutstandingLoans.length > 0 && (
        <div className="panel compte__loans">
          <p className="eyebrow">Encours de prêt</p>
          {myOutstandingLoans.map((loan) => (
            <div key={loan.id} className="compte__loan-row">
              <span>
                {holderName(loan.lenderId)} · capital {formatMoneyFR(loan.principal)}
                {loan.interest > 0 && ` · intérêts ${formatMoneyFR(loan.interest)}`}
              </span>
              <span className="compte__loan-actions">
                <span className="amount amount--debit">Dû {formatMoneyFR(loan.totalDue)}</span>
                <button
                  className="button button--ghost"
                  onClick={() => handleRepay(loan.id, loan.totalDue, loan.lenderId)}
                >
                  Rembourser
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {loansGranted.length > 0 && (
        <div className="panel compte__loans">
          <p className="eyebrow">Prêts que vous avez accordés</p>
          {loansGranted.map((loan) => (
            <div key={loan.id} className="compte__loan-row">
              <span>{holderName(loan.borrowerId)}</span>
              <span className="amount amount--credit">On vous doit {formatMoneyFR(loan.totalDue)}</span>
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
