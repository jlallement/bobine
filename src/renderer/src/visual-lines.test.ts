import { describe, expect, it } from 'vitest'
import { endOfFirstLine, onFirstLine, onLastLine, type CaretTop } from './visual-lines'

/**
 * Mise en page simulée (jsdom n'en fait pas) : des lignes de `width` caractères au plus, repliées
 * au dernier espace comme un navigateur ; une position en début de ligne repliée est sur la
 * ligne suivante (comme le curseur d'un `textarea`). Hauteur de ligne : 20 px.
 */
function layout(text: string, width: number): CaretTop {
  const starts: number[] = [0]
  let lineStart = 0
  let lastSpace = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\n') {
      lineStart = i + 1
      lastSpace = -1
      starts.push(lineStart)
      continue
    }
    if (c === ' ') lastSpace = i
    if (i - lineStart >= width) {
      lineStart = lastSpace > lineStart ? lastSpace + 1 : i
      lastSpace = -1
      starts.push(lineStart)
    }
  }
  return (position) => (starts.filter((s) => s <= position).length - 1) * 20
}

// Maquette, planche 5 : 3 lignes réelles, 4 affichées (la 2e se replie).
const plan = [
  'Plan pour le paiement :',
  '1. createPaymentIntent côté serveur, avec un identifiant pour ne jamais débiter deux fois.',
  '2. Montre-moi le diff.'
].join('\n')

describe('lignes affichées (fiche 227)', () => {
  const topOf = layout(plan, 60)

  it('la ligne repliée compte pour deux : première, milieu, dernière', () => {
    const second = plan.indexOf('1.')
    const wrapped = plan.indexOf('jamais')
    const last = plan.indexOf('2.')
    expect(topOf(wrapped)).toBe(40)
    expect(onFirstLine(5, topOf)).toBe(true)
    expect(onFirstLine(second, topOf)).toBe(false)
    expect(onLastLine(wrapped, plan.length, topOf)).toBe(false)
    expect(onLastLine(last, plan.length, topOf)).toBe(true)
    expect(onLastLine(plan.length, plan.length, topOf)).toBe(true)
  })

  it('fin de la première ligne affichée : avant le retour à la ligne, ou avant le repli', () => {
    expect(endOfFirstLine(plan.length, topOf)).toBe(plan.indexOf('\n'))
    // Une seule ligne réelle, repliée : avant l'espace où elle se replie.
    const long = 'relis le diff du paiement et dis-moi tout ce qui touche au jeton de la carte'
    const wrapAt = layout(long, 40)
    const end = endOfFirstLine(long.length, wrapAt)
    expect(wrapAt(end)).toBe(0)
    expect(wrapAt(end + 1)).toBe(20)
    expect(long[end]).toBe(' ')
  })

  it('message d’une ligne : fin du texte ; texte vide : 0', () => {
    expect(endOfFirstLine(12, layout('continue, oui', 60))).toBe(12)
    expect(endOfFirstLine(0, layout('', 60))).toBe(0)
  })
})
