/** Retour du réseau d'après Electron : `net.isOnline()` et la sortie de veille (fiche 142). */
import { net, powerMonitor } from 'electron'
import { createNetworkWatch, type NetworkWatch } from './network-watch'

export const electronNetworkWatch = (): NetworkWatch =>
  createNetworkWatch({ isOnline: () => net.isOnline(), power: powerMonitor })
