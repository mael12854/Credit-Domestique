import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './AppHeader.css'

export function AppHeader() {
  const { currentAccount, adminAccount, isAdmin, logout, stopImpersonating } = useBank()
  const { canGoBack, back, navigate, current } = useNav()

  if (!currentAccount) return null

  const isImpersonating = Boolean(adminAccount)

  return (
    <header className={`app-header ${isAdmin ? 'app-header--admin' : ''}`}>
      <div className="app-header__left">
        {canGoBack && (
          <button className="app-header__back" onClick={back} aria-label="Retour">
            ←
          </button>
        )}
        <span className="app-header__brand">Crédit Domestique</span>
      </div>
      <div className="app-header__right">
        {isAdmin && current.screen !== 'entreprises' && current.screen !== 'entreprise-detail' && (
          <button className="app-header__link" onClick={() => navigate('entreprises')}>
            Entreprises
          </button>
        )}
        {currentAccount.role === 'admin' && current.screen !== 'admin' && (
          <button className="app-header__link" onClick={() => navigate('admin')}>
            Admin
          </button>
        )}
        <span className="app-header__holder">
          {currentAccount.holderName}
          {currentAccount.role === 'admin' && (
            <span className="app-header__crown" aria-hidden="true">
              {' '}
              👑
            </span>
          )}
        </span>
        {isImpersonating && (
          <button className="app-header__link" onClick={stopImpersonating}>
            Quitter l'identité
          </button>
        )}
        <button className="app-header__link" onClick={logout}>
          Se déconnecter
        </button>
      </div>
    </header>
  )
}
