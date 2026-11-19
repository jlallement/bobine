import { describe, expect, it } from 'vitest'
import {
  cueSummary,
  dropKey,
  dropSeen,
  EMPTY_CUE,
  isOnScreen,
  noteTargets,
  settle,
  targetsSignature,
  type CueMemory,
  type CueState,
  type CueTarget
} from './work-cue'

const target = (key: string, state: CueState, itemId = 1): CueTarget => ({
  key,
  itemId,
  label: key,
  state
})
const never = () => false
const always = () => true
/** Nouvel état, puis la revue après le délai (`settle`) : ce que le repère montre. */
const step = (memory: CueMemory, targets: CueTarget[], seen = never) =>
  settle(noteTargets(memory, targets, seen), targets, seen)

describe('repère en bas du fil : logique (fiche 261)', () => {
  it('un travail ouvert pour la première fois déjà fini : rien (on ne sait pas quand)', () => {
    const memory = noteTargets(EMPTY_CUE, [target('ux', 'replied')], never)
    expect(memory.pending).toEqual([])
  })

  it('un travail qui travaillait répond hors de l’écran : revu après le délai, puis dans la file', () => {
    const working = noteTargets(EMPTY_CUE, [target('ux', 'working')], never)
    expect(working.pending).toEqual([])
    const replied = noteTargets(working, [target('ux', 'replied')], never)
    // Pas tout de suite : sa carte peut encore arriver sous les yeux.
    expect(replied.settling).toEqual(['ux'])
    expect(cueSummary(replied, [target('ux', 'replied')])).toBeUndefined()
    const settled = settle(replied, [target('ux', 'replied')], never)
    expect(settled.pending).toEqual(['ux'])
    expect(settled.settling).toEqual([])
    expect(cueSummary(settled, [target('ux', 'replied')])).toMatchObject({
      first: { key: 'ux' },
      count: 1
    })
  })

  it('sa carte arrive sous les yeux pendant le délai (compte rendu en bas) : jamais de repère', () => {
    const working = noteTargets(EMPTY_CUE, [target('ux', 'working', 1)], never)
    const replied = noteTargets(working, [target('ux', 'replied', 1)], never)
    // Le compte rendu (élément 9) est arrivé en bas, à l'écran.
    const report = [target('ux', 'replied', 9)]
    const seen9 = (t: CueTarget) => t.itemId === 9
    expect(settle(noteTargets(replied, report, seen9), report, seen9).pending).toEqual([])
  })

  it('carte à l’écran quand il répond : pas de repère', () => {
    const working = noteTargets(EMPTY_CUE, [target('ux', 'working')], never)
    const next = noteTargets(working, [target('ux', 'replied')], always)
    expect(next.settling).toEqual([])
    expect(next.pending).toEqual([])
  })

  it('« a fini » compte aussi ; arrêté ou en erreur, rien', () => {
    const working = noteTargets(EMPTY_CUE, [target('a', 'working'), target('b', 'working')], never)
    const next = step(working, [target('a', 'finished'), target('b', 'idle')])
    expect(next.pending).toEqual(['a'])
  })

  it('plusieurs : dans l’ordre des réponses, le plus ancien d’abord, et le compte', () => {
    let memory = noteTargets(EMPTY_CUE, [target('a', 'working'), target('b', 'working')], never)
    memory = step(memory, [target('a', 'working'), target('b', 'replied')])
    memory = step(memory, [target('a', 'replied'), target('b', 'replied')])
    expect(memory.pending).toEqual(['b', 'a'])
    expect(cueSummary(memory, [target('a', 'replied'), target('b', 'replied')])).toMatchObject({
      first: { key: 'b' },
      count: 2
    })
  })

  it('vu (défilement) : sort de la file ; le reste y demeure', () => {
    let memory = noteTargets(
      EMPTY_CUE,
      [target('a', 'working', 1), target('b', 'working', 2)],
      never
    )
    const done = [target('a', 'replied', 1), target('b', 'replied', 2)]
    memory = step(memory, done)
    const seenA = (t: CueTarget) => t.key === 'a'
    expect(dropSeen(memory, done, seenA).pending).toEqual(['b'])
    // Rien de vu : le même objet (pas de nouveau rendu).
    expect(dropSeen(memory, done, never)).toBe(memory)
  })

  it('« Voir » retire le travail ; reparti au travail ou disparu : retiré aussi', () => {
    let memory = noteTargets(EMPTY_CUE, [target('a', 'working')], never)
    memory = step(memory, [target('a', 'replied')])
    expect(dropKey(memory, 'a').pending).toEqual([])
    expect(noteTargets(memory, [target('a', 'working')], never).pending).toEqual([])
    expect(noteTargets(memory, [], never).pending).toEqual([])
    expect(dropSeen(memory, [], never).pending).toEqual([])
  })

  it('file inchangée : le même tableau (pas de nouveau rendu)', () => {
    let memory = noteTargets(EMPTY_CUE, [target('a', 'working')], never)
    memory = step(memory, [target('a', 'replied')])
    expect(noteTargets(memory, [target('a', 'replied')], never).pending).toBe(memory.pending)
  })

  it('signature : seuls la clé, la carte et l’état comptent', () => {
    expect(targetsSignature([target('a', 'working', 3)])).toBe(
      targetsSignature([{ ...target('a', 'working', 3), label: 'autre' }])
    )
    expect(targetsSignature([target('a', 'working', 3)])).not.toBe(
      targetsSignature([target('a', 'working', 4)])
    )
  })
})

describe('carte à l’écran (fiche 261)', () => {
  const box = (top: number, bottom: number) =>
    ({ getBoundingClientRect: () => ({ top, bottom, height: bottom - top }) }) as unknown as Element
  const view = box(0, 600)

  it('absente du DOM : pas vue', () => {
    expect(isOnScreen(null, view)).toBe(false)
  })

  it('au-dessus, en dessous, ou à peine entrée : pas vue ; assez à l’écran : vue', () => {
    expect(isOnScreen(box(-300, -10), view)).toBe(false)
    expect(isOnScreen(box(610, 800), view)).toBe(false)
    expect(isOnScreen(box(-200, 10), view)).toBe(false)
    expect(isOnScreen(box(-200, 40), view)).toBe(true)
    expect(isOnScreen(box(100, 300), view)).toBe(true)
  })

  it('petite carte entièrement à l’écran : vue', () => {
    expect(isOnScreen(box(590, 600), view)).toBe(true)
  })
})
