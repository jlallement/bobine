/**
 * Canaux IPC « invoke » du navigateur intégré (fiches 007, 066, 072, 094, 129, 132, 146, 269),
 * sortis de `ipc.ts` (taille bornée, fiche 089) : le contrat `IpcInvokeContract` les reprend
 * (`extends`), `IPC_CHANNELS` aussi. Les évènements (`browser:state`…) restent dans `ipc.ts`.
 *
 * Certificats refusés (fiche 269, ADR-0064) : le renderer ne donne jamais l'hôte ni l'empreinte
 * d'un certificat à accepter, seulement le jeton de l'avertissement que le main a noté. Comme tout
 * canal, l'émetteur est vérifié (fiche 114).
 */
import type { AgentSettingsView } from './agent'
import type { ImageAttachment } from './attachments'
import type {
  BrowserBounds,
  BrowserGo,
  BrowserState,
  BrowserZoom,
  CertificateException
} from './browser'
import type { PageFreeze, PageLayerTheme, PagePin } from './page-notes'

export interface BrowserIpcContract {
  /** Affiche la page du navigateur de la conversation à l'emplacement de l'onglet (fiche 007). */
  'browser:show': { args: [id: string, bounds: BrowserBounds, focus?: true]; result: undefined }
  /** Onglet masqué ou panneau fermé : plus de page affichée. */
  /** « Effacer les données du navigateur » (fiche 072). */
  'browser:clearData': { args: []; result: undefined }
  'browser:hide': { args: []; result: undefined }
  /** Adresse saisie par l'utilisateur dans la barre de l'onglet. */
  'browser:navigate': { args: [id: string, input: string]; result: undefined }
  /** Image de la page affichée, à joindre au message (fiche 066) ; `null` sans page. */
  'browser:capture': { args: [id: string]; result: ImageAttachment | null }
  'browser:go': { args: [id: string, action: BrowserGo]; result: undefined }
  'browser:getState': { args: [id: string]; result: BrowserState | null }
  'browser:selectTab': { args: [id: string, tabId: string]; result: undefined }
  'browser:closeTab': { args: [id: string, tabId: string]; result: undefined }
  /** « Afficher dans le Finder » un fichier téléchargé et enregistré (fiche 094). */
  'browser:showDownload': { args: [id: string, path: string]; result: undefined }
  /** Zoom de la page de l'onglet actif (fiche 129 : puce « 110 % » du champ d'adresse). */
  'browser:zoom': { args: [id: string, action: BrowserZoom]; result: undefined }
  /** La page reprend la largeur du panneau (taille imposée par l'agent, fiche 129). */
  'browser:clearEmulation': { args: [id: string]; result: undefined }
  /** Page figée le temps d'écrire une remarque (fiches 132, 146) ; `null` sans page. */
  'browser:freeze': { args: [id: string]; result: PageFreeze | null }
  /** Capture propre d'une remarque, sans ce que l'app dessine dans la page (fiche 146). */
  'browser:noteShot': { args: [id: string]; result: PageFreeze | null }
  /** Mode Annoter sur la page vivante (fiche 146) : script de la page, couleurs du thème. */
  'browser:annotate': {
    args: [id: string, on: boolean, theme: PageLayerTheme | null]
    result: undefined
  }
  /** Épingles dessinées dans la page (fiche 146). */
  'browser:pagePins': { args: [id: string, pins: PagePin[]]; result: undefined }
  /** « Continuer vers <hôte> (non sécurisé) » : jeton de l'avertissement, « Se souvenir ». */
  'browser:allowCertificate': {
    args: [id: string, token: string, remember: boolean]
    result: undefined
  }
  /** « Retour » de l'avertissement de certificat : la page d'avant, ou une page vide. */
  'browser:leaveCertificate': { args: [id: string]; result: undefined }
  /** « Ouvrir dans le navigateur » : l'adresse de l'avertissement, dans celui du système. */
  'browser:openCertificateSite': { args: [id: string, token: string]; result: undefined }
  /** Certificat accepté, révoqué dans Réglages › Confidentialité. */
  'settings:forgetCertificate': {
    args: [certificate: CertificateException]
    result: AgentSettingsView
  }
}

export const BROWSER_CHANNELS = [
  'browser:show',
  'browser:clearData',
  'browser:hide',
  'browser:navigate',
  'browser:capture',
  'browser:go',
  'browser:getState',
  'browser:selectTab',
  'browser:closeTab',
  'browser:showDownload',
  'browser:zoom',
  'browser:clearEmulation',
  'browser:freeze',
  'browser:noteShot',
  'browser:annotate',
  'browser:pagePins',
  'browser:allowCertificate',
  'browser:leaveCertificate',
  'browser:openCertificateSite',
  'settings:forgetCertificate'
] as const satisfies readonly (keyof BrowserIpcContract)[]
