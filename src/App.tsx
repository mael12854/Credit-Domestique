import { AppHeader } from './components/AppHeader'
import { LegalFooter } from './components/LegalFooter'
import { Admin } from './screens/Admin'
import { Compte } from './screens/Compte'
import { Connexion } from './screens/Connexion'
import { Depot } from './screens/Depot'
import { Emprunt } from './screens/Emprunt'
import { EntrepriseDetail } from './screens/EntrepriseDetail'
import { Entreprises } from './screens/Entreprises'
import { Historique } from './screens/Historique'
import { Virement } from './screens/Virement'
import { BankProvider, useBank } from './store/BankProvider'
import { NavProvider, useNav } from './store/NavProvider'

function Screens() {
  const { currentAccount } = useBank()
  const { current } = useNav()

  if (!currentAccount) return <Connexion />

  const screen = (() => {
    switch (current.screen) {
      case 'compte':
        return <Compte />
      case 'historique':
        return <Historique />
      case 'virement':
        return <Virement />
      case 'depot':
        return <Depot />
      case 'emprunt':
        return <Emprunt />
      case 'entreprises':
        return <Entreprises />
      case 'entreprise-detail':
        return <EntrepriseDetail companyId={current.params?.companyId ?? ''} />
      case 'admin':
        return <Admin />
      default:
        return <Compte />
    }
  })()

  return (
    <>
      <AppHeader />
      <main className="app-main">{screen}</main>
      <LegalFooter />
    </>
  )
}

function App() {
  return (
    <BankProvider>
      <NavProvider>
        <Screens />
      </NavProvider>
    </BankProvider>
  )
}

export default App
