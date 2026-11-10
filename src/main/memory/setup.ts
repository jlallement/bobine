/**
 * Mémoire de l'app (fiche 182) : le service, branché au gestionnaire de conversations (lu
 * seulement après sa création : appel d'un outil par un agent, IPC), et le module d'outils.
 */
import { safeStorage, shell } from 'electron'
import { t } from 'i18next'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ChildConversations } from '../conversations/children'
import type { ConversationManager } from '../conversations/manager'
import { chooseDirectory, saveFile } from '../dialogs'
import { log } from '../log'
import type { MemoryIpcDeps } from './memory-ipc'
import type { SettingsStore } from '../settings-store'
import { memoryToolsModule } from '../mcp/memory-tools'
import type { AppToolModule } from '../mcp/tools'
import { approvalSigner } from './approval-key'
import { MemoryService } from './service'
import { MemoryStore } from './store'

export function appMemory(
  userData: string,
  conversations: () => ConversationManager,
  children: () => ChildConversations | undefined,
  settings: Pick<SettingsStore, 'preferences'>
): { service: MemoryService; tools: AppToolModule; ipc: MemoryIpcDeps } {
  const service = new MemoryService({
    store: new MemoryStore(join(userData, 'memory'), {
      log: (message) => log.info(message),
      // Empreintes à clé chiffrée par le trousseau, comme les clés d'API (fiche 022).
      signer: approvalSigner(
        join(userData, 'memory.key'),
        {
          available: () => safeStorage.isAsyncEncryptionAvailable(),
          // Linux sans trousseau : mot de passe écrit en dur, pas un secret.
          weak: () =>
            process.platform === 'linux' &&
            safeStorage.getSelectedStorageBackend() === 'basic_text',
          encrypt: (text) => safeStorage.encryptStringAsync(text),
          decrypt: async (data) => (await safeStorage.decryptStringAsync(data)).result
        },
        (message) => log.warn(message),
        () => keyedApprovals(`${join(userData, 'memory')}.approved.json`)
      )
    }),
    conversations: {
      items: (id) => conversations().view(id).transcript.items,
      post: (id, event) => conversations().post(id, event),
      workspaceOf: (id) => conversations().workspaceOf(id),
      agentLabel: (id) => conversations().view(id).summary.profileLabel
    },
    enabled: () => settings.preferences().memoryEnabled
  })
  // Pas de mémoire pour un relecteur (fiche 177 : lecture seule demandée).
  const isReviewer = (id: string) => {
    try {
      return !!children()?.summary(id).reviewOf
    } catch {
      return false
    }
  }
  const ipc: MemoryIpcDeps = {
    chooseDirectory: () =>
      chooseDirectory({ title: t('memory.attach.title'), buttonLabel: t('memory.attach.button') }),
    saveMarkdown: (name) => saveFile(name, 'markdown'),
    reveal: (path) => shell.showItemInFolder(path),
    exportTitle: (place) =>
      place.scope === 'user'
        ? t('memory.export.titleUser')
        : t('memory.export.titleProject', { project: projectName(place.projectId) })
  }
  return { service, tools: memoryToolsModule(service, isReviewer), ipc }
}

/** Nom lisible d'un projet : son identifiant sans l'empreinte (`bobine-1a2b3c4d` → `bobine`). */
const projectName = (projectId: string) => projectId.replace(/-[0-9a-f]{8}$/, '')

/** Le fichier des empreintes contient-il une empreinte à clé ? (illisible : non) */
function keyedApprovals(file: string): boolean {
  try {
    return readFileSync(file, 'utf8').includes('"hmac:')
  } catch {
    return false
  }
}
