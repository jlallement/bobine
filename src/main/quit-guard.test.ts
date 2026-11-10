import { describe, expect, it, vi } from 'vitest'
import { QuitFlow, quitQuestion, waitForStoppedProcesses } from './quit-guard'

describe('confirmation avant de quitter', () => {
  it('rien ne travaille : pas de question', () => {
    expect(quitQuestion([])).toBeNull()
  })
  it('une ou plusieurs conversations : question, « Annuler » par défaut', () => {
    expect(quitQuestion(['Migration Postgres'])).toMatchObject({
      message: 'Un agent travaille encore',
      detail: expect.stringContaining('«\u00a0Migration Postgres\u00a0»'),
      buttons: ['Quitter', 'Annuler'],
      defaultId: 1,
      cancelId: 1
    })
    expect(quitQuestion(['a', 'b'])?.detail).toContain('2 conversations')
  })
})

describe('QuitFlow : ce qui se passe en quittant (fiche 089)', () => {
  function flow(options: { busy?: string[]; drafts?: boolean; answer?: boolean } = {}) {
    let drafts = options.drafts ?? false
    const calls = {
      ask: vi.fn(async () => options.answer ?? true),
      drop: vi.fn(async () => {
        drafts = false
      }),
      quit: vi.fn(),
      shutdown: vi.fn()
    }
    const quit = new QuitFlow({
      busyTitles: () => options.busy ?? [],
      ask: calls.ask,
      hasDraftSessions: () => drafts,
      dropDraftSessions: calls.drop,
      quit: calls.quit,
      shutdown: calls.shutdown
    })
    const event = () => ({ preventDefault: vi.fn() })
    return { quit, calls, event }
  }
  const settle = () => new Promise((resolve) => setImmediate(resolve))

  it('rien ne travaille, pas de conversation vide : tout s’arrête tout de suite', () => {
    const { quit, calls, event } = flow()
    const e = event()
    quit.beforeQuit(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(calls.shutdown).toHaveBeenCalledWith(false)
  })

  it('un agent travaille : question ; « Annuler » garde l’app, « Quitter » redemande de quitter', async () => {
    const cancel = flow({ busy: ['Migration'], answer: false })
    const e = cancel.event()
    cancel.quit.beforeQuit(e)
    expect(e.preventDefault).toHaveBeenCalled()
    await settle()
    expect(cancel.calls.ask).toHaveBeenCalledWith(
      expect.objectContaining({ buttons: ['Quitter', 'Annuler'] })
    )
    expect(cancel.calls.quit).not.toHaveBeenCalled()

    const confirm = flow({ busy: ['Migration'], answer: true })
    confirm.quit.beforeQuit(confirm.event())
    await settle()
    expect(confirm.calls.quit).toHaveBeenCalledTimes(1)
    // Electron rappelle `before-quit` : plus de question, l'app s'arrête.
    confirm.quit.beforeQuit(confirm.event())
    expect(confirm.calls.ask).toHaveBeenCalledTimes(1)
    expect(confirm.calls.shutdown).toHaveBeenCalledWith(false)
  })

  it('après l’arrêt, un nouveau `before-quit` (attente des processus, fiche 195) ne refait rien', () => {
    const { quit, calls, event } = flow({ busy: ['Migration'] })
    quit.confirm()
    quit.beforeQuit(event())
    const again = event()
    quit.beforeQuit(again)
    expect(calls.shutdown).toHaveBeenCalledTimes(1)
    expect(again.preventDefault).not.toHaveBeenCalled()
    expect(calls.ask).not.toHaveBeenCalled()
  })

  it('arrêt du Mac ou signal : jamais de question', () => {
    const { quit, calls, event } = flow({ busy: ['Migration'] })
    quit.confirm()
    quit.beforeQuit(event())
    expect(calls.ask).not.toHaveBeenCalled()
    expect(calls.shutdown).toHaveBeenCalled()
  })

  it('conversations vides : sessions supprimées une fois, puis on quitte', async () => {
    const { quit, calls, event } = flow({ drafts: true })
    const e = event()
    quit.beforeQuit(e)
    expect(e.preventDefault).toHaveBeenCalled()
    await settle()
    expect(calls.drop).toHaveBeenCalledTimes(1)
    expect(calls.quit).toHaveBeenCalledTimes(1)
    quit.beforeQuit(event())
    expect(calls.drop).toHaveBeenCalledTimes(1)
    expect(calls.shutdown).toHaveBeenCalledWith(false)
  })

  it('« Relancer » : l’app se relance une fois quittée, sauf si l’utilisateur annule', async () => {
    const relaunch = flow()
    relaunch.quit.relaunchAfterQuit()
    expect(relaunch.calls.quit).toHaveBeenCalledTimes(1)
    relaunch.quit.beforeQuit(relaunch.event())
    expect(relaunch.calls.shutdown).toHaveBeenCalledWith(true)

    const cancelled = flow({ busy: ['Migration'], answer: false })
    cancelled.quit.relaunchAfterQuit()
    cancelled.quit.beforeQuit(cancelled.event())
    await settle()
    cancelled.quit.confirm()
    cancelled.quit.beforeQuit(cancelled.event())
    expect(cancelled.calls.shutdown).toHaveBeenCalledWith(false)
  })

  it('fils écrits et alerte des non-enregistrés une fois, avant l’arrêt ; un arrêt du Mac la ferme (fiche 197)', async () => {
    const seen: boolean[] = []
    const keepUnsaved = vi.fn(async (interactive: () => boolean) => {
      seen.push(interactive())
      await new Promise((resolve) => setTimeout(resolve, 5))
      seen.push(interactive())
    })
    const stopAsking = vi.fn()
    const calls = { quit: vi.fn(), shutdown: vi.fn() }
    const quit = new QuitFlow({
      busyTitles: () => [],
      ask: async () => true,
      hasDraftSessions: () => false,
      dropDraftSessions: async () => {},
      keepUnsaved,
      stopAsking,
      ...calls
    })
    const e = { preventDefault: vi.fn() }
    quit.beforeQuit(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(calls.shutdown).not.toHaveBeenCalled()
    // L'arrêt du Mac survient pendant l'alerte : elle est fermée, et n'est plus interactive.
    quit.confirm()
    expect(stopAsking).toHaveBeenCalledOnce()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(seen).toEqual([true, false])
    expect(calls.quit).toHaveBeenCalledOnce()
    quit.beforeQuit({ preventDefault: vi.fn() })
    expect(keepUnsaved).toHaveBeenCalledOnce()
    expect(calls.shutdown).toHaveBeenCalledWith(false)
  })
})

describe('en quittant : attente des processus arrêtés (fiche 195)', () => {
  function fakeApp() {
    let listener: ((event: { preventDefault(): void }) => void) | undefined
    return {
      on: (_: 'will-quit', fn: (event: { preventDefault(): void }) => void) => (listener = fn),
      quit: vi.fn(),
      fire: () => {
        const event = { preventDefault: vi.fn() }
        listener?.(event)
        return event
      }
    }
  }

  it('rien à attendre : l’app sort tout de suite', () => {
    const app = fakeApp()
    const settle = vi.fn(async () => {})
    waitForStoppedProcesses(app, () => false, settle)
    expect(app.fire().preventDefault).not.toHaveBeenCalled()
    expect(settle).not.toHaveBeenCalled()
  })

  it('un groupe vit encore : attente, puis on redemande de quitter, une seule fois', async () => {
    const app = fakeApp()
    const settle = vi.fn(async () => {})
    waitForStoppedProcesses(app, () => true, settle)
    expect(app.fire().preventDefault).toHaveBeenCalled()
    await new Promise((resolve) => setImmediate(resolve))
    expect(settle).toHaveBeenCalledTimes(1)
    expect(app.quit).toHaveBeenCalledTimes(1)
    expect(app.fire().preventDefault).not.toHaveBeenCalled()
  })
})
