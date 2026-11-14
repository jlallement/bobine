import { describe, expect, it } from 'vitest'
import { runningJobs, startCommandJob, stopAllJobs, waitAtMost } from './command-job'

describe('commande longue en tâche de fond', () => {
  it('sortie gardée, statut à la fin', async () => {
    const job = startCommandJob('/bin/sh', ['-c', 'echo un; echo deux >&2'], { cwd: '/' })
    expect(await waitAtMost(job, 5000)).toBe(true)
    expect(job.status).toBe('succeeded')
    expect(job.lines).toEqual(expect.arrayContaining(['un', 'deux']))
    expect(runningJobs()).toBe(0)
  })

  it('sortie lue jusqu’au bout : les dernières lignes ne se perdent pas à la sortie du processus', async () => {
    // À la sortie (`exit`), les tubes peuvent encore contenir de la sortie : sous charge, le
    // travail finissait sans ses dernières lignes. Il finit maintenant à `close`.
    const job = startCommandJob(
      '/bin/sh',
      ['-c', 'i=0; while [ $i -lt 1500 ]; do echo "ligne $i"; i=$((i+1)); done; echo fin >&2'],
      { cwd: '/' }
    )
    expect(await waitAtMost(job, 10_000)).toBe(true)
    expect(job.status).toBe('succeeded')
    expect(job.lines).toHaveLength(1501)
    expect(job.lines).toEqual(expect.arrayContaining(['ligne 0', 'ligne 1499', 'fin']))
  })

  it('l’agent raccroche (fiche 195) : l’attente s’arrête, le travail continue', async () => {
    const job = startCommandJob('/bin/sh', ['-c', 'sleep 30'], { cwd: '/' })
    const gone = new AbortController()
    const waiting = waitAtMost(job, 60_000, gone.signal)
    gone.abort()
    expect(await waiting).toBe(false)
    expect(job.status).toBe('running')
    stopAllJobs()
    expect(await waitAtMost(job, 5000)).toBe(true)
  })

  it('en quittant (fiche 195) : le travail et ses sous-processus sont arrêtés', async () => {
    // Un sous-processus `sleep` : seul l'arrêt du groupe l'emporte avec le shell.
    const job = startCommandJob('/bin/sh', ['-c', 'sleep 30 & wait'], { cwd: '/' })
    expect(runningJobs()).toBe(1)
    stopAllJobs()
    expect(await waitAtMost(job, 5000)).toBe(true)
    expect(job.status).toBe('failed')
    expect(runningJobs()).toBe(0)
  })
})
