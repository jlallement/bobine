/**
 * Vocabulaire unique du travail délégué (fiche 266, règle 1 de la fiche 260) : ce qu'on confie est
 * un **travail** (« task »), fait par un rôle ou un autre agent, qui rend une **réponse**. Les mots
 * d'avant (« conversation fille », « sous-tâche », « compte rendu », « tâches proposées »,
 * « conversation mère », « a fini son tour »…) ne reparaissent ni dans l'interface ni dans le guide.
 *
 * Exclusions, et pourquoi :
 * - les mots-clés de la recherche des réglages (`settingsSearch.*`) : jamais affichés, ils gardent
 *   les anciens mots en synonymes pour qui les tape encore ;
 * - `approvalRules.page.group.subtask` : le groupe d'approbation `subtask` d'IBM Bob, nommé
 *   « Subtasks » par Bob lui-même (un concept de Bob, comme ses sous-agents) ;
 * - « sous-agent » / « subagent » : un autre concept (les sous-agents de l'agent), qui reste ;
 * - ce qui va à l'agent : jamais dans les fichiers de langue (ADR-0014), donc hors de ce test.
 *
 * Le guide a son essai (`renderer/src/help/guide-vocabulary.test.ts`).
 */
import { describe, expect, it } from 'vitest'
import fr from './locales/fr.json'
import en from './locales/en.json'
import {
  RETIRED_EN as FORBIDDEN_EN,
  RETIRED_FR as FORBIDDEN_FR,
  WORK_END_EN,
  WORK_END_FR
} from './retired-words'

type Tree = { readonly [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [[path, value] as [string, string]] : flatten(value, path)
  })
}

/**
 * Exclusions nommées (revue QA : aucune exclusion générale) :
 * - `settingsSearch.*` : mots-clés jamais affichés, anciens mots gardés en synonymes ;
 * - `approvalRules.page.group.subtask` : le groupe d'approbation `subtask` d'IBM Bob, son nom ;
 * - `capabilities.subagentLive.detail` : cite le champ `_meta["opencode/child-session"]` d'OpenCode.
 */
const EXCLUDED_KEYS = [
  /^settingsSearch\./,
  /^approvalRules\.page\.group\.subtask$/,
  /^capabilities\.subagentLive\.detail$/
]

/** « terminée(s) » et « Finie » ne disent plus la fin d'un travail (fiche 266). */
const WORK_KEYS = /^(children|childrenMerge|roleWork|workCard|workGroup|workCue|workMerge)\./

const visible = (text: string) => text

function offending(
  tree: Tree,
  forbidden: readonly RegExp[]
): { key: string; text: string; word: string }[] {
  return flatten(tree)
    .filter(([key]) => !EXCLUDED_KEYS.some((re) => re.test(key)))
    .flatMap(([key, text]) => {
      const hit = forbidden.find((re) => re.test(visible(text)))
      return hit ? [{ key, text, word: hit.source }] : []
    })
}

describe('vocabulaire du travail délégué (fiche 266)', () => {
  it('aucun mot retiré dans les textes français', () => {
    expect(offending(fr as Tree, FORBIDDEN_FR)).toEqual([])
  })

  it('aucun mot retiré dans les textes anglais', () => {
    expect(offending(en as Tree, FORBIDDEN_EN)).toEqual([])
  })

  it('la fin d’un travail se dit « a répondu », jamais « terminée » ni « finie »', () => {
    const hits = flatten(fr as Tree).filter(
      ([key, text]) => WORK_KEYS.test(key) && WORK_END_FR.test(visible(text))
    )
    expect(hits).toEqual([])
  })

  it('en anglais aussi : « replied », jamais « finished »', () => {
    const hits = flatten(en as Tree).filter(
      ([key, text]) => WORK_KEYS.test(key) && WORK_END_EN.test(visible(text))
    )
    expect(hits).toEqual([])
  })

  it('le test reconnaît bien les mots retirés (garde-fou)', () => {
    const sample: Tree = {
      a: 'Conversation fille de « x »',
      b: '3 tâches proposées',
      c: 'a rendu son compte rendu',
      d: 'Sous-tâches',
      e: 'un sous-agent travaille',
      f: 'Mères et filles',
      h: 'Terminées : 2',
      settingsSearch: { g: 'conversations filles' }
    }
    expect(offending(sample, FORBIDDEN_FR).map((o) => o.key)).toEqual(['a', 'b', 'c', 'd', 'f'])
    expect(WORK_END_FR.test('Terminées : 2')).toBe(true)
    expect(WORK_END_FR.test('déterminée')).toBe(false)
    expect(WORK_END_EN.test('3 finished')).toBe(true)
    expect(
      offending({ a: 'Child conversation', b: 'subagent', c: 'reads `child`' }, FORBIDDEN_EN).map(
        (o) => o.key
      )
    ).toEqual(['a', 'c'])
  })
})
