import { describe, expect, it } from 'vitest'
import { formatSlowest, machineLine, slowestTests } from './test-report.mts'

const report = {
  testResults: [
    {
      name: 'D:/a/bobine/bobine/src/main/ipc-agent.test.ts',
      assertionResults: [
        { fullName: 'agent › toujours autoriser', duration: 15012, status: 'failed' },
        { fullName: 'agent › rapide', duration: 12, status: 'passed' }
      ]
    },
    {
      name: '/Users/x/bobine/src/main/cost-cap.test.ts',
      assertionResults: [
        { title: 'coût qui monte', duration: 2100, status: 'passed' },
        { title: 'sans durée', status: 'skipped' }
      ]
    },
    { name: 'sans-essais.test.ts' }
  ]
}

describe('relevé des tests en CI', () => {
  it('trie les essais du plus lent au plus rapide, chemins raccourcis (Windows compris)', () => {
    const slow = slowestTests(report, 2, 'D:\\a\\bobine\\bobine\\')
    expect(slow).toEqual([
      {
        file: 'src/main/ipc-agent.test.ts',
        name: 'agent › toujours autoriser',
        ms: 15012,
        status: 'failed'
      },
      {
        file: '/Users/x/bobine/src/main/cost-cap.test.ts',
        name: 'coût qui monte',
        ms: 2100,
        status: 'passed'
      }
    ])
    expect(slowestTests(report, 10, '/Users/x/bobine/')[1]?.file).toBe('src/main/cost-cap.test.ts')
  })

  it('rapport illisible ou vide : aucune ligne inventée', () => {
    expect(slowestTests(undefined)).toEqual([])
    expect(slowestTests({ testResults: 'non' })).toEqual([])
    expect(formatSlowest([])).toEqual(['(aucune durée lue dans le rapport)'])
  })

  it('une ligne par essai : durée en secondes, état, fichier › nom', () => {
    expect(formatSlowest([{ file: 'a.test.ts', name: 'b', ms: 15012, status: 'failed' }])).toEqual([
      '   15.0 s  failed  a.test.ts › b'
    ])
  })

  it('dit les cœurs, les workers et la charge (non mesurée sous Windows)', () => {
    const base = { cores: 4, load: [3, 2, 1], freeBytes: 0, totalBytes: 16 * 1024 ** 3 }
    expect(machineLine({ ...base, workers: '2', platform: 'win32' })).toBe(
      '4 cœurs · workers 2 (BOBINE_TEST_WORKERS) · charge non mesurée sous Windows · mémoire libre 0.0 / 16.0 Gio'
    )
    expect(machineLine({ ...base, workers: undefined, platform: 'linux' })).toBe(
      '4 cœurs · workers défaut de vitest (3) · charge 3.00 2.00 1.00 (1, 5, 15 min) · mémoire libre 0.0 / 16.0 Gio'
    )
  })
})
