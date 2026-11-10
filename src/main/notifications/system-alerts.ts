/**
 * Son quand un agent attend (fiche 068), rebond de l'icône du Dock (fiche 101), compteur « À
 * traiter » sur l'icône et bannières groupées (fiche 119), branchés sur macOS : `afplay` et
 * `app.dock`. En essai, `BOBINE_SOUND_LOG` et `BOBINE_BOUNCE_LOG` notent le son et le rebond dans un
 * journal au lieu de les jouer ; `BOBINE_NOTICE_GROUP_MS` change la fenêtre des bannières groupées.
 */
import { execFile } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { app } from 'electron'
import type { AttentionSound, Preferences } from '@shared/preferences'
import type { AttentionOptions } from './attention'
import { createChime, soundFile } from './chime'
import { createDockBadge, type DockBadge } from './dock-badge'
import { createDockBounce, journalDock } from './dock-bounce'
import { GROUP_WINDOW_MS, timerSchedule } from './grouping'

export function systemAlerts(
  preferences: () => Preferences,
  notificationsEnabled: () => boolean
): {
  /** Joue un son tout de suite (« Écouter » des Réglages). */
  playSound: (sound: Exclude<AttentionSound, 'off'>) => void
  /** Pour le suivi de l'attention. */
  attention: Pick<AttentionOptions, 'chime' | 'bounce' | 'stopBounce' | 'groups'>
  /** Compteur « À traiter » sur l'icône du Dock, coupé avec les notifications. */
  badge: DockBadge
} {
  const playSound = (sound: Exclude<AttentionSound, 'off'>) => {
    const log = process.env['BOBINE_SOUND_LOG']
    if (log) appendFileSync(log, `${sound}\n`)
    else execFile('afplay', [soundFile(sound)], () => {})
  }
  const chime = createChime({ play: playSound })
  const bounceLog = process.env['BOBINE_BOUNCE_LOG']
  const dockBounce = createDockBounce({
    // Hors macOS, pas de Dock : rien ne rebondit.
    dock: bounceLog ? journalDock((line) => appendFileSync(bounceLog, `${line}\n`)) : app.dock,
    enabled: () => preferences().dockBounce
  })
  // Retour dans l'app, même par la fenêtre rapide : macOS arrête le rebond, le suivi aussi.
  app.on('did-become-active', () => dockBounce.stop())
  const windowMs = Number(process.env['BOBINE_NOTICE_GROUP_MS'])
  return {
    playSound,
    // Hors macOS, pas de Dock : pas de compteur.
    badge: createDockBadge({
      dock: app.dock,
      enabled: () => notificationsEnabled() && preferences().dockBadge
    }),
    attention: {
      groups: {
        schedule: timerSchedule,
        windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : GROUP_WINDOW_MS
      },
      chime: () => chime(preferences().attentionSound),
      bounce: (kind) => dockBounce.bounce(kind),
      stopBounce: () => dockBounce.stop()
    }
  }
}
