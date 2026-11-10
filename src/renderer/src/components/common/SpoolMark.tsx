import { useId } from 'react'
import { SPOOL_LOWER, SPOOL_UPPER } from '@shared/spool'

/** Hauteur à partir de laquelle l'invite `>_` gravée dans la flasque reste lisible. */
const PROMPT_MIN_SIZE = 28

export type SpoolMotion = 'intro' | 'loop' | 'none'

/**
 * La bobine de l'icône, d'une seule couleur (`currentColor`) : à côté du message d'accueil et
 * pendant que l'agent travaille (fiche 069). `intro` : le fil s'enroule une fois, puis le curseur
 * clignote ; `loop` : il s'enroule et se déroule tant que l'agent travaille. Chaque tour de fil est
 * révélé par un masque, un trait épais qui suit son milieu (animé en CSS, immobile si l'utilisateur
 * réduit les animations).
 */
export function SpoolMark({
  size,
  motion = 'none',
  className
}: {
  /** Hauteur, en pixels. */
  size: number
  motion?: SpoolMotion
  className?: string
}) {
  // Identifiants des masques propres à chaque bobine (plusieurs à l'écran).
  const id = `spool-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg
      className={`spool-mark spool-${motion}${className ? ` ${className}` : ''}`}
      viewBox="56 49 144 159"
      height={size}
      width={Math.round((size * 144) / 159)}
      aria-hidden
      data-testid="spool-mark"
      data-motion={motion}
    >
      <defs>
        <mask id={`${id}-a`} maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
          <rect x="56" y="55" width="144" height="34.5" fill="#fff" />
          <path
            className="spool-thread spool-thread-1"
            pathLength={100}
            d="M93 84 V103 Q93 111 104 111 L152 114 C170 115 174 126 160 130 L76 150"
            fill="none"
            stroke="#fff"
            strokeWidth={30}
          />
        </mask>
        <mask id={`${id}-b`} maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
          <rect x="56" y="179.5" width="144" height="34" fill="#fff" />
          <path
            className="spool-thread spool-thread-2"
            pathLength={100}
            d="M184 147 L104 163 Q93 166 93 181"
            fill="none"
            stroke="#fff"
            strokeWidth={30}
          />
          {size >= PROMPT_MIN_SIZE && (
            <>
              <path
                d="M111 187 L120 194 L111 201"
                fill="none"
                stroke="#000"
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="spool-cursor"
                d="M130 201 H145"
                stroke="#000"
                strokeWidth={9}
                strokeLinecap="round"
              />
            </>
          )}
        </mask>
      </defs>
      <g transform="translate(0 -6)" fill="currentColor">
        <path mask={`url(#${id}-a)`} d={SPOOL_UPPER} />
        <path mask={`url(#${id}-b)`} d={SPOOL_LOWER} />
      </g>
    </svg>
  )
}

/** Icône de l'app (build/icon.svg sans son ombre), pour Réglages › À propos. */
export function AppIcon({ size }: { size: number }) {
  return (
    <svg
      className="app-icon"
      viewBox="16 16 224 224"
      width={size}
      height={size}
      aria-hidden
      data-testid="app-icon"
    >
      <rect x="16" y="16" width="224" height="224" rx="50" fill="#165C63" />
      <g fill="#F4F0E5" transform="translate(0 -6)">
        <path d={SPOOL_UPPER} />
        <path d={SPOOL_LOWER} />
      </g>
      <path
        d="M111 181 L120 188 L111 195 M130 195 H145"
        fill="none"
        stroke="#165C63"
        strokeWidth={6.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
