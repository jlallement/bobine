/**
 * Canaux IPC des documents d'une discussion (fiche 224), sortis de `ipc.ts` (taille bornée, fiche
 * 089) : le contrat `IpcInvokeContract` les reprend (`extends`), `IPC_CHANNELS` aussi.
 *
 * Une discussion est désignée par son identifiant, un document par son nom : jamais un chemin
 * venu du renderer, sauf les fichiers qu'on y dépose (copiés, l'original n'est pas touché).
 */
import type { ConversationView } from './agent'
import type { DiscussionDocument, DocumentPreview } from './documents'

export interface DocumentsIpcContract {
  /** Documents de la discussion, les plus récents d'abord ; vide pour une autre conversation. */
  'documents:list': { args: [conversationId: string]; result: DiscussionDocument[] }
  /** Copie des fichiers glissés dans la discussion ; rend les noms donnés aux copies. */
  'documents:add': { args: [conversationId: string, paths: string[]]; result: string[] }
  /** Choisir des fichiers (dialogue du système) et les copier dans la discussion. */
  'documents:pick': { args: [conversationId: string]; result: string[] }
  /** Ouvre un document avec son app ; rend un message d'erreur, vide s'il s'est ouvert. */
  'documents:open': { args: [conversationId: string, name: string]; result: string }
  /** Montre un document dans le Finder. */
  'documents:reveal': { args: [conversationId: string, name: string]; result: undefined }
  /** « Enregistrer une copie dans… » : rend le chemin de la copie, `null` si annulé. */
  'documents:saveCopy': { args: [conversationId: string, name: string]; result: string | null }
  /** Aperçu en lecture seule d'un document (texte, image, document Word converti). */
  'documents:preview': { args: [conversationId: string, name: string]; result: DocumentPreview }
  /**
   * « Continuer dans un projet… » : le dossier est choisi dans le dialogue du système (jamais un
   * chemin du renderer) ; `copyDocuments` : les documents copiés dans `documents/` du projet. Rend
   * la nouvelle conversation de l'espace Code, `null` si le choix est annulé.
   */
  'discussion:continueInProject': {
    args: [conversationId: string, options: { copyDocuments: boolean }]
    result: ConversationView | null
  }
}

export const DOCUMENTS_CHANNELS = [
  'documents:list',
  'documents:add',
  'documents:pick',
  'documents:open',
  'documents:reveal',
  'documents:saveCopy',
  'documents:preview',
  'discussion:continueInProject'
] as const

export type DocumentsChannel = (typeof DOCUMENTS_CHANNELS)[number]
