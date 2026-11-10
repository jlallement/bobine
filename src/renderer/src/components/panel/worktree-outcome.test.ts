import { describe, expect, it } from 'vitest'
import type { WorktreeCycleView } from '@shared/worktree-cycle'
import {
  forgeKey,
  identityKey,
  prVisibility,
  shownOutcome,
  type StoredOutcome
} from './worktree-outcome'

type Info = Pick<WorktreeCycleView, 'path' | 'branch' | 'pr'>
const ready: Info = { path: '/w', branch: 'b', pr: { ok: true, remote: 'origin', noun: 'mr' } }
const down: Info = { ...ready, pr: { ok: false, reason: 'unreachable', noun: 'mr', host: 'gl' } }
const at = (info: Info, conversation = 'c1') =>
  [identityKey(conversation, info), forgeKey(info)] as const

describe('une seule issue dans la barre du worktree (fiche 189, verdict UX et relecture)', () => {
  const posed = (source: 'forge' | 'git', info: Info = ready, reset = 0): StoredOutcome<string> => {
    const [identity, forge] = at(info)
    return { identity, forge, reset, source, value: { kind: 'error', text: 'x' } }
  }

  it('gardée tant que le worktree, l’état de la forge et « Actualiser » sont les mêmes', () => {
    expect(shownOutcome(posed('forge'), ...at(ready), 0)).toEqual({ kind: 'error', text: 'x' })
    // Même état, autre objet (relecture de la vue) : mêmes clés.
    expect(at({ ...ready, pr: { ...ready.pr } })).toEqual(at(ready))
    expect(shownOutcome(null, ...at(ready), 0)).toBeNull()
  })

  it('effacée par « Actualiser » et par un autre worktree, quelle que soit sa source', () => {
    for (const source of ['forge', 'git'] as const) {
      expect(shownOutcome(posed(source), ...at(ready), 1)).toBeNull()
      expect(shownOutcome(posed(source), ...at(ready, 'c2'), 0)).toBeNull()
      expect(shownOutcome(posed(source), ...at({ ...ready, path: '/autre' }), 0)).toBeNull()
      expect(shownOutcome(posed(source), ...at({ ...ready, branch: 'autre' }), 0)).toBeNull()
    }
  })

  it('l’état de la forge change : l’issue de la forge part, celle de git (commit, fusion) reste', () => {
    expect(shownOutcome(posed('forge'), ...at(down), 0)).toBeNull()
    expect(shownOutcome(posed('git'), ...at(down), 0)).toEqual({ kind: 'error', text: 'x' })
    // « Vérification en cours » n'efface rien, dans un sens comme dans l'autre.
    const checking: Info = { ...ready, pr: { ok: false, reason: 'checking' } }
    expect(shownOutcome(posed('forge'), ...at(checking), 0)).toEqual({ kind: 'error', text: 'x' })
    expect(shownOutcome(posed('forge', checking), ...at(ready), 0)).toEqual({
      kind: 'error',
      text: 'x'
    })
    // Un autre hôte injoignable n'est pas le même état.
    expect(forgeKey({ pr: { ok: false, reason: 'unreachable', host: 'a' } })).not.toBe(
      forgeKey({ pr: { ok: false, reason: 'unreachable', host: 'b' } })
    )
  })
})

describe('bouton « Ouvrir une PR / MR » et sa raison (verdict UX)', () => {
  const idle = { open: false, merged: false }
  it('grisé avec la raison quand l’utilisateur peut y remédier', () => {
    for (const why of ['noGh', 'notLogged', 'noTool', 'unreachable', 'certificate']) {
      expect(prVisibility({ ahead: 1 }, why, idle)).toEqual({ button: true, line: true })
    }
  })
  it('vérification en cours : grisé sans ligne ; rien à proposer : sans ligne (bulle)', () => {
    expect(prVisibility({ ahead: 1 }, 'checking', idle)).toEqual({ button: true, line: false })
    expect(prVisibility({ ahead: 0 }, 'nothing', idle)).toEqual({ button: true, line: false })
  })
  it('forge inconnue : pas de bouton, la raison seulement avec des commits à proposer', () => {
    expect(prVisibility({ ahead: 2 }, 'unknownForge', idle)).toEqual({ button: false, line: true })
    expect(prVisibility({ ahead: 0 }, 'unknownForge', idle)).toEqual({ button: false, line: false })
  })
  it('pas de dépôt distant : ni bouton ni raison, même si gh manque', () => {
    expect(prVisibility({ ahead: 1 }, 'noRemote', idle)).toEqual({ button: false, line: false })
    expect(prVisibility({ ahead: 1, noRemote: true }, 'noGh', idle)).toEqual({
      button: false,
      line: false
    })
  })
  it('PR ouverte sans rien à pousser, ou fusionnée : pas de bouton', () => {
    const open = { open: true, merged: false }
    expect(prVisibility({ ahead: 1, unpushed: 0 }, undefined, open)).toEqual({
      button: false,
      line: false
    })
    expect(prVisibility({ ahead: 1, unpushed: 1 }, undefined, open).button).toBe(true)
    expect(prVisibility({ ahead: 0 }, undefined, { open: false, merged: true }).button).toBe(false)
  })
})
