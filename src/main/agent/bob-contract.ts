/**
 * Ce que l'app reconnaît dans les réponses de Bob (fiche 048) : codes et messages relevés sur Bob
 * 2.0.6 (docs/acp.md, « Compatibilité Bob »). Un seul endroit, partagé par le profil Bob (motifs
 * de ses refus, lus par l'hôte d'agent sans savoir qu'ils sont de Bob, ADR-0015) et la sonde
 * `pnpm bob-probe`, qui vérifie à chaque version de Bob qu'ils tiennent.
 *
 * Sans import : le script de la sonde le charge sous Node, sans bundler.
 */

/**
 * Connexion requise : code ACP standard (`RequestError.authRequired`, que l'hôte d'agent lit dans le
 * SDK), Bob l'envoie à `session/new`. Gardé ici pour que la sonde vérifie que Bob s'y tient.
 */
export const AUTH_REQUIRED = -32000

/**
 * Message de ce refus (`docs/acp.md`, sonde : « Authentication required » à `session/new`, et à la
 * réouverture d'une session une fois Bob déconnecté). Au message, Bob ne l'envoie pas (voir
 * ci-dessous) : gardé au cas où, il dit qu'un `-32000` est une connexion à refaire (D10).
 */
export const AUTH_REQUIRED_MESSAGE = /authentication required/i

/** Erreur interne JSON-RPC : sous ce code, Bob relaie l'échec d'un tour (cause dans `data`). */
export const INTERNAL_ERROR = -32603

/**
 * Connexion refusée au message (Bob 2.0.9, sonde et fiche 200) : `-32603` « Internal error »,
 * `data.details` « ApiKeyError: {… "title":"Request Failed","description":"Invalid or expired API
 * key."} ». Sa passerelle a répondu 401 : connexion SSO expirée (jeton de rafraîchissement refusé,
 * Bob se déconnecte) ou clé d'API refusée. Seul sous ce code, ce motif dit une connexion à refaire.
 */
export const EXPIRED_LOGIN_MESSAGE = /invalid or expired api key/i

/** Licence IBM non acceptée : `-32600` « A license agreement is required… ». */
export const LICENSE_REQUIRED = /license agreement is required/i

/** Dossier non approuvé : `-32600` « Workspace "…" is not trusted… » (pas de code dédié). */
export const UNTRUSTED_WORKSPACE = /\bnot trusted\b|\buntrusted\b|non approuvé/i
