import { createContext } from 'react'

/** Dossier de la conversation : les chemins des cartes d'outils lui sont relatifs (fiche 107). */
export const WorkspaceContext = createContext<string | undefined>(undefined)
