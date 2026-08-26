import { useState } from 'react'
import type { FormEvent } from 'react'
import { LegalFooter } from '../components/LegalFooter'
import { formatCardNumber, stripSpaces } from '../lib/format'
import { useBank } from '../store/BankProvider'
import { useNav } from '../store/NavProvider'
import './Connexion.css'

export function Connexion() {
  const { login } = useBank()
  const { reset } = useNav()
  const [cardNumber, setCardNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [cvc, setCvc] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const account = login(stripSpaces(cardNumber), holderName, cvc)
    if (!account) {
      setError(true)
      return
    }
    setError(false)
    reset('compte')
  }

  return (
    <div className="connexion">
      <div className="connexion__panel">
        <div className="connexion__brand">
          <span className="connexion__monogram">CD</span>
          <span className="connexion__name">Crédit Domestique</span>
        </div>
        <p className="eyebrow connexion__eyebrow">Identification titulaire</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className={`field ${error ? 'field--error' : ''}`}>
            <label htmlFor="cardNumber">Numéro de carte</label>
            <input
              id="cardNumber"
              className="mono"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000 0000 0000 0000"
              value={formatCardNumber(cardNumber)}
              onChange={(e) => {
                setCardNumber(stripSpaces(e.target.value))
                setError(false)
              }}
              maxLength={19}
            />
          </div>
          <div className={`field ${error ? 'field--error' : ''}`}>
            <label htmlFor="holderName">Titulaire</label>
            <input
              id="holderName"
              autoComplete="off"
              placeholder="NOM DU TITULAIRE"
              value={holderName}
              onChange={(e) => {
                setHolderName(e.target.value.toUpperCase())
                setError(false)
              }}
            />
          </div>
          <div className={`field ${error ? 'field--error' : ''}`}>
            <label htmlFor="cvc">CVC</label>
            <input
              id="cvc"
              className="mono"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000"
              value={cvc}
              onChange={(e) => {
                setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))
                setError(false)
              }}
              maxLength={3}
            />
          </div>
          {error && (
            <p className="field-error field-error--top">Données de carte non reconnues</p>
          )}
          <button type="submit" className="button button--primary connexion__submit">
            Se connecter
          </button>
        </form>
      </div>
      <div className="connexion__legal">
        <LegalFooter />
      </div>
    </div>
  )
}
