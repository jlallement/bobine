/**
 * Icône du tour de table (maquettes de la fiche 285) : un cercle et quatre places autour. Dessinée
 * comme les icônes de lucide (trait, `currentColor`), pour se ranger parmi elles.
 */
export function RoundtableIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ? `roundtable-icon ${className}` : 'roundtable-icon'}
    >
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="3.5" r="1.5" />
      <circle cx="12" cy="20.5" r="1.5" />
      <circle cx="3.5" cy="12" r="1.5" />
      <circle cx="20.5" cy="12" r="1.5" />
    </svg>
  )
}
