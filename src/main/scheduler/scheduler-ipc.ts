/**
 * Mise en place du planificateur (fiche 178) et ses canaux `schedule:*`. Les arguments viennent du
 * renderer : vérifiés ici (`parseTaskInput`).
 */
import { join } from 'node:path'
import { Notification, powerMonitor } from 'electron'
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import { parseTaskInput, type ScheduledTask } from '@shared/schedule'
import { isDirectory } from '../is-directory'
import { Scheduler } from './scheduler'
import { TASKS_FILE, TaskStore } from './task-store'

type ScheduleChannel =
  'schedule:list' | 'schedule:save' | 'schedule:setPaused' | 'schedule:runNow' | 'schedule:remove'

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function scheduleHandlers(
  scheduler:
    Pick<Scheduler, 'list' | 'create' | 'update' | 'setPaused' | 'runNow' | 'remove'> | undefined
): Pick<IpcHandlers, ScheduleChannel> {
  const get = () => {
    if (!scheduler) throw new Error('Planificateur indisponible')
    return scheduler
  }
  return {
    'schedule:list': () => scheduler?.list() ?? [],
    'schedule:save': (id, task) => {
      const input = parseTaskInput(task)
      return id === null ? get().create(input) : get().update(str(id, 'id'), input)
    },
    'schedule:setPaused': (id, paused) => {
      if (typeof paused !== 'boolean') throw new Error('Paramètre invalide : paused')
      return get().setPaused(str(id, 'id'), paused)
    },
    'schedule:runNow': (id) => get().runNow(str(id, 'id')),
    'schedule:remove': (id) => get().remove(str(id, 'id'))
  }
}

/**
 * Planificateur démarré : tâches lues (`scheduled-tasks.json` à côté de `settings.json`), contrôles
 * lancés, contrôle immédiat au réveil du Mac. Un lancement impossible est notifié (si les
 * notifications sont permises) ; la fin d'une exécution l'est par le suivi de l'attention.
 */
export function setupScheduler(
  manager: ConstructorParameters<typeof Scheduler>[0]['manager'],
  userData: string,
  options: {
    notifications: () => boolean
    send: (tasks: ScheduledTask[]) => void
    /** Profil en lecture seule (fiche 196) : aucune tâche ne se lance, elles créeraient du perdu. */
    readOnly?: () => boolean
  }
): Scheduler {
  const scheduler = new Scheduler({
    manager,
    storage: new TaskStore(join(userData, TASKS_FILE)),
    isDirectory,
    notifyFailure: (task, reason) => {
      if (!options.notifications() || !Notification.isSupported()) return
      const title = t('scheduled.error.notifyTitle', { name: task.name })
      new Notification({ title, body: reason }).show()
    },
    emit: options.send
  })
  if (options.readOnly?.()) return scheduler
  scheduler.start()
  powerMonitor.on('resume', () => scheduler.check())
  return scheduler
}
