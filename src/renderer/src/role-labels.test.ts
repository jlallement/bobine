import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { builtinLabels, relabelRoles, useThreadItems } from './role-labels'

const secu = {
  name: 'security-expert',
  label: 'Expert sécurité',
  icon: 'shield',
  color: 'orange' as const
}
const mine = { name: 'mon-role', label: 'Mon rôle', icon: 'bot', color: 'blue' as const }

describe('libellés des rôles fournis dans la langue de l’interface (fiche 272)', () => {
  const labels = builtinLabels([
    { name: 'security-expert', label: 'Security expert', scope: 'builtin' },
    { name: 'mon-role', label: 'My role', scope: 'user' }
  ])
  const items: TranscriptItem[] = [
    {
      kind: 'role-request',
      id: 1,
      requestId: 'r',
      text: 'Avis ?',
      at: 0,
      works: [
        { childId: 'a', role: secu },
        { childId: 'b', role: mine }
      ]
    },
    { kind: 'child-started', id: 2, childId: 'a', title: 'A', prompt: 'Avis ?', role: secu, at: 0 }
  ] as TranscriptItem[]

  it('rôle fourni : le libellé du moment ; rôle personnel : le sien', () => {
    const out = relabelRoles(items, labels)
    const bubble = out[0] as Extract<TranscriptItem, { kind: 'role-request' }>
    expect(bubble.works.map((w) => w.role.label)).toEqual(['Security expert', 'Mon rôle'])
    expect((out[1] as Extract<TranscriptItem, { kind: 'child-started' }>).role?.label).toBe(
      'Security expert'
    )
  })

  it('rien à changer : le même tableau', () => {
    expect(relabelRoles(items, new Map())).toBe(items)
    expect(
      relabelRoles(
        items,
        builtinLabels([{ name: 'security-expert', label: 'Expert sécurité', scope: 'builtin' }])
      )
    ).toBe(items)
  })
})

describe('fil affiché mémoïsé (revue de la fiche 272)', () => {
  it('même fil, même état, mêmes libellés : le même tableau d’un rendu à l’autre', () => {
    // Un libellé à remplacer : sans mémoire, chaque rendu referait un nouveau fil.
    const items = [
      { kind: 'child-started', id: 1, childId: 'a', title: 'A', prompt: 'x', role: secu, at: 0 }
    ] as TranscriptItem[]
    const labels = new Map([['security-expert', 'Security expert']])
    const { result, rerender } = renderHook(
      ({ snapshot }) => useThreadItems(items, snapshot, labels),
      { initialProps: { snapshot: { status: 'ready' as const, blocker: undefined } } }
    )
    const first = result.current
    // Nouvel objet d'état (chaque évènement de l'agent), même contenu : pas de nouveau fil.
    rerender({ snapshot: { status: 'ready' as const, blocker: undefined } })
    expect(result.current).toBe(first)
  })
})
