import { describe, expect, it } from 'vitest'
import { diffFeedback } from './diff-notes'
import {
  BRIEF_FILES,
  MAX_FINDINGS,
  REVIEW_BRIEF_LEAD,
  findingNote,
  parseFindings,
  reviewBrief,
  severeCount,
  type ReviewFinding
} from './review'

const finding = (over: Record<string, unknown> = {}) => ({
  file: 'src/app.js',
  line: 2,
  severity: 'high',
  category: 'correctness',
  title: 'Titre',
  why: 'Pourquoi',
  ...over
})

describe('relecture : consigne (fiche 177)', () => {
  it('branche : point de comparaison, branche de base, fichiers, lecture seule, outil', () => {
    const brief = reviewBrief(
      {
        scope: 'branch',
        base: 'abc1234',
        baseBranch: 'main',
        files: ['a.ts', 'b.ts'],
        authorTitle: 'Import'
      },
      'les erreurs réseau'
    )
    expect(brief.startsWith(REVIEW_BRIEF_LEAD)).toBe(true)
    expect(brief).toContain('git diff abc1234')
    expect(brief).toContain('left main')
    expect(brief).toContain('- a.ts\n- b.ts')
    expect(brief).toContain('Do NOT modify')
    expect(brief).toContain('report_findings')
    expect(brief).toContain('les erreurs réseau')
  })

  it('non commité ; liste de fichiers bornée', () => {
    const files = Array.from({ length: BRIEF_FILES + 5 }, (_, i) => `f${i}.ts`)
    const brief = reviewBrief({ scope: 'uncommitted', files, authorTitle: 'X' })
    expect(brief).toContain('git diff HEAD')
    expect(brief).toContain('… and 5 more')
    expect(brief).not.toContain(`f${BRIEF_FILES}.ts`)
    expect(brief).not.toContain('look in particular')
  })
})

describe('relecture : arguments de `report_findings`', () => {
  it('valide, borne et garde le résumé', () => {
    const parsed = parseFindings({
      findings: [
        finding({ endLine: 4, title: 'x'.repeat(500) }),
        finding({ endLine: 2, category: undefined })
      ],
      summary: '  Verdict  '
    })
    expect(parsed.summary).toBe('Verdict')
    expect(parsed.findings[0]).toMatchObject({ line: 2, endLine: 4 })
    expect(parsed.findings[0]?.title.length).toBeLessThanOrEqual(160)
    // endLine égale à line : retirée ; nature par défaut : correction.
    expect(parsed.findings[1]).not.toHaveProperty('endLine')
    expect(parsed.findings[1]?.category).toBe('correctness')
    expect(parseFindings({ findings: [] })).toEqual({ findings: [] })
  })

  it.each([
    [{}, 'an array is expected'],
    [{ findings: [finding({ line: 0 })] }, 'findings[0].line'],
    [{ findings: [finding({ endLine: 1 })] }, 'findings[0].endLine'],
    [{ findings: [finding({ severity: 'critical' })] }, 'findings[0].severity'],
    [{ findings: [finding({ category: 'style' })] }, 'findings[0].category'],
    [{ findings: [finding({ why: ' ' })] }, 'findings[0].why'],
    [{ findings: ['x'] }, 'findings[0]: an object'],
    [{ findings: Array.from({ length: MAX_FINDINGS + 1 }, () => finding()) }, 'at most'],
    [{ findings: [], summary: 3 }, '`summary`']
  ])('refuse %j', (args, message) => {
    expect(() => parseFindings(args)).toThrow(message)
  })
})

describe('relecture : remarques de diff', () => {
  const full: ReviewFinding = {
    id: 'r:1',
    file: 'src/app.js',
    line: 2,
    endLine: 3,
    severity: 'high',
    category: 'correctness',
    title: 'Message en dur',
    why: 'Lire l’argument.',
    code: "  console.log('bonjour')\n}"
  }

  it('vue Git, plage, gravité ; message à l’agent avec la gravité', () => {
    const note = findingNote(full)
    expect(note).toMatchObject({
      id: 'r:1',
      view: 'git',
      file: 'src/app.js',
      from: 2,
      to: 3,
      side: 'new'
    })
    const text = diffFeedback([note])
    expect(text).toContain('1. src/app.js, lignes 2 à 3 :')
    expect(text).toContain('Remarque de la relecture (gravité haute) : Message en dur')
    expect(severeCount({ findings: [full, { ...full, severity: 'low' }] })).toBe(1)
  })

  it('code introuvable : pas de bloc vide', () => {
    const text = diffFeedback([findingNote({ ...full, code: '' })])
    expect(text).not.toContain('```')
  })
})
