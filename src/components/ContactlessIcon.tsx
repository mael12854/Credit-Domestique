import './ContactlessIcon.css'

/** The universal contactless-payment wave mark, animated as a rippling "tap" signal. */
export function ContactlessIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="contactless-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path className="contactless-icon__ring contactless-icon__ring--1" d="M8 20 A4 4 0 0 1 12 16" />
      <path className="contactless-icon__ring contactless-icon__ring--2" d="M5 20 A7 7 0 0 1 12 13" />
      <path className="contactless-icon__ring contactless-icon__ring--3" d="M2 20 A10 10 0 0 1 12 10" />
    </svg>
  )
}
